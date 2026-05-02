import { describe, expect, it } from "vitest";
import { expandQuery } from "./query-expander";

describe("query expander", () => {
  it("adds synonym groups and direct article numbers", () => {
    const expanded = expandQuery("일반휴학은 제76조의2와 관련 있나요?");
    expect(expanded.keywords).toContain("휴학");
    expect(expanded.keywords).toContain("군휴학");
    expect(expanded.keywords).toContain("제76조의2");
    expect(expanded.ftsQuery).toContain('"제76조의2"');
  });

  it("drops generic question words that create irrelevant matches", () => {
    const expanded = expandQuery("고려대에서 학생이 우주선을 빌릴 수 있나요?");
    expect(expanded.keywords).toEqual(["우주선"]);
  });
});
