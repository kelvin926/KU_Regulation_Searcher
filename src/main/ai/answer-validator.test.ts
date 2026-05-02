import { describe, expect, it } from "vitest";
import type { ArticleRecord } from "../../shared/types";
import { parseAndValidateAnswer } from "./answer-validator";

const candidates: ArticleRecord[] = [
  {
    id: 1,
    regulation_id: 1,
    regulation_name: "테스트 규정",
    article_no: "제5조",
    article_title: "휴학",
    article_body: "휴학 본문",
    seq: null,
    seq_history: 100,
    seq_contents: 1,
    source_url: "https://example.test",
    fetched_at: "2026-01-01T00:00:00.000Z",
  },
];

describe("answer validator", () => {
  it("accepts grounded JSON answers", () => {
    const answer = parseAndValidateAnswer(
      JSON.stringify({
        answer: "제공된 고려대 규정 조항 기준 제5조에 따릅니다.",
        used_article_ids: [1],
        confidence: "high",
        missing_evidence: false,
        warnings: [],
      }),
      candidates,
    );

    expect(answer.verification.valid).toBe(true);
  });

  it("flags citations outside candidate articles", () => {
    const answer = parseAndValidateAnswer(
      JSON.stringify({
        answer: "제공된 고려대 규정 조항 기준 제9조도 확인됩니다.",
        used_article_ids: [1],
        confidence: "low",
        missing_evidence: false,
        warnings: [],
      }),
      candidates,
    );

    expect(answer.verification.valid).toBe(false);
    expect(answer.verification.unknownArticleNos).toEqual(["제9조"]);
  });

  it("infers missing used IDs from cited candidate article numbers", () => {
    const answer = parseAndValidateAnswer(
      JSON.stringify({
        answer: "제공된 고려대 규정 조항 기준 제5조에 따릅니다.",
        used_article_ids: [],
        confidence: "medium",
        missing_evidence: false,
        warnings: [],
      }),
      candidates,
    );

    expect(answer.used_article_ids).toEqual([1]);
    expect(answer.verification.valid).toBe(true);
  });
});
