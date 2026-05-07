import { describe, expect, it } from "vitest";
import { detectQueryLanguage, resolveQueryLanguage } from "./query-language";

describe("query-language", () => {
  it("detects Korean, English, Chinese, and mixed questions", () => {
    expect(detectQueryLanguage("학부생이 군휴학 할 수 있나요?")).toBe("ko");
    expect(detectQueryLanguage("Can undergraduate students take military leave?")).toBe("en");
    expect(detectQueryLanguage("研究生如何申请退学？")).toBe("zh");
    expect(detectQueryLanguage("Can 대학원생 withdraw?")).toBe("en");
  });

  it("honors manual language selection over auto detection", () => {
    expect(resolveQueryLanguage("학부생이 군휴학 할 수 있나요?", "en")).toBe("en");
    expect(resolveQueryLanguage("Can undergraduate students take military leave?", "auto")).toBe("en");
  });
});
