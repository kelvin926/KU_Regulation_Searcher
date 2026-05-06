import type { ExpandedQuery } from "./query-expander";

export interface SearchQueryPlan {
  variants: string[];
  isCompound: boolean;
}

const MAX_VARIANTS = 10;

export function createSearchQueryPlan(query: string): SearchQueryPlan {
  const compactQuery = compact(query);
  const variants = new Set<string>();
  addVariant(variants, query);

  if (isStudentCouncilQuery(compactQuery)) {
    addStudentCouncilVariants(variants, compactQuery);
  }

  if (isEnglishLectureQuestion(compactQuery)) {
    addEnglishLectureVariants(variants);
  }

  if (isMilitaryLeaveTransitionQuestion(compactQuery)) {
    addMilitaryLeaveTransitionVariants(variants);
  }

  if (isGraduateWithdrawalQuestion(compactQuery)) {
    addVariant(variants, "대학원학칙 일반대학원 시행세칙 자퇴 자퇴원");
    addVariant(variants, "대학원학칙 자퇴 제적 허가");
  }

  const variantList = Array.from(variants).slice(0, MAX_VARIANTS);
  return {
    variants: variantList,
    isCompound: variantList.length > 1 || isCompoundQuestion(compactQuery),
  };
}

export function mergeExpandedQueries(base: ExpandedQuery, variants: ExpandedQuery[], isCompound: boolean): ExpandedQuery {
  const keywords = unique([...base.keywords, ...variants.flatMap((variant) => variant.keywords)]).slice(0, 48);
  const optionalTerms = unique([...base.optionalTerms, ...variants.flatMap((variant) => variant.optionalTerms)]).slice(0, 48);
  const scopeKeywords = unique([...base.scopeKeywords, ...variants.flatMap((variant) => variant.scopeKeywords)]).slice(0, 8);
  const coreKeywords = unique([...base.coreKeywords, ...variants.flatMap((variant) => variant.coreKeywords)]).slice(0, 18);

  return {
    ...base,
    keywords,
    optionalTerms,
    scopeKeywords,
    coreKeywords,
    auxiliaryKeywords: optionalTerms,
    requiredTerms: isCompound ? pruneCompoundRequiredTerms(base.requiredTerms) : base.requiredTerms,
    ftsQuery: buildFtsQuery(keywords),
  };
}

function addStudentCouncilVariants(variants: Set<string>, compactQuery: string): void {
  addVariant(variants, "총학생회칙 안암총학생회 안암캠퍼스 회원 소재지 기구");
  addVariant(variants, "고려대학교 학칙 학생자치활동 총학생회 학생자치단체");
  addVariant(variants, "대학원학칙 일반대학원 시행세칙 대학원총학생회");

  if (compactQuery.includes("세종")) {
    addVariant(variants, "세종캠퍼스 총학생회 학생생활지원팀 총학생회 지원");
    addVariant(variants, "세종캠퍼스 위원회 총학생회 추천 위원 임기");
  }
  if (/(서울|안암)/u.test(compactQuery)) {
    addVariant(variants, "안암총학생회 총학생회칙 안암캠퍼스 학부과정");
  }
}

function addEnglishLectureVariants(variants: Set<string>): void {
  addVariant(variants, "외국어강의에 관한 규정 영어강의 외국어강의");
  addVariant(variants, "신임교원 책임수업시간 감면 내규 영어강의 외국어강의");
  addVariant(variants, "신임교원 감면 교과목 영어강의 의무 외국어강의");
  addVariant(variants, "교원 책임수업시간 외국어강의 영어강의");
}

function addMilitaryLeaveTransitionVariants(variants: Set<string>): void {
  addVariant(variants, "학사운영 규정 군입대 휴학 입영 소집 취소 연기 사유 소멸");
  addVariant(variants, "학사운영 규정 휴학의 분류 일반휴학 특별휴학 군입대");
  addVariant(variants, "학사운영 규정 특별휴학의 기간 군입대 일반휴학 의무복무기간");
  addVariant(variants, "학사운영 규정 휴학의 신청 허가 기간 일반휴학 휴학원");
}

function isStudentCouncilQuery(compactQuery: string): boolean {
  return /(총학생회|학생회칙|학생자치)/u.test(compactQuery);
}

function isEnglishLectureQuestion(compactQuery: string): boolean {
  return /(영강|영어강의|외국어강의|외국어강좌)/u.test(compactQuery) && /(신임|교수|교원|책임수업|의무)/u.test(compactQuery);
}

function isMilitaryLeaveTransitionQuestion(compactQuery: string): boolean {
  return (
    /(군휴학|군입대|군입대휴학|입대휴학|군복무|병역|입영|소집)/u.test(compactQuery) &&
    /(일반휴학|일반휴학으로|전환|변경|취소|연기|소멸|냈다가|바꾸|돌리)/u.test(compactQuery)
  );
}

function isGraduateWithdrawalQuestion(compactQuery: string): boolean {
  return compactQuery.includes("대학원") && compactQuery.includes("자퇴");
}

function isCompoundQuestion(compactQuery: string): boolean {
  return /(차이|비교|다른점|전환|변경|취소|연기|소멸|냈다가|동시에|함께|및|와|과|랑|하고|vs)/iu.test(compactQuery);
}

function pruneCompoundRequiredTerms(requiredTerms: string[]): string[] {
  return requiredTerms.filter((term) => /^(학부|일반대학원|전문대학원|특수대학원|교육대학원|법학전문대학원)$/u.test(term));
}

function addVariant(variants: Set<string>, rawValue: string): void {
  const value = rawValue.replace(/\s+/g, " ").trim();
  if (value.length >= 2) variants.add(value);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function compact(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

function buildFtsQuery(keywords: string[]): string {
  return keywords
    .map((keyword) => `"${keyword.replace(/"/g, '""')}"`)
    .join(" OR ");
}
