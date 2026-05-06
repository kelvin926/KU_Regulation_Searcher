import type { ExpandedQuery } from "./query-expander";

export interface SearchQueryPlan {
  variants: string[];
  isCompound: boolean;
  routingNotes: string[];
}

const MAX_VARIANTS = 10;

export function createSearchQueryPlan(query: string): SearchQueryPlan {
  const compactQuery = compact(query);
  const variants = new Set<string>();
  const routingNotes = new Set<string>();
  addVariant(variants, query);

  if (!hasDirectRegulationName(query)) {
    addGenericRoutedVariants(variants, routingNotes, query, compactQuery);
  }

  if (isStudentCouncilQuery(compactQuery)) {
    addStudentCouncilVariants(variants, compactQuery);
    routingNotes.add("총학생회 비교/학생자치 질문으로 보고 캠퍼스별 근거를 함께 찾았습니다.");
  }

  if (isEnglishLectureQuestion(compactQuery)) {
    addEnglishLectureVariants(variants);
    routingNotes.add("영강을 영어강의/외국어강의 및 신임교원 책임수업시간 근거로 확장했습니다.");
  }

  if (isMilitaryLeaveTransitionQuestion(compactQuery)) {
    addMilitaryLeaveTransitionVariants(variants);
    routingNotes.add("군입대 휴학, 휴학 취소/사유 소멸, 일반휴학 근거를 분리해 찾았습니다.");
  }

  if (isGraduateWithdrawalQuestion(compactQuery)) {
    addVariant(variants, "대학원학칙 일반대학원 시행세칙 자퇴 자퇴원");
    addVariant(variants, "대학원학칙 자퇴 제적 허가");
    routingNotes.add("대학원생 자퇴 질문으로 보고 대학원학칙과 일반대학원 시행세칙을 우선 검색했습니다.");
  }

  const variantList = Array.from(variants).slice(0, MAX_VARIANTS);
  return {
    variants: variantList,
    isCompound: variantList.length > 1 || isCompoundQuestion(compactQuery),
    routingNotes: Array.from(routingNotes).slice(0, 4),
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

function addGenericRoutedVariants(
  variants: Set<string>,
  routingNotes: Set<string>,
  rawQuery: string,
  compactQuery: string,
): void {
  const scope = inferScopeTerm(compactQuery);
  const topics = inferTopicTerms(compactQuery);
  const units = inferSpecificUnitTerms(rawQuery);
  const hasKnownTopic = topics.length > 0;
  const procedure = /(방법|절차|신청|제출|진행|어떻게|해야|해야하지|하려면|원서|허가|승인)/u.test(compactQuery);
  const duration = /(몇학기|몇년|기간|연한|언제까지|최대|통산|초과|넘지)/u.test(compactQuery);
  const eligibility = /(가능|할수있|대상|자격|요건|조건|해당|제한|의무)/u.test(compactQuery);
  const comparison = /(차이|비교|다른점|vs)/iu.test(compactQuery);
  const transition = /(전환|변경|정정|취소|철회|연기|소멸|냈다가|바꾸|돌리)/u.test(compactQuery);

  if (!hasKnownTopic) return;

  for (const topic of topics.slice(0, 4)) {
    if (scope) addVariant(variants, `${scope} ${topic}`);
    for (const unit of units.slice(0, 2)) {
      addVariant(variants, `${unit} ${topic}`);
    }

    if (procedure) {
      addVariant(variants, `${scope ? `${scope} ` : ""}${topic} 신청 제출 원서 허가 승인 절차`);
    }
    if (duration) {
      addVariant(variants, `${scope ? `${scope} ` : ""}${topic} 기간 연한 기한 학기 통산 초과`);
    }
    if (eligibility) {
      addVariant(variants, `${scope ? `${scope} ` : ""}${topic} 대상 자격 요건 조건 제한 의무`);
    }
    if (transition) {
      addVariant(variants, `${scope ? `${scope} ` : ""}${topic} 변경 정정 전환 취소 철회 연기 사유 소멸`);
    }
  }

  if (comparison) {
    for (const side of splitComparisonSides(rawQuery).slice(0, 4)) {
      addVariant(variants, side);
    }
    if (topics.includes("총학생회")) {
      addVariant(variants, "서울 세종 총학생회 차이 학생자치 총학생회칙");
    }
  }

  if (variants.size > 1) {
    routingNotes.add("복합 자연어 질문을 범위·주제·절차 의도로 나누어 추가 검색했습니다.");
  }
}

function inferScopeTerm(compactQuery: string): string | null {
  if (compactQuery.includes("법학전문대학원")) return "법학전문대학원";
  if (compactQuery.includes("교육대학원")) return "교육대학원";
  if (compactQuery.includes("일반대학원")) return "일반대학원";
  if (compactQuery.includes("전문대학원")) return "전문대학원";
  if (compactQuery.includes("특수대학원")) return "특수대학원";
  if (/학부(생|학생|재학생|과정|규정|학칙)|학과|전공/u.test(compactQuery)) return "학부";
  if (/(학위청구논문|학위논문|논문심사|논문지도교수|지도교수|수료연구등록)/u.test(compactQuery)) {
    return "일반대학원";
  }
  if (/(교원|신임교원|신임교수)/u.test(compactQuery)) return "교원";
  if (compactQuery.includes("교수") && !/(지도교수|논문지도교수)/u.test(compactQuery)) return "교원";
  if (compactQuery.includes("직원")) return "직원";
  if (compactQuery.includes("조교")) return "조교";
  if (compactQuery.includes("대학원생")) return "일반대학원";
  if (compactQuery.includes("학생")) return "학생";
  return null;
}

function inferTopicTerms(compactQuery: string): string[] {
  const topics = new Set<string>();
  const topicRules: Array<[RegExp, string[]]> = [
    [/(휴학|일반휴학)/u, ["휴학", "일반휴학"]],
    [/(군휴학|군입대|입대휴학|군복무|병역|입영|소집)/u, ["군입대", "군입대휴학", "휴학"]],
    [/(복학|군제대복학|전역)/u, ["복학"]],
    [/(자퇴|퇴학|제적)/u, ["자퇴", "자퇴원"]],
    [/(장학금|장학|학비|등록금|수업료|납입금)/u, ["장학금", "등록금", "수업료"]],
    [/(영강|영어강의|영어수업|외국어강의|외국어강좌)/u, ["영어강의", "외국어강의"]],
    [/(책임수업시간|책임시수|강의시수|수업시수|강의의무|의무시수)/u, ["책임수업시간"]],
    [/(총학생회|학생회칙|학생자치)/u, ["총학생회", "학생자치"]],
    [/(대관|대여|빌리|빌려|공간|시설|장소사용|사용신청|강의실|회의실|운동장)/u, ["대관", "대여", "사용"]],
    [/(수강신청|수강정정|수강변경|정정원서)/u, ["수강신청"]],
    [/(학위청구논문|학위논문|논문심사|청구논문|논문제출)/u, ["학위청구논문", "논문심사"]],
    [/(지도교수|논문지도교수)/u, ["지도교수"]],
    [/(교환학생|방문학생|파견학생|sep|vsp)/iu, ["교환학생", "방문학생"]],
    [/(졸업|학위수여|학사학위취득유예|졸업유예)/u, ["졸업", "학사학위취득유예"]],
    [/(성적|평점|시험|고사|불응시|출석)/u, ["성적", "시험", "출석"]],
    [/(전과|전부|복수전공|이중전공|부전공)/u, ["전과", "복수전공", "부전공"]],
    [/(임용|초빙|재임용|재계약|퇴직|면직)/u, ["임용", "재임용"]],
  ];

  for (const [regex, values] of topicRules) {
    if (!regex.test(compactQuery)) continue;
    for (const value of values) topics.add(value);
  }
  return Array.from(topics);
}

function inferSpecificUnitTerms(query: string): string[] {
  const terms = new Set<string>();
  for (const match of query.matchAll(/[가-힣A-Za-z0-9·ㆍ\-()]+(?:학과|학부|전공|대학원|사업단|센터|연구단|Track|TRACK|MBA)/gu)) {
    const value = match[0].replace(/\s+/g, " ").trim();
    if (value.length >= 3) terms.add(value);
  }
  return Array.from(terms).slice(0, 4);
}

function splitComparisonSides(query: string): string[] {
  return query
    .replace(/[?？!！.。]/gu, " ")
    .split(/\s*(?:와|과|랑|하고|및|vs\.?|VS\.?)\s*/u)
    .map((value) =>
      value
        .replace(/(?:의\s*)?(?:차이|비교|다른\s*점|알려줘|알려주세요|정리해줘).*$/u, "")
        .replace(/^(?:혹시|그리고|또는)\s*/u, "")
        .trim(),
    )
    .filter((value) => value.length >= 2);
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

function hasDirectRegulationName(query: string): boolean {
  return /[가-힣A-Za-z0-9<>()\[\]·ㆍ\s_.\-]{2,90}(?:운영\s*규\s*정|시행\s*세\s*칙|규\s*정|내\s*규|세\s*칙|학\s*칙|지\s*침|규\s*칙|회\s*칙|수\s*칙|규\s*약)(?:\s*\([^)]*\))?/u.test(
    query,
  );
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
