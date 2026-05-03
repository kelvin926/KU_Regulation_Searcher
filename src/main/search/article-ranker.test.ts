import { describe, expect, it } from "vitest";
import type { ArticleRecord } from "../../shared/types";
import { rankArticlesForQuestion } from "./article-ranker";

describe("rankArticlesForQuestion", () => {
  it("prioritizes leave duration rules over generic matches", () => {
    const result = rankArticlesForQuestion(
      [
        createArticle(1, "일반 Tutorial 운영 지침", "제1조", "목적", "일반 Tutorial 운영에 관한 사항"),
        createArticle(2, "안암학사 규정", "제23조", "관리비 반환", "일반 휴학 중 질병 휴학의 경우 위약금을 공제하지 않는다."),
        createArticle(3, "대학원학칙 창업경영대학원 시행세칙", "제8조", "휴학기간", "휴학은 학기 또는 1년 단위로 할 수 있으며, 통산 휴학기간은 4학기로 한다."),
      ],
      "일반 휴학은 몇학기까지 가능한가요?",
      ["휴학", "일반휴학", "휴학기간", "통산", "학기"],
      3,
    );

    expect(result.articles[0].id).toBe(3);
  });

  it("prioritizes exact scholarship regulations over broad scholarship matches", () => {
    const result = rankArticlesForQuestion(
      [
        createArticle(1, "교육대학원 장학금 지급세칙", "제4조", "수혜 대상 및 장학 금액", "장학금은 정규학기 등록자를 대상으로 한다."),
        createArticle(2, "일반대학원 장학금 지급 세칙", "제1조", "목적", "일반대학원 장학생 선정과 장학금 지급에 관한 사항을 정한다."),
        createArticle(3, "삼성디스플레이 Display Track 장학금 지급 내규", "제11조", "장학금 구분", "일반대학원 장학금은 운영보조대학원장학금으로 한다."),
      ],
      "일반대학원 장학금 규정",
      {
        ftsQuery: "",
        keywords: ["일반대학원", "장학금", "장학"],
        requiredTerms: ["일반대학원", "장학금"],
        optionalTerms: ["장학"],
        intent: "scholarship",
      },
      3,
    );

    expect(result.articles[0].id).toBe(2);
  });

  it("prioritizes procedure articles over generic method articles", () => {
    const result = rankArticlesForQuestion(
      [
        createArticle(1, "구매 규정", "제6조", "계약의 방법", "계약자를 선정하는 방법을 정한다."),
        createArticle(2, "대학원학칙 일반대학원 시행세칙", "제18조", "복학", "복학하려는 자는 소정기일 내에 복학원을 제출하여야 한다."),
        createArticle(3, "포상규정", "제4조", "포상의 방법", "포상의 방법을 정한다."),
      ],
      "복학하는 방법을 알려줘",
      {
        ftsQuery: "",
        keywords: ["복학", "복학신청", "제출", "원서"],
        requiredTerms: ["복학"],
        optionalTerms: ["복학신청", "제출", "원서"],
        intent: "procedure",
      },
      3,
    );

    expect(result.articles[0].id).toBe(2);
  });

  it("reports when more local candidates exist than the visible limit", () => {
    const result = rankArticlesForQuestion(
      [createArticle(1), createArticle(2), createArticle(3)],
      "휴학",
      ["휴학"],
      2,
    );

    expect(result.candidateLimitReached).toBe(true);
    expect(result.searchedCandidateCount).toBe(3);
    expect(result.articles).toHaveLength(2);
  });
});

function createArticle(
  id: number,
  regulationName = "테스트 규정",
  articleNo = `제${id}조`,
  articleTitle: string | null = "휴학",
  articleBody = "휴학 관련 본문",
): ArticleRecord {
  return {
    id,
    regulation_id: 1,
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
