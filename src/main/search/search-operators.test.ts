import { describe, expect, it } from "vitest";
import { parseSearchOperators } from "./search-operators";

describe("search operators", () => {
  it("parses quoted phrases, OR, and excluded terms", () => {
    const parsed = parseSearchOperators('"일반휴학" OR 복학 -군입대 NOT 창업');

    expect(parsed.anyTerms).toEqual(["일반휴학", "복학"]);
    expect(parsed.excludeTerms).toEqual(["군입대", "창업"]);
    expect(parsed.highlightTerms).toEqual(["일반휴학", "복학"]);
    expect(parsed.hasOperators).toBe(true);
  });
});
