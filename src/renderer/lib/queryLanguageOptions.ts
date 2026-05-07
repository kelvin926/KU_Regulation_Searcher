import type { DetectedQueryLanguage, QueryLanguageOption, TranslationSource } from "../../shared/types";

export const QUERY_LANGUAGE_SELECT_OPTIONS: Array<{ value: QueryLanguageOption; label: string }> = [
  { value: "auto", label: "자동 감지" },
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
];

export function formatQueryLanguageOption(value: QueryLanguageOption | null | undefined): string {
  return QUERY_LANGUAGE_SELECT_OPTIONS.find((option) => option.value === value)?.label ?? "자동 감지";
}

export function formatDetectedQueryLanguage(value: DetectedQueryLanguage | null | undefined): string {
  switch (value) {
    case "en":
      return "영어";
    case "zh":
      return "중국어";
    case "ko":
      return "한국어";
    case undefined:
    case null:
      return "자동 감지 전";
  }
}

export function formatTranslationSource(value: TranslationSource | null | undefined): string {
  switch (value) {
    case "local-glossary":
      return "로컬 용어집";
    case "ai-normalizer":
      return "AI 정규화";
    case "mixed":
      return "로컬+AI";
    case "none":
    case undefined:
    case null:
      return "없음";
  }
}
