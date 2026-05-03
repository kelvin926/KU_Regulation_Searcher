import { describe, expect, it } from "vitest";
import type { ArticleRecord } from "../../shared/types";
import { rankArticlesForQuestion } from "./article-ranker";
import { expandQuery } from "./query-expander";

describe("search quality reranking", () => {
  it("normalizes undergraduate military leave questions", () => {
    const expanded = expandQuery("미래모빌리티학과 학부생의 군입대는 어떻게 진행해야 하나요?");

    expect(expanded.queryIntent.scope).toBe("학부");
    expect(expanded.keywords).toEqual(expect.arrayContaining(["학부", "군입대", "군입대휴학", "휴학"]));
    expect(expanded.keywords).toContain("미래모빌리티학과");
    expect(expanded.requiredTerms).not.toContain("미래모빌리티학과");
    expect(expanded.removedStopWords).toEqual(expect.arrayContaining(["학부생", "진행"]));
  });

  it("infers undergraduate scope from department student questions", () => {
    const expanded = expandQuery("미래모빌리티학과 학생은 몇학기 휴학이 가능한가요?");
    const result = rankArticlesForQuestion(
      [
        createArticle(1, "학사운영 규정", "제23조", "휴학의 신청·허가 및 기간", "휴학기간은 통산 4년(8학기)을 초과할 수 없다."),
        createArticle(2, "대학원학칙 일반대학원 시행세칙", "제17조", "휴학기간", "휴학연한은 석사과정 2년, 박사과정 3년으로 한다."),
        createArticle(3, "세종캠퍼스 창업 휴학 운영 지침", "제3조", "창업 휴학 기간", "창업 휴학은 최대 2년까지 가능하다."),
        createArticle(4, "대학원학칙 경영전문대학원 시행세칙", "제21조", "휴학기간", "전문석사학위 과정의 휴학기간은 통산 1년이다."),
        createArticle(5, "의과대학 학사운영 시행세칙", "제4조", "휴학", "의예과는 통산 3학기, 의학과는 통산 6학기까지 휴학할 수 있다."),
      ],
      "미래모빌리티학과 학생은 몇학기 휴학이 가능한가요?",
      expanded,
      5,
    );

    expect(expanded.queryIntent.scope).toBe("학부");
    expect(result.articles[0].id).toBe(1);
    expect(result.articles[0].relevance?.group).toBe("primary");
    expect(result.articles.find((article) => article.id === 2)?.relevance?.group).toBe("out_of_scope");
    expect(result.articles.find((article) => article.id === 3)?.relevance?.group).not.toBe("primary");
    expect(result.articles.find((article) => article.id === 4)?.relevance?.group).toBe("out_of_scope");
    expect(result.articles.find((article) => article.id === 5)?.relevance?.group).toBe("out_of_scope");
  });

  it("does not treat every department name ending in 학부 as an undergraduate-student scope", () => {
    const expanded = expandQuery("건축사회환경공학부 신임교원 책임수업시간 감면 내규의 감면 신청 규정은?");

    expect(expanded.queryIntent.scope).toBe("교원");
  });

  it("keeps directly named specific regulations in scope", () => {
    const query = "SW중심대학사업 관리 운영 규정의 세종SW중심대학사업단 규정은?";
    const expanded = expandQuery(query);
    const result = rankArticlesForQuestion(
      [
        createArticle(1, "SW중심대학사업 관리 운영 규정", "제2조", "세종SW중심대학사업단", "세종SW중심대학사업단에 관한 사항을 정한다."),
        createArticle(2, "세종캠퍼스 사무분장 규정", "제38조", "대학일자리플러스센터", "세종캠퍼스 행정부서의 사무분장을 정한다."),
      ],
      query,
      expanded,
      2,
    );

    expect(result.articles[0].id).toBe(1);
    expect(result.articles[0].relevance?.group).toBe("primary");
  });

  it("keeps directly named regulations in scope even when the article mentions staff roles", () => {
    const query = "GKS융합전공 운영 지침 제4조를 봐야 할 것 같은데, 핵심 내용과 적용할 때 볼 부분을 알려줘.";
    const result = rankArticlesForQuestion(
      [
        createArticle(1, "GKS융합전공 운영 지침", "제4조", "행정지원과 조교", "GKS융합전공 운영을 위한 행정지원과 조교 사항을 정한다."),
        createArticle(2, "교우회 학술상 수상 후보자 추천 운영 지침", "제4조", "추천절차", "추천 절차와 제출 서류를 정한다."),
        createArticle(3, "국제어학원 International Writing Services 업무 지침", "제4조", "담당행정인원 구성 및 업무", "담당행정인원 구성과 업무를 정한다."),
      ],
      query,
      expandQuery(query),
      3,
    );

    expect(result.articles[0].id).toBe(1);
    expect(result.articles[0].relevance?.group).toBe("primary");
  });

  it("keeps direct regulation and title matches as AI evidence for eligibility questions", () => {
    const query = "Global KU 장학금 지급 내규의 지급대상 대상이나 요건은?";
    const result = rankArticlesForQuestion(
      [
        createArticle(1, "Global KU 장학금 지급 내규", "제3조", "지급대상", "장학금은 본교 재학생 중 선발 기준을 충족한 자에게 지급한다."),
        createArticle(2, "Global KU 장학금 지급 내규", "제4조", "장학금 지급", "장학금 지급 절차와 지급 시기를 정한다."),
        createArticle(3, "BK21 운영 내규", "제13조", "참여대학원생에 대한 지원", "참여대학원생 장학금 지원 사항을 정한다."),
      ],
      query,
      expandQuery(query),
      3,
    );

    expect(result.articles[0].id).toBe(1);
    expect(result.articles[0].relevance?.group).toBe("primary");
  });

  it("prioritizes the directly named article title within a specific regulation", () => {
    const query = "SK미래관 대관에 관한 내규에서 대관 허가 및 제한은 어떻게 하나요?";
    const result = rankArticlesForQuestion(
      [
        createArticle(1, "SK미래관 대관에 관한 내규", "제4조", "대관 허가 및 제한", "대관의 허가와 제한 사유를 정한다."),
        createArticle(2, "SK미래관 대관에 관한 내규", "제6조", "대관 신청", "대관을 신청하려는 자는 신청서를 제출한다."),
        createArticle(3, "공간대관규정", "제6조", "대관 신청 및 승인", "공간 대관 신청과 승인 절차를 정한다."),
      ],
      query,
      expandQuery(query),
      3,
    );

    expect(result.articles[0].id).toBe(1);
    expect(result.articles[0].relevance?.group).toBe("primary");
  });

  it("does not add generic procedure hints without a known regulation topic", () => {
    const expanded = expandQuery("외계인이 침공하면 어떻게 해야하나요?");

    expect(expanded.intent).toBe("procedure");
    expect(expanded.keywords).toEqual(expect.arrayContaining(["외계인", "침공"]));
    expect(expanded.keywords).not.toEqual(expect.arrayContaining(["신청", "제출", "기간", "서류", "원서", "승인", "접수기간"]));
  });

  it("treats graduate-student withdrawal as a graduate academic procedure", () => {
    const expanded = expandQuery("대학원생의 자퇴 방법은?");
    const result = rankArticlesForQuestion(
      [
        createArticle(1, "대학원학칙 일반대학원 시행세칙", "제19조", "자퇴", "자퇴를 하려는 자는 자퇴원을 제출하여야 한다."),
        createArticle(2, "대학원학칙", "제14조", "자퇴", "자퇴를 원하는 학생에 대해서는 제적을 허가할 수 있다."),
        createArticle(3, "고려대학교 BK21 FOUR", "제13조", "참여대학원생에 대한 지원", "지원을 받은 대학원생은 휴학이나 자퇴 등으로 자격 요건에 변동이 있으면 지원액을 반환하여야 한다."),
        createArticle(4, "경영대학 고경(면학)장학금 지급 내규", "제3조", "신청기간 및 신청서류", "장학금을 신청하려는 자는 서류를 제출하여야 한다."),
      ],
      "대학원생의 자퇴 방법은?",
      expanded,
      4,
    );

    expect(expanded.keywords).toEqual(expect.arrayContaining(["대학원", "자퇴", "자퇴원"]));
    expect(expanded.requiredTerms).toEqual(expect.arrayContaining(["대학원", "자퇴"]));
    expect(result.articles.slice(0, 2).map((article) => article.id)).toEqual([1, 2]);
    expect(result.articles[0].relevance?.group).toBe("primary");
    expect(result.articles.find((article) => article.id === 3)?.relevance?.group).not.toBe("primary");
    expect(result.articles.find((article) => article.id === 4)?.relevance?.group).toBe("low_relevance");
  });

  it("keeps procedure questions focused on the procedure topic", () => {
    const result = rankArticlesForQuestion(
      [
        createArticle(1, "학사운영 규정", "제31조", "복학의 신청", "복학하려는 학생은 정해진 기간에 복학을 신청한다."),
        createArticle(2, "학사운영 규정", "제32조", "군전역 후의 복학", "군전역 복학원서와 전역증 사본을 제출한다."),
        createArticle(3, "포상규정", "제4조", "포상의 방법", "포상의 방법으로 상장 또는 표창장을 지급할 수 있다."),
        createArticle(4, "구매 규정", "제6조", "계약의 방법", "계약자를 선정하는 방법을 정한다."),
      ],
      "복학하는 방법을 알려줘",
      expandQuery("복학하는 방법을 알려줘"),
      4,
    );

    expect(result.articles.slice(0, 2).map((article) => article.id)).toEqual([1, 2]);
    expect(result.articles.find((article) => article.id === 3)?.relevance?.group).toBe("low_relevance");
    expect(result.articles.find((article) => article.id === 4)?.relevance?.group).toBe("low_relevance");
  });

  it("prioritizes 학사운영 규정 for undergraduate military leave procedures", () => {
    const result = rankArticlesForQuestion(
      [
        createArticle(
          1,
          "학사운영 규정",
          "제29조",
          "군입대 휴학",
          "군입대를 하려는 학생은 입영일 전에 입영통지서 또는 소집통지서를 첨부하여 군입대 휴학원을 제출하여야 한다.",
        ),
        createArticle(
          2,
          "보건과학대학 바이오의공학부 신임교원 책임수업시간 감면 내규",
          "제4조",
          "감면 신청",
          "신임교원은 매 학기 소정의 기간에 서류를 학부장에게 제출한다.",
        ),
        createArticle(
          3,
          "일반 Tutorial 운영 지침",
          "제6조",
          "신청 및 승인 절차",
          "Tutorial은 매 학기 지정된 기간에 신청하여야 하며 신청서류를 제출한다.",
        ),
        createArticle(
          4,
          "학사운영 규정",
          "제32조",
          "군전역 후의 복학",
          "군입대 휴학생은 전역일로부터 1년 이내에 군전역 복학원서와 전역증 사본을 제출한다.",
        ),
      ],
      "미래모빌리티학과 학부생의 군입대는 어떻게 진행해야 하나요?",
      expandQuery("미래모빌리티학과 학부생의 군입대는 어떻게 진행해야 하나요?"),
      4,
    );

    expect(result.articles[0].id).toBe(1);
    expect(result.articles[0].relevance?.group).toBe("primary");
    expect(result.articles.find((article) => article.id === 2)?.relevance?.group).toBe("out_of_scope");
    expect(result.articles.find((article) => article.id === 3)?.relevance?.group).toBe("low_relevance");
    expect(result.articles.find((article) => article.id === 4)?.relevance?.group).not.toBe("primary");
  });

  it("prioritizes first-semester undergraduate military leave eligibility rules", () => {
    const query = "학부생이 입학하자마자 군휴학 할 수 있나?";
    const expanded = expandQuery(query);
    const result = rankArticlesForQuestion(
      [
        createArticle(
          1,
          "학사운영 규정",
          "제29조",
          "군입대 휴학",
          "군입대를 하려는 학생은 입영일 전에 입영통지서를 첨부하여 군입대 휴학원을 제출하여야 한다.",
        ),
        createArticle(
          2,
          "학사운영 규정",
          "제30조",
          "휴학의 제한",
          "신입생, 편입학생, 재입학생은 임신·출산·육아, 질병, 군입대 또는 재난·감염병 휴학 외의 사유로는 입학 후 첫 학기에 휴학을 할 수 없다.",
        ),
        createArticle(
          3,
          "학사운영 규정",
          "제24조",
          "휴학의 분류",
          "특별휴학의 종류에는 군입대 휴학이 포함되며 군복무로 인한 휴학은 의무복무기간에 한한다.",
        ),
        createArticle(
          4,
          "학사운영 규정",
          "제56조",
          "졸업의 기본요건",
          "휴학 중에는 졸업요건을 충족하더라도 졸업할 수 없다.",
        ),
      ],
      query,
      expanded,
      4,
    );

    expect(expanded.intent).toBe("eligibility");
    expect(expanded.queryIntent.scope).toBe("학부");
    expect(expanded.keywords).toEqual(expect.arrayContaining(["학부", "군입대", "군입대휴학", "휴학", "신입생", "휴학의제한"]));
    expect(expanded.requiredTerms).toContain("군입대");
    expect(expanded.requiredTerms).not.toEqual(expect.arrayContaining(["군휴학", "입학하자마자", "있나"]));
    expect(result.articles.slice(0, 2).map((article) => article.id)).toEqual(expect.arrayContaining([1, 2]));
    expect(result.articles.find((article) => article.id === 1)?.relevance?.group).toBe("primary");
    expect(result.articles.find((article) => article.id === 2)?.relevance?.group).toBe("primary");
    expect(result.articles.find((article) => article.id === 4)?.relevance?.group).toBe("low_relevance");
  });

  it("prioritizes scoped regulation-name questions over broad topic matches", () => {
    const result = rankArticlesForQuestion(
      [
        createArticle(1, "일반대학원 장학금 지급 세칙", "제1조", "목적", "일반대학원 장학생 선정과 장학금 지급에 관한 사항을 정한다."),
        createArticle(2, "일반대학원 장학금 지급 세칙", "제4조", "지급대상 등", "장학금의 지급대상은 과정별 수업연한 내 대학원 재학생을 원칙으로 한다."),
        createArticle(3, "장학금 지급 규정", "제15조", "일반대학원 장학금", "일반대학원 장학금에 대한 세부사항은 일반대학원 장학금 지급 세칙으로 정한다."),
        createArticle(4, "교육대학원 장학금 지급세칙", "제4조", "수혜 대상 및 장학 금액", "교육대학원 장학금은 정규학기 등록자를 대상으로 한다."),
        createArticle(5, "세종SW중심대학사업단 장학금 지급 내규", "제9조", "장학금 절차", "장학금 지급 시 절차에 따라 진행한다."),
      ],
      "일반대학원 장학금 규정",
      expandQuery("일반대학원 장학금 규정"),
      5,
    );

    expect(result.articles.slice(0, 3).map((article) => article.id)).toEqual(expect.arrayContaining([1, 2, 3]));
    expect(result.articles.find((article) => article.id === 4)?.relevance?.group).toBe("out_of_scope");
    expect(result.articles.find((article) => article.id === 5)?.relevance?.group).toBe("out_of_scope");
  });

  it("distinguishes 제76조의2 from 제76조", () => {
    const result = rankArticlesForQuestion(
      [
        createArticle(1, "테스트 규정", "제76조", "휴학", "휴학 본문"),
        createArticle(2, "테스트 규정", "제76조의2", "복학", "복학 본문"),
      ],
      "제76조의2",
      expandQuery("제76조의2"),
      2,
    );

    expect(result.articles[0].id).toBe(2);
  });

  it("keeps broad scholarship searches diverse", () => {
    const result = rankArticlesForQuestion(
      [
        createArticle(1, "A 장학금 지급 내규", "제1조", "목적", "장학금 목적"),
        createArticle(2, "A 장학금 지급 내규", "제2조", "대상", "장학금 대상"),
        createArticle(3, "A 장학금 지급 내규", "제3조", "절차", "장학금 절차"),
        createArticle(4, "B 장학금 지급 내규", "제1조", "목적", "장학금 목적"),
        createArticle(5, "C 장학금 지급 내규", "제1조", "목적", "장학금 목적"),
      ],
      "장학금",
      expandQuery("장학금"),
      4,
    );

    const regulationNames = result.articles.map((article) => article.regulation_name);
    expect(regulationNames.filter((name) => name === "A 장학금 지급 내규")).toHaveLength(2);
    expect(new Set(regulationNames).size).toBeGreaterThan(1);
  });

  it("keeps broad leave-duration questions focused on high-authority rules first", () => {
    const result = rankArticlesForQuestion(
      [
        createArticle(1, "학사운영 규정", "제23조", "휴학의 신청·허가 및 기간", "휴학은 학기 또는 1년 단위로 하며 휴학기간은 통산 4년을 초과할 수 없다."),
        createArticle(2, "대학원학칙 일반대학원 시행세칙", "제17조", "휴학기간", "휴학연한은 석사과정 2년, 박사과정 및 석·박사통합과정 3년으로 한다."),
        createArticle(3, "대학원학칙 창업경영대학원 시행세칙", "제8조", "휴학기간", "휴학은 학기 또는 1년 단위로 할 수 있으며 통산 휴학기간은 4학기로 한다."),
        createArticle(4, "법학전문대학원 운영 규정", "제11조", "휴학의 신청, 휴학기간", "석사과정 학생의 휴학기간은 통산 2년을 넘을 수 없다."),
        createArticle(5, "창업휴학 운영지침", "제3조", "창업휴학 기간", "창업휴학의 기본 허용 기간은 3년(6학기)으로 한다."),
      ],
      "일반휴학은 얼마나 가능한가요?",
      expandQuery("일반휴학은 얼마나 가능한가요?"),
      5,
    );

    expect(result.articles.slice(0, 2).map((article) => article.id)).toEqual(expect.arrayContaining([1, 2]));
    expect(result.articles.find((article) => article.id === 3)?.relevance?.group).not.toBe("primary");
    expect(result.articles.find((article) => article.id === 4)?.relevance?.group).not.toBe("primary");
    expect(result.articles.find((article) => article.id === 5)?.relevance?.group).not.toBe("primary");
  });
});

function createArticle(
  id: number,
  regulationName: string,
  articleNo: string,
  articleTitle: string | null,
  articleBody: string,
): ArticleRecord {
  return {
    id,
    regulation_id: id,
    regulation_name: regulationName,
    article_no: articleNo,
    article_title: articleTitle,
    article_body: articleBody,
    seq: null,
    seq_history: id,
    seq_contents: id,
    source_url: "https://example.test",
    fetched_at: "2026-01-01T00:00:00.000Z",
  };
}
