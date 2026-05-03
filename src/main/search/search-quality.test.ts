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
      ],
      "일반휴학은 얼마나 가능한가요?",
      expandQuery("일반휴학은 얼마나 가능한가요?"),
      4,
    );

    expect(result.articles.slice(0, 2).map((article) => article.id)).toEqual(expect.arrayContaining([1, 2]));
    expect(result.articles.find((article) => article.id === 3)?.relevance?.group).not.toBe("primary");
    expect(result.articles.find((article) => article.id === 4)?.relevance?.group).not.toBe("primary");
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
