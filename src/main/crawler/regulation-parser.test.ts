import { describe, expect, it } from "vitest";
import { normalizeArticleNo, parseRegulationHtml } from "./regulation-parser";

describe("regulation parser", () => {
  it("normalizes base and branch article numbers", () => {
    expect(normalizeArticleNo("5")).toBe("제5조");
    expect(normalizeArticleNo("제5조")).toBe("제5조");
    expect(normalizeArticleNo("76의2")).toBe("제76조의2");
    expect(normalizeArticleNo("제76조의2")).toBe("제76조의2");
  });

  it("keeps 제76조 and 제76조의2 as separate articles and parses supplementary rules", () => {
    const parsed = parseRegulationHtml(
      `
      <html>
        <body>
          <div class="lawname">테스트 규정</div>
          <span>제76조 (휴학)</span>
          <div class="none"><span>① 휴학에 관한 본문입니다.</span></div>
          <span>제76조의2 (복학)</span>
          <div class="none"><span>① 복학에 관한 본문입니다.</span></div>
          <div class="buTitle">부칙</div>
          <div class="none"><span>이 규정은 공포한 날부터 시행한다.</span></div>
        </body>
      </html>
      `,
      "fallback",
    );

    expect(parsed.regulationName).toBe("테스트 규정");
    expect(parsed.articles.map((article) => article.articleNo)).toEqual(["제76조", "제76조의2", "부칙"]);
    expect(parsed.articles[0].articleTitle).toBe("휴학");
    expect(parsed.articles[1].articleBody).toContain("복학");
    expect(parsed.articles[2].articleBody).toContain("공포한 날");
  });
});
