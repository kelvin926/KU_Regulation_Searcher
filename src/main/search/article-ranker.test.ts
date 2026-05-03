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
