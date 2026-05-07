import type { QueryCampusOption, QueryGroupOption } from "../../shared/types";
import type { QueryScope } from "./query-intent";

export function queryGroupFromOption(option?: QueryGroupOption): QueryScope | null {
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
    case "other":
      return "기타";
    case "auto":
    case undefined:
      return null;
  }
}

export function queryCampusFromOption(option?: QueryCampusOption): QueryScope | null {
  switch (option) {
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

export function scopedGroupPrefix(option?: QueryGroupOption): string | null {
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
    case "other":
      return "기타 내규 지침";
    case "auto":
    case undefined:
      return null;
  }
}

export function scopedCampusPrefix(option?: QueryCampusOption): string | null {
  switch (option) {
    case "seoul":
      return "서울캠퍼스 안암캠퍼스 서울";
    case "sejong":
      return "세종캠퍼스 세종";
    case "other":
      return "기타 캠퍼스 공통";
    case "auto":
    case undefined:
      return null;
  }
}

export function buildScopedSearchQuery(
  query: string,
  options: { group?: QueryGroupOption; campus?: QueryCampusOption } = {},
): string {
  const prefixes = [scopedCampusPrefix(options.campus), scopedGroupPrefix(options.group)].filter(Boolean);
  if (prefixes.length === 0) return query;
  return `${prefixes.join(" ")} ${query}`;
}
