import { describe, expect, it } from "vitest";
import { buildLocalKoreanQueryVariants } from "./multilingual-glossary";

describe("multilingual glossary", () => {
  it("expands English academic leave and withdrawal questions into Korean regulation terms", () => {
    const militaryLeave = buildLocalKoreanQueryVariants(
      "Can undergraduate students take military leave in their first semester?",
      "en",
    ).join(" ");
    const withdrawal = buildLocalKoreanQueryVariants("How can a graduate student withdraw from the university?", "en").join(" ");

    expect(militaryLeave).toContain("군입대");
    expect(militaryLeave).toContain("신입생");
    expect(militaryLeave).toContain("휴학의제한");
    expect(militaryLeave).not.toContain("일반대학원");
    expect(withdrawal).toContain("대학원학칙");
    expect(withdrawal).toContain("자퇴원");
  });

  it("expands English lecture and student council questions", () => {
    const lecture = buildLocalKoreanQueryVariants("What is the English lecture obligation for newly appointed professors?", "en").join(
      " ",
    );
    const council = buildLocalKoreanQueryVariants(
      "What is the difference between the Seoul student council and Sejong student council?",
      "en",
    ).join(" ");

    expect(lecture).toContain("신임교원");
    expect(lecture).toContain("영어강의");
    expect(lecture).toContain("책임수업시간");
    expect(council).toContain("총학생회");
    expect(council).toContain("서울");
    expect(council).toContain("세종");
  });

  it("expands Chinese graduate and military-leave transition questions", () => {
    const transition = buildLocalKoreanQueryVariants("未来移动学科学生服兵役休学后想转为普通休学，应该怎么处理？", "zh").join(" ");
    const withdrawal = buildLocalKoreanQueryVariants("研究生如何申请退学？", "zh").join(" ");

    expect(transition).toContain("미래모빌리티학과");
    expect(transition).toContain("군입대");
    expect(transition).toContain("일반휴학");
    expect(transition).toContain("사유 소멸");
    expect(withdrawal).toContain("일반대학원");
    expect(withdrawal).toContain("자퇴원");
  });
});
