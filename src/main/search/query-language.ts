import type { DetectedQueryLanguage, QueryLanguageOption } from "../../shared/types";

export function detectQueryLanguage(query: string): DetectedQueryLanguage {
  const hangulCount = countMatches(query, /[\uac00-\ud7af]/gu);
  const hanCount = countMatches(query, /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/gu);
  const latinCount = countMatches(query, /[A-Za-z]/gu);

  if (hanCount > 0 && hangulCount === 0) return "zh";
  if (latinCount >= 8 && latinCount >= hangulCount * 1.5 + hanCount) return "en";
  if (hangulCount > 0 && hangulCount >= Math.max(2, hanCount)) return "ko";
  if (latinCount > 0 && latinCount >= hangulCount + hanCount) return "en";
  if (hanCount > 0) return "zh";
  return "ko";
}

export function resolveQueryLanguage(query: string, option?: QueryLanguageOption | null): DetectedQueryLanguage {
  if (option && option !== "auto") return option;
  return detectQueryLanguage(query);
}

export function isNonKoreanLanguage(language: DetectedQueryLanguage): boolean {
  return language === "en" || language === "zh";
}

export function formatDetectedLanguage(language: DetectedQueryLanguage): string {
  switch (language) {
    case "en":
      return "영어";
    case "zh":
      return "중국어";
    case "ko":
      return "한국어";
  }
}

function countMatches(value: string, regex: RegExp): number {
  return Array.from(value.matchAll(regex)).length;
}
