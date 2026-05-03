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

  it("normalizes procedure questions to their domain term", () => {
    const expanded = expandQuery("복학하는 방법을 알려줘");
    expect(expanded.requiredTerms).toEqual(["복학"]);
    expect(expanded.keywords).toContain("복학");
    expect(expanded.keywords).toContain("복학신청");
    expect(expanded.keywords).toContain("제출");
    expect(expanded.coreKeywords).toContain("복학");
    expect(expanded.auxiliaryKeywords).toContain("제출");
    expect(expanded.keywords).not.toContain("복학하");
    expect(expanded.keywords).not.toContain("방법");
    expect(expanded.keywords).not.toContain("알려줘");
    expect(expanded.removedStopWords).toEqual(expect.arrayContaining(["방법", "알려줘"]));
    expect(expanded.intent).toBe("procedure");
  });

  it("keeps multiple concrete terms as strict requirements", () => {
    const expanded = expandQuery("일반대학원 장학금 규정");
    expect(expanded.requiredTerms).toEqual(["일반대학원", "장학금"]);
    expect(expanded.optionalTerms).toContain("장학");
    expect(expanded.intent).toBe("regulation_lookup");
    expect(expanded.queryIntent.scope).toBe("일반대학원");
  });

  it("treats condition wording as optional support instead of a strict requirement", () => {
    const expanded = expandQuery("학위청구논문 심사는 어떤 조건이 필요한가요?");
    expect(expanded.requiredTerms).toEqual(["학위청구논문", "심사"]);
    expect(expanded.optionalTerms).toContain("요건");
    expect(expanded.optionalTerms).toContain("자격");
    expect(expanded.keywords).not.toContain("조건");
    expect(expanded.removedStopWords).toContain("조건");
  });
});
