import { describe, expect, it } from "vitest";
import { expandQuery } from "./query-expander";

describe("query expander", () => {
  it("adds synonym groups and direct article numbers", () => {
    const expanded = expandQuery("일반휴학은 제76조의2와 관련 있나요?");
    expect(expanded.keywords).toContain("휴학");
    expect(expanded.keywords).not.toContain("군휴학");
    expect(expanded.keywords).toContain("제76조의2");
    expect(expanded.ftsQuery).toContain('"제76조의2"');
  });

  it("keeps distinct university roles in separate synonym groups", () => {
    const expanded = expandQuery("조교 임용 기준");
    expect(expanded.keywords).toContain("교육조교");
    expect(expanded.keywords).toContain("연구조교");
    expect(expanded.keywords).not.toContain("교원");
    expect(expanded.keywords).not.toContain("직원");
  });

  it("drops generic question words that create irrelevant matches", () => {
    const expanded = expandQuery("고려대에서 학생이 우주선을 빌릴 수 있나요?");
    expect(expanded.keywords).toEqual(["우주선"]);
  });

  it("boosts leave duration terms without keeping generic 일반 as a standalone keyword", () => {
    const expanded = expandQuery("일반 휴학은 몇학기까지 가능한가요?");
    expect(expanded.keywords).toContain("휴학");
    expect(expanded.keywords).toContain("일반휴학");
    expect(expanded.keywords).toContain("휴학기간");
    expect(expanded.keywords).toContain("휴학연한");
    expect(expanded.keywords).toContain("통산");
    expect(expanded.keywords).not.toContain("일반");
    expect(expanded.keywords).not.toContain("몇학기");
  });
});
