import { describe, expect, it } from "vitest";
import { parseCustomRegulationBody } from "./custom-regulation-parser";

describe("parseCustomRegulationBody", () => {
  it("splits pasted custom regulation text by article headings", () => {
    const parsed = parseCustomRegulationBody(
      "미래모빌리티학과 운영 내규",
      "제1조(목적)\n이 내규는 학과 운영을 정한다.\n\n제2조의2 (군휴학 전환)\n군휴학 사유가 소멸된 학생은 일반휴학 전환을 신청한다.",
    );

    expect(parsed.articles).toHaveLength(2);
    expect(parsed.articles[0]).toMatchObject({
      articleNo: "제1조",
      articleTitle: "목적",
      articleBody: "이 내규는 학과 운영을 정한다.",
    });
    expect(parsed.articles[1]).toMatchObject({
      articleNo: "제2조의2",
      articleTitle: "군휴학 전환",
      articleBody: "군휴학 사유가 소멸된 학생은 일반휴학 전환을 신청한다.",
    });
  });

  it("stores text without article headings as one full-text article", () => {
    const parsed = parseCustomRegulationBody("학과 안내", "학과장은 필요한 경우 별도 절차를 안내한다.");

    expect(parsed.articles).toEqual([
      {
        articleNo: "전체",
        articleTitle: null,
        articleBody: "학과장은 필요한 경우 별도 절차를 안내한다.",
        seqContents: 1,
      },
    ]);
  });
});
