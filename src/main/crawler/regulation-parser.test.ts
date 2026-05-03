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

  it("stores unnumbered guidelines as a searchable body article", () => {
    const parsed = parseRegulationHtml(
      `
      <html>
        <body>
          <div class="lawname">법학전문대학원 종합시험 시행지침</div>
          <div class="none">1. 시행목적</div>
          <div class="none">법학전문석사학위 취득을 위한 기초학력을 측정함.</div>
          <div class="none">2. 학위취득과의 관계</div>
          <div class="none">종합시험의 합격은 학위 취득요건임.</div>
        </body>
      </html>
      `,
      "fallback",
    );

    expect(parsed.articles).toHaveLength(1);
    expect(parsed.articles[0].articleNo).toBe("본문");
    expect(parsed.articles[0].articleBody).toContain("시행목적");
    expect(parsed.articles[0].articleBody).toContain("학위 취득요건");
  });

  it("keeps department notices instead of failing as empty", () => {
    const parsed = parseRegulationHtml(
      `
      <html>
        <body>
          <div class="lawname">법학전문대학원 교원 교내연구비 등에 관한 규정</div>
          <div class="none">주관부서의 요청에 따라 해당 규정은 규정집에 미등재하므로 주관부서에 문의하시기 바랍니다.</div>
        </body>
      </html>
      `,
      "fallback",
    );

    expect(parsed.articles).toHaveLength(1);
    expect(parsed.articles[0].articleNo).toBe("안내");
    expect(parsed.articles[0].articleTitle).toBe("미등재 안내");
  });

  it("describes file-only regulations from no-document pages", () => {
    const parsed = parseRegulationHtml(
      `
      <html>
        <body>
          <div class="nodoc_topwrap">
            <div class="root_info_nodoc">HOME &gt; 규정 &gt; 1편 &gt; <strong>1-0-1 학교법인 고려중앙학원 정관</strong></div>
            <h4>1-0-1 학교법인 고려중앙학원 정관</h4>
          </div>
          <div class="btn_box btn_box_nodoc">
            <a href="javascript:fileDown('2476', 'ori');">전문다운</a>
            <a href="/lmxdata/hwp/2026/2/sample.pdf">PDF 다운</a>
          </div>
        </body>
      </html>
      `,
      "1-0-1 학교법인 고려중앙학원 정관",
    );

    expect(parsed.articles).toHaveLength(1);
    expect(parsed.articles[0].articleNo).toBe("원문");
    expect(parsed.articles[0].articleBody).toContain("HWP/PDF 원문 파일");
  });

  it("describes full-view pages with downloads but empty content frames as file-only regulations", () => {
    const parsed = parseRegulationHtml(
      `
      <html>
        <body>
          <div class="rule_subject">
            <div class="Stit">4단계 BK21 전기전자공학교육연구단 운영 내규</div>
          </div>
          <div class="btn_box">
            <a href="javascript:fileDown('1795', 'ori');">전문다운</a>
            <a href="javascript:fileDown('1795', 'oriPdf');">PDF 다운</a>
          </div>
          <div id="lawcon2" class="on">
            <iframe src="/lmxsrv/law/lawFullContent.do?SEQ=1168&SEQ_HISTORY=1795#" id="lawDetailContent" name="lawFullContent"></iframe>
          </div>
        </body>
      </html>
      `,
      "4단계 BK21 전기전자공학교육연구단 운영 내규",
    );

    expect(parsed.articles).toHaveLength(1);
    expect(parsed.articles[0].articleNo).toBe("원문");
    expect(parsed.articles[0].articleBody).toContain("로컬 검색 DB에는 이 규정의 원문 전문이 저장되지 않았습니다.");
  });

  it("does not store processing placeholders as regulation content", () => {
    const parsed = parseRegulationHtml(
      `
      <html>
        <body>
          <p>고려대학교 규정관리시스템 처리 중 입니다. 잠시만 기다려 주십시오.</p>
        </body>
      </html>
      `,
      "fallback",
    );

    expect(parsed.articles).toHaveLength(0);
  });
});
