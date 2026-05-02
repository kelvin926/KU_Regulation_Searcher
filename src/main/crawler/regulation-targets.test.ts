import { describe, expect, it } from "vitest";
import { parseRegulationTargetsFromHtml } from "./regulation-targets";

describe("parseRegulationTargetsFromHtml", () => {
  it("extracts selectable regulation targets from links and onclick handlers", () => {
    const html = `
      <ul>
        <li><a href="/lmxsrv/law/lawFullView.do?SEQ=15&SEQ_HISTORY=2446">고려대학교 학칙</a></li>
        <li><a onclick="lawSearchFullView(17, 2482, 0)">학사운영 규정</a></li>
        <li><a href="/lmxsrv/law/lawFullContent.do?SEQ_HISTORY=2447">대학원학칙</a></li>
      </ul>
    `;

    const targets = parseRegulationTargetsFromHtml(html, "규정");

    expect(targets).toHaveLength(3);
    expect(targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          regulationName: "고려대학교 학칙",
          seq: 15,
          seqHistory: 2446,
          sourceUrl: expect.stringContaining("SEQ=15&SEQ_HISTORY=2446"),
          category: "규정",
        }),
        expect.objectContaining({
          regulationName: "학사운영 규정",
          seq: 17,
          seqHistory: 2482,
          sourceUrl: expect.stringContaining("SEQ=17&SEQ_HISTORY=2482"),
        }),
        expect.objectContaining({
          regulationName: "대학원학칙",
          seqHistory: 2447,
          sourceUrl: expect.stringContaining("SEQ_HISTORY=2447"),
        }),
      ]),
    );
  });

  it("deduplicates repeated SEQ_HISTORY values", () => {
    const html = `
      <a href="/lmxsrv/law/lawFullView.do?SEQ=15&SEQ_HISTORY=2446">고려대학교 학칙</a>
      <a href="/lmxsrv/law/lawFullContent.do?SEQ=15&SEQ_HISTORY=2446">고려대학교 학칙</a>
    `;

    const targets = parseRegulationTargetsFromHtml(html);

    expect(targets).toHaveLength(1);
    expect(targets[0].seqHistory).toBe(2446);
  });
});
