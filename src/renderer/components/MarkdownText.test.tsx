import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownText, parseMarkdownBlocks } from "./MarkdownText";

describe("MarkdownText", () => {
  it("renders bold text inside ordered AI answer lists", () => {
    const html = renderToStaticMarkup(<MarkdownText text={"1. **이수 학점 및 과목**: 전공필수 이수"} />);

    expect(html).toContain("<ol>");
    expect(html).toContain("<strong>이수 학점 및 과목</strong>");
    expect(html).not.toContain("**이수");
  });

  it("renders inline code and escapes raw html as text", () => {
    const html = renderToStaticMarkup(<MarkdownText text={"**주의**: `<제1조>` <script>alert(1)</script>"} />);

    expect(html).toContain("<strong>주의</strong>");
    expect(html).toContain("<code>&lt;제1조&gt;</code>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("keeps plain multiline answers readable as paragraphs", () => {
    expect(parseMarkdownBlocks("첫 문장\n둘째 문장\n\n- 항목")).toEqual([
      { type: "paragraph", lines: ["첫 문장", "둘째 문장"] },
      { type: "unordered-list", items: ["항목"] },
    ]);
  });
});
