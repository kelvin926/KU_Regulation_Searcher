import { describe, expect, it } from "vitest";
import { buildSearchQueryNormalizerPrompt, parseNormalizedSearchQueries } from "./search-query-normalizer";

describe("search query normalizer", () => {
  it("builds a JSON-only Korean-search prompt", () => {
    const prompt = buildSearchQueryNormalizerPrompt({
      question: "Can undergraduate students take military leave in their first semester?",
      language: "en",
    });

    expect(prompt).toContain("Return JSON only");
    expect(prompt).toContain("Write every query in Korean");
    expect(prompt).toContain("군입대 휴학");
  });

  it("parses normalizer JSON and ignores malformed fallback responses", () => {
    expect(parseNormalizedSearchQueries('{"queries":["학부 군입대 휴학","휴학의 제한 신입생"]}').queries).toEqual([
      "학부 군입대 휴학",
      "휴학의 제한 신입생",
    ]);
    expect(parseNormalizedSearchQueries("not json").queries).toEqual([]);
  });
});
