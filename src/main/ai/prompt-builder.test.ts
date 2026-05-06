import { describe, expect, it } from "vitest";
import type { ArticleRecord } from "../../shared/types";
import { buildPolicyAnswerPrompt } from "./prompt-builder";

describe("prompt builder", () => {
  it("compacts very long evidence while preserving article identity", () => {
    const longBody = `${"앞 문장입니다. ".repeat(260)}\n\n${"중간 문장입니다. ".repeat(260)}\n\n${"뒤 문장입니다. ".repeat(160)}`;
    const prompt = buildPolicyAnswerPrompt({
      question: "긴 조항 테스트",
      articles: [createArticle(longBody)],
    });

    expect(prompt).toContain("[ARTICLE_ID: 1]");
    expect(prompt).toContain("규정명: 테스트 규정");
    expect(prompt).toContain("[중략: 긴 조항 본문");
    expect(prompt).toContain("답변에는 제공된 조항 안에서 확인되는 내용만 사용할 것");
  });
});

function createArticle(articleBody: string): ArticleRecord {
  return {
    id: 1,
    regulation_id: 1,
    regulation_name: "테스트 규정",
    article_no: "제1조",
    article_title: "긴 조항",
    article_body: articleBody,
    seq: null,
    seq_history: 1,
    seq_contents: 1,
    source_url: "https://example.test",
    fetched_at: "2026-01-01T00:00:00.000Z",
  };
}
