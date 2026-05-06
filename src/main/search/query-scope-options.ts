import type { QueryScopeOption } from "../../shared/types";
import type { QueryScope } from "./query-intent";

export function queryScopeFromOption(option?: QueryScopeOption): QueryScope | null {
  switch (option) {
    case "undergraduate":
      return "학부";
    case "general_graduate":
      return "일반대학원";
    case "professional_special_graduate":
      return "전문·특수대학원";
    case "faculty":
      return "교원";
    case "staff_assistant":
      return "직원·조교";
    case "seoul":
      return "서울캠퍼스";
    case "sejong":
      return "세종캠퍼스";
    case "other":
      return "기타";
    case "auto":
    case undefined:
      return null;
  }
}

export function scopedQueryPrefix(option?: QueryScopeOption): string | null {
  switch (option) {
    case "undergraduate":
      return "학부 학사운영 학칙";
    case "general_graduate":
      return "일반대학원 대학원학칙 일반대학원 시행세칙";
    case "professional_special_graduate":
      return "전문대학원 특수대학원 교육대학원 법학전문대학원 경영전문대학원 시행세칙";
    case "faculty":
      return "교원 교수 교원인사 신임교원";
    case "staff_assistant":
      return "직원 조교 직원인사 조교임용";
    case "seoul":
      return "서울캠퍼스 안암캠퍼스";
    case "sejong":
      return "세종캠퍼스";
    case "other":
      return "기타 내규 지침";
    case "auto":
    case undefined:
      return null;
  }
}

export function buildScopedSearchQuery(query: string, option?: QueryScopeOption): string {
  const prefix = scopedQueryPrefix(option);
  if (!prefix) return query;
  return `${prefix} ${query}`;
}
