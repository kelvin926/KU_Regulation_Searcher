import type { QueryScopeOption } from "../../shared/types";

export const QUERY_SCOPE_SELECT_OPTIONS: Array<{ value: QueryScopeOption; label: string }> = [
  { value: "auto", label: "자동 판단" },
  { value: "undergraduate", label: "학부생" },
  { value: "general_graduate", label: "일반대학원" },
  { value: "professional_special_graduate", label: "전문·특수대학원" },
  { value: "faculty", label: "교원/교수" },
  { value: "staff_assistant", label: "직원/조교" },
  { value: "seoul", label: "서울캠퍼스" },
  { value: "sejong", label: "세종캠퍼스" },
  { value: "other", label: "기타" },
];

export function formatQueryScopeOption(value: QueryScopeOption | null | undefined): string {
  return QUERY_SCOPE_SELECT_OPTIONS.find((option) => option.value === value)?.label ?? "자동 판단";
}
