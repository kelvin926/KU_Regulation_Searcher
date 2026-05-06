import type { ArticleRecord, ArticleRelevance, ArticleRelevanceGroup, QueryScopeOption } from "../../shared/types";
import { normalizeArticleNo } from "../crawler/regulation-parser";
import type { ExpandedQuery } from "./query-expander";
import { compact, parseQueryIntent, type ParsedQueryIntent, type QueryScope } from "./query-intent";
import { queryScopeFromOption } from "./query-scope-options";

export interface ScopeRankInput {
  query: string;
  queryInfo: readonly string[] | ExpandedQuery;
  limit: number;
  scope?: QueryScopeOption;
}

export interface ScopeRankResult {
  articles: ArticleRecord[];
  candidateLimitReached: boolean;
  searchedCandidateCount: number;
}

interface RankingContext {
  query: string;
  queryCompact: string;
  keywords: string[];
  requiredTerms: string[];
  optionalTerms: string[];
  queryIntent: ParsedQueryIntent;
}

interface ScoreResult {
  article: ArticleRecord;
  index: number;
  score: number;
  group: ArticleRelevanceGroup;
  reasons: string[];
}

const HIGH_AUTHORITY_REGULATIONS = [
  "고려대학교학칙",
  "학사운영규정",
  "대학원학칙",
  "대학원학사운영규정",
  "대학원학칙일반대학원시행세칙",
  "장학금지급규정",
  "일반대학원장학금지급세칙",
] as const;

const UNDERGRADUATE_AUTHORITY_REGULATIONS = ["고려대학교학칙", "학사운영규정"] as const;

const CORE_REGULATION_LOOKUP_TITLES = /^(목적|적용범위|지급대상|지급대상등|종류|일반대학원장학금|준용)$/u;
const GENERIC_TITLES = /^(목적|정의|용어의정의|부칙)$/u;
const DELETED_BODY = /삭제\s*<|^삭제$/u;

export function rankArticlesByScope(articles: ArticleRecord[], input: ScopeRankInput): ScopeRankResult {
  const unique = dedupeArticles(articles);
  const context = buildRankingContext(input.query, input.queryInfo, input.scope);
  const scored = unique
    .map((article, index) => scoreArticle(article, index, context))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const selected = pickDiverseArticles(scored, input.limit, context);

  return {
    articles: selected.map(toRankedArticle),
    candidateLimitReached: unique.length > input.limit,
    searchedCandidateCount: unique.length,
  };
}

function buildRankingContext(query: string, queryInfo: readonly string[] | ExpandedQuery, scope?: QueryScopeOption): RankingContext {
  const applyScope = (queryIntent: ParsedQueryIntent): ParsedQueryIntent => {
    const manualScope = queryScopeFromOption(scope);
    return manualScope ? { ...queryIntent, scope: manualScope } : queryIntent;
  };

  if (isExpandedQuery(queryInfo)) {
    return {
      query,
      queryCompact: compact(query),
      keywords: unique(queryInfo.keywords.map(compact).filter(Boolean)),
      requiredTerms: unique(queryInfo.requiredTerms.map(compact).filter(Boolean)),
      optionalTerms: unique(queryInfo.optionalTerms.map(compact).filter(Boolean)),
      queryIntent: applyScope(queryInfo.queryIntent ?? parseQueryIntent(query)),
    };
  }

  return {
    query,
    queryCompact: compact(query),
    keywords: unique(queryInfo.map(compact).filter(Boolean)),
    requiredTerms: [],
    optionalTerms: [],
    queryIntent: applyScope(parseQueryIntent(query)),
  };
}

function scoreArticle(article: ArticleRecord, index: number, context: RankingContext): ScoreResult {
  const regulationName = compact(article.regulation_name);
  const title = compact(article.article_title ?? "");
  const body = compact(article.article_body);
  const articleNo = compact(article.article_no);
  const all = `${regulationName} ${articleNo} ${title} ${body}`;
  const reasons: string[] = [];
  let score = Math.max(0, 200 - index) * 0.04;
  let missingRequired = false;

  for (const articleNoQuery of context.queryIntent.articleNos) {
    if (normalizeArticleNo(article.article_no) === articleNoQuery) {
      score += 100;
      reasons.push("조문번호 일치");
    } else if (articleNo.includes(compact(articleNoQuery))) {
      score += 45;
      if (articleNo.startsWith(`${compact(articleNoQuery)}의`)) score -= 90;
    }
  }

  for (const term of context.requiredTerms) {
    const fieldScore = scoreTermPresence(term, regulationName, title, articleNo, body);
    if (fieldScore === 0) {
      score -= 90;
      missingRequired = true;
    } else {
      score += fieldScore;
    }
  }

  for (const keyword of context.keywords) {
    if (!keyword) continue;
    score += scoreTermPresence(keyword, regulationName, title, articleNo, body) * 0.38;
  }

  for (const term of context.optionalTerms) {
    if (!term) continue;
    score += scoreTermPresence(term, regulationName, title, articleNo, body) * 0.18;
  }

  const scopeAdjustment = scoreScope(article, context);
  score += scopeAdjustment.score;
  reasons.push(...scopeAdjustment.reasons);

  score += scoreHighAuthority(regulationName, context);
  score += scoreByIntent(article, context);
  score += scoreGenericArticle(title, body, context.queryIntent.intent);
  score += scoreDirectEvidenceMatch(regulationName, title, context);
  if (
    isDirectRegulationAsked(regulationName, context) &&
    context.queryIntent.articleNos.some((articleNoQuery) => normalizeArticleNo(article.article_no) === articleNoQuery)
  ) {
    score += 260;
  }

  const group = classifyArticle(score, missingRequired, scopeAdjustment.outOfScope, all, regulationName, title, context);
  return { article, index, score, group, reasons: reasons.slice(0, 3) };
}

function scoreTermPresence(
  term: string,
  regulationName: string,
  title: string,
  articleNo: string,
  body: string,
): number {
  let score = 0;
  if (articleNo === compact(term)) score += 100;
  if (regulationName.includes(term)) score += regulationName === term ? 80 : 44;
  if (title.includes(term)) score += title === term ? 60 : 30;
  if (articleNo.includes(term)) score += 24;
  if (body.includes(term)) score += 8;
  return score;
}

function scoreByIntent(article: ArticleRecord, context: RankingContext): number {
  const regulationName = compact(article.regulation_name);
  const title = compact(article.article_title ?? "");
  const body = compact(article.article_body);
  const allImportantTerms = [...scopeTerms(context.queryIntent.scope), ...context.queryIntent.topics.map(compact)];
  const topicTerms = context.queryIntent.topics.map(compact);
  const isMilitaryLeaveQuestion =
    topicTerms.includes("군입대") || /(군입대|군복무|군휴학|입대휴학|입영|소집|병역)/u.test(context.queryCompact);
  const isMilitaryLeaveTransitionQuestion =
    isMilitaryLeaveQuestion && /(일반휴학|전환|변경|취소|연기|소멸|냈다가|바꾸|돌리)/u.test(context.queryCompact);
  const isEnglishLectureQuestion =
    topicTerms.includes("영어강의") || topicTerms.includes("외국어강의") || /(영강|영어강의|외국어강의|외국어강좌)/u.test(context.queryCompact);
  const isStudentCouncilQuestion =
    topicTerms.includes("총학생회") || /(총학생회|학생자치|학생회칙)/u.test(context.queryCompact);
  const isFirstSemesterLeaveQuestion =
    context.queryIntent.topics.includes("휴학") && /(입학하자마자|입학후첫학기|첫학기|신입생)/u.test(context.queryCompact);
  let score = 0;

  if (context.queryIntent.intent === "regulation_lookup") {
    if (allImportantTerms.length > 0 && allImportantTerms.every((term) => regulationName.includes(term))) score += 120;
    if (allImportantTerms.length > 0 && allImportantTerms.every((term) => title.includes(term))) score += 140;
    if (context.queryIntent.scope !== "unknown" && context.queryIntent.topics.some((topic) => regulationName.includes(compact(topic)))) {
      score += 100;
    }
    if (CORE_REGULATION_LOOKUP_TITLES.test(title)) score += 20;
    if (!regulationNameIncludesAnyImportantTerm(regulationName, context) && bodyIncludesImportantTermOnly(body, title, context)) {
      score -= 30;
    }
  }

  if (context.queryIntent.intent === "procedure") {
    if (context.queryIntent.scope === "unknown" || context.queryIntent.scope === "학생") {
      if (HIGH_AUTHORITY_REGULATIONS.some((name) => regulationName.includes(name))) score += 60;
      if (isSpecificAcademicUnitRule(regulationName)) score -= 70;
    }

    if (isMilitaryLeaveQuestion) {
      if (regulationName.includes("학사운영규정")) score += 120;
      if (title.includes("군입대휴학") || title.includes("군입대")) score += 140;
      if (body.includes("입영통지서") || body.includes("소집통지서")) score += 70;
      if (body.includes("군입대휴학원")) score += 45;
      if (isMilitaryLeaveTransitionQuestion) {
        if (/(입영.*소집.*취소|사유.*소멸|신청.*취소)/u.test(body)) score += 180;
        if (title.includes("휴학의분류")) score += 125;
        if (title.includes("특별휴학의기간")) score += 95;
        if (title.includes("휴학의신청") || title.includes("휴학의신청허가")) score += 70;
        if (title.includes("일반휴학기간의연장")) score += 35;
        if (/(수강신청|학점|성적|시험|불응시|졸업)/u.test(title)) score -= 260;
        if (regulationName.includes("창업휴학") || title.includes("창업휴학")) score -= 300;
      }
      if (!context.queryCompact.includes("복학") && title.includes("복학")) score -= 500;
      if (!/(시험|불응시|중간고사|기말고사)/u.test(context.queryCompact) && title.includes("불응시")) score -= 500;
      if (!/(군입대|군복무|군휴학|입대휴학|입영|소집|병역)/u.test(`${title} ${body}`)) score -= 120;
      if (/(신임교원|책임수업시간|장학금|tutorial|대관|fellowship|연구실배정|입학)/iu.test(`${regulationName} ${title}`)) {
        score -= 110;
      }
    }

    for (const hint of context.queryIntent.procedureHints.map(compact)) {
      if (title.includes(hint)) score += 40;
      if (body.includes(hint)) score += 20;
    }
    for (const topic of topicTerms) {
      if (title.includes(topic)) score += 52;
      if (body.includes(topic)) score += 14;
    }
    if (topicTerms.includes("복학")) {
      if (title.includes("복학의신청")) score += 90;
      if (!/(군|전역|병역)/u.test(context.queryCompact) && title.includes("군전역")) score -= 80;
    }
    if (topicTerms.includes("자퇴")) {
      if (title.includes("자퇴")) score += 90;
      if (body.includes("자퇴원") || body.includes("자퇴신청서")) score += 45;
      if (!/(자퇴|퇴학|제적)/u.test(`${title} ${body}`)) score -= 260;
      if (isSpecificUnitRule(regulationName) && !directQueryIncludesSpecificUnit(context.queryCompact, regulationName)) {
        score -= 90;
      }
      if (body.includes("장학금") && !context.queryCompact.includes("장학금")) score -= 80;
    }
    if (topicTerms.includes("지도교수")) {
      const isAdvisorChangeQuestion = /(변경|정정|전환|바꾸|교체)/u.test(context.queryCompact);
      if (title.includes("지도교수변경") || (title.includes("지도교수") && title.includes("변경"))) score += 180;
      else if (title.includes("지도교수")) score += 95;
      if (body.includes("지도교수")) score += 35;
      if (isAdvisorChangeQuestion && !/(변경|정정|교체)/u.test(`${title} ${body}`)) score -= 80;
      if (!/(지도교수|논문지도교수)/u.test(`${title} ${body}`)) score -= 140;
    }
    if (topicTerms.length > 0 && title.includes("신청") && !topicTerms.some((topic) => title.includes(topic))) {
      score -= 80;
    }
    if (title.includes("방법") && !context.queryIntent.topics.some((topic) => title.includes(compact(topic)) || body.includes(compact(topic)))) {
      score -= 100;
    }
  }

  if (context.queryIntent.intent === "duration") {
    if (/기간|연한|통산|학기|초과|넘지/u.test(title)) score += 65;
    if (/기간|연한|통산|학기|초과|넘지/u.test(body)) score += 30;
    if (!context.queryCompact.includes("복학") && title.includes("복학")) score -= 140;
    if (
      (context.queryIntent.scope === "unknown" || context.queryIntent.scope === "학생") &&
      context.queryIntent.topics.includes("휴학") &&
      regulationName.includes("대학원학칙일반대학원시행세칙")
    ) {
      score += 90;
    }
    if (regulationName.includes("학사운영규정") && title.includes("휴학의신청") && body.includes("통산")) {
      score += 120;
    }
    if (context.queryCompact.includes("일반휴학")) {
      if (title.includes("일반휴학") || body.includes("일반휴학")) score += 45;
      if (!context.queryCompact.includes("창업") && (regulationName.includes("창업휴학") || title.includes("창업휴학"))) {
        score -= 120;
      }
      if (!context.queryCompact.includes("창업") && body.includes("창업휴학") && !body.includes("일반휴학")) score -= 80;
    }
    if (title.includes("목적") || title.includes("제출서류")) score -= 25;

    if (
      (context.queryIntent.scope === "unknown" || context.queryIntent.scope === "학생") &&
      context.queryIntent.topics.includes("휴학") &&
      isSpecificAcademicUnitRule(regulationName)
    ) {
      score -= 70;
    }
  }

  if (context.queryIntent.intent === "eligibility") {
    if (/대상|자격|요건|조건|가능|해당|기준|선발|제한|적용/u.test(title)) score += 45;
    if (/대상|자격|요건|조건|가능|해당|기준|선발|제한|적용/u.test(body)) score += 18;
    if (isMilitaryLeaveQuestion) {
      if (regulationName.includes("학사운영규정")) score += 110;
      if (title.includes("군입대휴학") || title.includes("군입대")) score += 150;
      if (title.includes("휴학의제한")) score += 120;
      if (title.includes("휴학의분류") || title.includes("특별휴학의기간")) score += 70;
      if (body.includes("입영통지서") || body.includes("소집통지서") || body.includes("군입대휴학원")) score += 70;
      if (body.includes("입학후첫학기") || body.includes("신입생")) score += 80;
      if (!context.queryCompact.includes("복학") && title.includes("복학")) score -= 420;
      if (!/(시험|응시|성적|중간고사|기말고사)/u.test(context.queryCompact) && /(불응시|응시|성적)/u.test(title)) {
        score -= 420;
      }
      if (!/(군입대|군복무|군휴학|입대휴학|입영|소집|병역)/u.test(`${title} ${body}`) && !title.includes("휴학의제한")) {
        score -= 100;
      }
      if (/(졸업|창업|수강신청|학점취득|응시|성적|장학금|tutorial|전과|졸업논문)/iu.test(`${regulationName} ${title}`)) {
        score -= 90;
      }
    }
    if (isFirstSemesterLeaveQuestion) {
      if (title.includes("휴학의제한")) score += 120;
      if (body.includes("입학후첫학기") || body.includes("신입생") || body.includes("편입학생") || body.includes("재입학생")) {
        score += 80;
      }
      if (title.includes("군입대휴학") || body.includes("군입대")) score += 45;
    }
  }

  if (context.queryIntent.intent === "amount") {
    if (/금액|수업료|등록금|지급액|지급|장학금|지원비|연구비|감면|대관료|사용료|수당|급여/u.test(title)) score += 50;
    if (/금액|수업료|등록금|지급액|지급|장학금|지원비|연구비|감면|대관료|사용료|수당|급여/u.test(body)) score += 20;
  }

  if (context.queryIntent.intent === "definition") {
    if (/정의|용어의정의/u.test(title)) score += 70;
  }

  if (isEnglishLectureQuestion) {
    const hasEnglishLectureEvidence = /(영어강의|외국어강의|외국어강좌|영강)/u.test(`${regulationName} ${title} ${body}`);
    if (regulationName.includes("외국어강의")) score += 180;
    if (title.includes("외국어강의") || title.includes("영어강의")) score += 90;
    if (body.includes("영어강의") || body.includes("외국어강의")) score += 55;
    if (regulationName.includes("신임교원") && regulationName.includes("책임수업시간")) score += 135;
    if (title.includes("감면교과목") || body.includes("감면교과목")) score += 70;
    if (body.includes("영어강의로개설") || body.includes("외국어강의비율")) score += 100;
    if (!hasEnglishLectureEvidence) score -= 230;
    if (title.includes("제출서류") || title.includes("신청")) score -= 170;
    if (/(bk21|장학금|등록금|대관|학생|수료|자퇴|휴학)/iu.test(`${regulationName} ${title}`)) score -= 75;
  }

  if (isStudentCouncilQuestion) {
    if (regulationName.includes("총학생회칙")) score += 240;
    if (body.includes("안암총학생회") || body.includes("안암캠퍼스") || title.includes("명칭") || title.includes("소재지")) {
      score += 100;
    }
    if (regulationName.includes("고려대학교학칙") && title.includes("학생자치활동")) score += 180;
    if (regulationName.includes("대학원학칙일반대학원시행세칙") && title.includes("대학원총학생회")) score += 150;
    if (regulationName.includes("세종캠퍼스") && body.includes("총학생회")) score += 135;
    if (
      regulationName.includes("세종캠퍼스사무분장규정") &&
      (title.includes("학생생활지원팀") || body.includes("일반대학원총학생회") || body.includes("학생회지원"))
    ) {
      score += 240;
    }
    if (title.includes("학생지원팀") || title.includes("학생생활지원팀")) score += 60;
    if (regulationName.includes("위원회") && /(구성|임기)/u.test(title)) score -= 110;
    if (/(장학금|대관|군사교육|bk21|입학|수강신청)/iu.test(`${regulationName} ${title}`) && !title.includes("총학생회")) {
      score -= 80;
    }
  }

  return score;
}

function scoreScope(article: ArticleRecord, context: RankingContext): { score: number; outOfScope: boolean; reasons: string[] } {
  const regulationName = compact(article.regulation_name);
  const title = compact(article.article_title ?? "");
  const queryScope = context.queryIntent.scope;
  const directQuery = context.queryCompact;
  let score = 0;
  let outOfScope = false;
  const reasons: string[] = [];
  const sourceType = article.source_type ?? article.sourceType ?? "official";
  const customScope = article.custom_scope ?? article.customScope ?? null;

  if (sourceType === "custom") {
    score += 16;
    if (customScope) {
      const customQueryScope = queryScopeFromOption(customScope);
      if (customQueryScope && customQueryScope === queryScope) {
        score += 90;
        reasons.push("커스텀 규정 범위 일치");
      } else if (customQueryScope && queryScope !== "unknown" && queryScope !== "학생" && customScope !== "other") {
        score -= 45;
      }
    }
  }

  if (queryScope === "학부" && /(교원|직원|조교|책임수업시간)/u.test(`${regulationName} ${title}`)) {
    score -= 90;
    outOfScope = true;
    reasons.push("학부생 질문과 다른 대상");
    return { score, outOfScope, reasons };
  }

  if (queryScope === "학부" && isSpecificAcademicUnitRule(regulationName) && !directQueryIncludesSpecificUnit(directQuery, regulationName)) {
    score -= 90;
    outOfScope = true;
    reasons.push("학부 공통 질문과 다른 특정 과정/소속");
    return { score, outOfScope, reasons };
  }

  if (
    queryScope === "학부" &&
    isSpecificUndergraduateRule(regulationName) &&
    !directQueryIncludesSpecificUndergraduateUnit(directQuery, regulationName)
  ) {
    score -= 80;
    outOfScope = true;
    reasons.push("학부 공통 질문과 다른 특정 단과대학 규정");
    return { score, outOfScope, reasons };
  }

  for (const term of scopeTerms(queryScope)) {
    if (regulationName.includes(term) || title.includes(term)) {
      score += queryScope === "학부" ? 20 : 50;
      reasons.push(`${queryScope} 범위 일치`);
      if (queryScope !== "학부") return { score, outOfScope, reasons };
      break;
    }
  }

  if (queryScope === "학부" && isUndergraduateAuthority(regulationName)) {
    score += 70;
    reasons.push("학부 공통 규정");
  }

  if (queryScope === "unknown" || queryScope === "학생") return { score, outOfScope, reasons };
  if ((queryScope === "서울캠퍼스" || queryScope === "세종캠퍼스") && isCampusComparisonQuery(directQuery)) {
    return { score, outOfScope, reasons };
  }

  if (
    queryScope === "일반대학원" &&
    regulationName.includes("학사운영규정") &&
    !regulationName.includes("대학원학사운영규정") &&
    !directQuery.includes("학사운영규정")
  ) {
    score -= 90;
    outOfScope = true;
    reasons.push("대학원 질문과 다른 학부 학사운영 규정");
  }

  const penalties = scopePenaltyTerms(queryScope);
  for (const item of penalties) {
    if (regulationName.includes(item.term) && !directQuery.includes(item.term)) {
      score += item.penalty;
      if (item.penalty <= -50) outOfScope = true;
      reasons.push("질문 범위와 다른 소속 가능성");
      break;
    }
  }

  if (isSpecificUnitRule(regulationName) && !directQueryIncludesSpecificUnit(directQuery, regulationName)) {
    score -= 40;
    outOfScope = true;
    reasons.push("특정 사업/부서/학과 내규");
  }

  if (
    queryScope === "일반대학원" &&
    isSpecificAcademicUnitRule(regulationName) &&
    !directQueryIncludesSpecificUnit(directQuery, regulationName)
  ) {
    score -= 80;
    outOfScope = true;
    reasons.push("일반대학원과 다른 대학원 가능성");
  }

  return { score, outOfScope, reasons };
}

function scopeTerms(scope: QueryScope): string[] {
  if (scope === "unknown") return [];
  if (scope === "전문·특수대학원") {
    return [
      "전문대학원",
      "특수대학원",
      "교육대학원",
      "법학전문대학원",
      "경영전문대학원",
      "기술경영전문대학원",
      "대학원학칙",
    ].map(compact);
  }
  if (scope === "직원·조교") return ["직원", "조교", "직원인사", "조교임용"].map(compact);
  if (scope === "서울캠퍼스") return ["서울캠퍼스", "안암캠퍼스", "서울"].map(compact);
  if (scope === "기타") return ["내규", "지침", "운영"].map(compact);
  return [compact(scope)];
}

function scopePenaltyTerms(scope: QueryScope): Array<{ term: string; penalty: number }> {
  if (scope === "학부") {
    return [
      { term: "대학원", penalty: -70 },
      { term: "전문대학원", penalty: -80 },
      { term: "특수대학원", penalty: -80 },
      { term: "교육대학원", penalty: -80 },
      { term: "법학전문대학원", penalty: -80 },
      { term: "교원", penalty: -70 },
      { term: "직원", penalty: -60 },
      { term: "조교", penalty: -60 },
    ];
  }
  if (scope === "일반대학원") {
    return [
      { term: "교육대학원", penalty: -80 },
      { term: "법학전문대학원", penalty: -80 },
      { term: "전문대학원", penalty: -50 },
      { term: "특수대학원", penalty: -50 },
      { term: "세종sw중심대학사업단", penalty: -60 },
      { term: "세종캠퍼스", penalty: -50 },
    ];
  }
  if (scope === "전문·특수대학원") {
    return [
      { term: "학사운영규정", penalty: -50 },
      { term: "일반대학원시행세칙", penalty: -45 },
      { term: "학부", penalty: -60 },
      { term: "교원", penalty: -60 },
      { term: "직원", penalty: -50 },
      { term: "조교", penalty: -50 },
    ];
  }
  if (scope === "교원") {
    return [
      { term: "대학원", penalty: -50 },
      { term: "학사운영규정", penalty: -55 },
      { term: "직원", penalty: -60 },
      { term: "조교", penalty: -60 },
    ];
  }
  if (scope === "직원·조교") {
    return [
      { term: "교원", penalty: -60 },
      { term: "대학원", penalty: -45 },
      { term: "학사운영규정", penalty: -50 },
    ];
  }
  if (scope === "서울캠퍼스") {
    return [{ term: "세종캠퍼스", penalty: -55 }];
  }
  return [];
}

function isCampusComparisonQuery(query: string): boolean {
  return /(서울|안암)/u.test(query) && /세종/u.test(query) && /(차이|비교|다른|총학생회|학생회)/u.test(query);
}

function scoreHighAuthority(regulationName: string, context: RankingContext): number {
  if (context.queryIntent.scope === "학부" && isUndergraduateAuthority(regulationName)) return 42;
  if (
    context.queryIntent.scope !== "unknown" &&
    context.queryIntent.scope !== "학생" &&
    context.queryIntent.intent !== "regulation_lookup"
  ) {
    return 0;
  }
  return HIGH_AUTHORITY_REGULATIONS.some((name) => regulationName.includes(name)) ? 24 : 0;
}

function scoreGenericArticle(title: string, body: string, intent: string): number {
  let score = 0;
  if (GENERIC_TITLES.test(title) && intent !== "definition") score -= 15;
  if (title.includes("부칙")) score -= 30;
  if (DELETED_BODY.test(body) || title.includes("삭제")) score -= 50;
  return score;
}

function scoreDirectEvidenceMatch(regulationName: string, title: string, context: RankingContext): number {
  let score = 0;
  const directlyAskedRegulation = isDirectRegulationAsked(regulationName, context);
  if (directlyAskedRegulation) score += 90;
  if (isSpecificTitleAsked(title, context, directlyAskedRegulation)) score += 280;
  return score;
}

function classifyArticle(
  score: number,
  missingRequired: boolean,
  outOfScope: boolean,
  all: string,
  regulationName: string,
  title: string,
  context: RankingContext,
): ArticleRelevanceGroup {
  const directlyAskedRegulation = isDirectRegulationAsked(regulationName, context);
  if (outOfScope && !directlyAskedRegulation) return "out_of_scope";
  const directEvidenceMatch = hasDirectEvidenceMatch(regulationName, title, context);
  const isEnglishLectureQuery = /(영강|영어강의|외국어강의|외국어강좌)/u.test(context.queryCompact);
  const hasEnglishLectureEvidence = /(영어강의|외국어강의|외국어강좌|영강)/u.test(all);
  const isStudentCouncilQuery = /(총학생회|학생자치|학생회칙)/u.test(context.queryCompact);
  const hasStudentCouncilEvidence = /(총학생회|학생자치|학생회)/u.test(all);
  if (directEvidenceMatch && score >= 20) return "primary";
  if (directEvidenceMatch) return "related";
  if (isEnglishLectureQuery && !hasEnglishLectureEvidence) return "low_relevance";
  if (missingRequired && context.queryIntent.intent !== "article_lookup" && !directEvidenceMatch && score < 135) {
    return "low_relevance";
  }
  if (
    !hasAnyTopicMatch(all, context) &&
    !(isStudentCouncilQuery && hasStudentCouncilEvidence) &&
    context.queryIntent.articleNos.length === 0 &&
    !directEvidenceMatch
  ) {
    return "low_relevance";
  }
  if (
    context.queryIntent.intent === "duration" &&
    context.queryIntent.topics.includes("휴학") &&
    regulationName.includes("창업휴학") &&
    !context.queryCompact.includes("창업")
  ) {
    return "related";
  }
  if (isBroadLeaveDurationQuestion(context) && !isBroadAcademicAuthority(regulationName)) {
    const directSpecificUnitMatch = directQueryIncludesSpecificUnit(context.queryCompact, regulationName);
    const unrelatedStartupLeave = regulationName.includes("창업휴학") && !context.queryCompact.includes("창업");
    if (!directSpecificUnitMatch && (isSpecificAcademicUnitRule(regulationName) || unrelatedStartupLeave)) {
      return "related";
    }
  }
  if (score >= 135) return "primary";
  if (score >= 45) return "related";
  return "low_relevance";
}

function hasDirectEvidenceMatch(regulationName: string, title: string, context: RankingContext): boolean {
  const directlyAskedRegulation = isDirectRegulationAsked(regulationName, context);
  return directlyAskedRegulation || isSpecificTitleAsked(title, context, directlyAskedRegulation);
}

function isDirectRegulationAsked(regulationName: string, context: RankingContext): boolean {
  if (regulationName.length < 4) return false;
  if (context.queryCompact.includes(regulationName)) return true;
  const relaxedQuery = context.queryCompact.replace(/의/g, "");
  const relaxedRegulation = regulationName.replace(/의/g, "");
  return relaxedRegulation.length >= 4 && relaxedQuery.includes(relaxedRegulation);
}

function isSpecificTitleAsked(title: string, context: RankingContext, directlyAskedRegulation = false): boolean {
  if (GENERIC_TITLES.test(title)) return false;
  if (title.length >= 4 && context.queryCompact.includes(title)) return true;
  return directlyAskedRegulation && title.length >= 2 && context.queryCompact.includes(title);
}

function hasAnyTopicMatch(all: string, context: RankingContext): boolean {
  const terms = unique([...context.queryIntent.topics.map(compact), ...context.requiredTerms]);
  if (terms.length === 0) return context.keywords.some((keyword) => all.includes(keyword));
  return terms.some((term) => all.includes(term));
}

function regulationNameIncludesAnyImportantTerm(regulationName: string, context: RankingContext): boolean {
  return [...scopeTerms(context.queryIntent.scope), ...context.queryIntent.topics.map(compact)].some((term) =>
    regulationName.includes(term),
  );
}

function bodyIncludesImportantTermOnly(body: string, title: string, context: RankingContext): boolean {
  return context.queryIntent.topics.map(compact).some((term) => body.includes(term) && !title.includes(term));
}

function isSpecificUnitRule(regulationName: string): boolean {
  return /(사업|track|센터|학과|전공|연구단|교육연구단|사업단|display)/iu.test(regulationName);
}

function isSpecificAcademicUnitRule(value: string): boolean {
  if (value.includes("대학원학칙일반대학원시행세칙")) return false;
  return /(전문대학원|특수대학원|교육대학원|법학전문대학원|대학원학칙(?!일반대학원).+시행세칙|학과|전공|사업단|연구단|운영내규|학사내규|mba|track|display)/iu.test(
    value,
  );
}

function isSpecificUndergraduateRule(value: string): boolean {
  return /[가-힣a-z0-9·()]+대학(?!원).+(시행세칙|내규|운영규정|학사운영)/iu.test(value);
}

function isBroadLeaveDurationQuestion(context: RankingContext): boolean {
  return (
    (context.queryIntent.scope === "unknown" || context.queryIntent.scope === "학생") &&
    context.queryIntent.intent === "duration" &&
    context.queryIntent.topics.includes("휴학")
  );
}

function isBroadAcademicAuthority(value: string): boolean {
  if (
    value.includes("고려대학교학칙") ||
    value.includes("학사운영규정") ||
    value.includes("대학원학사운영규정") ||
    value.includes("대학원학칙일반대학원시행세칙")
  ) {
    return true;
  }
  return value.includes("대학원학칙") && !/대학원학칙.+시행세칙/u.test(value);
}

function isUndergraduateAuthority(regulationName: string): boolean {
  return UNDERGRADUATE_AUTHORITY_REGULATIONS.some((name) => regulationName.includes(name));
}

function directQueryIncludesSpecificUnit(query: string, regulationName: string): boolean {
  const compactRegulationName = compact(regulationName);
  const specificTerms = query.match(/[가-힣a-z0-9·\-()]+(?:대학원|학과|학부|전공|사업단|센터|연구단|track|display)/giu) ?? [];
  if (specificTerms.some((term) => compactRegulationName.includes(compact(term)))) return true;
  if (compactRegulationName.length >= 4 && query.includes(compactRegulationName)) return true;
  return query.length >= 4 && compactRegulationName.includes(query);
}

function directQueryIncludesSpecificUndergraduateUnit(query: string, regulationName: string): boolean {
  const compactRegulationName = compact(regulationName);
  const specificTerms = query.match(/[가-힣a-z0-9·\-()]+대학(?!원)/giu) ?? [];
  return (
    specificTerms.some((term) => compactRegulationName.includes(compact(term))) ||
    (compactRegulationName.length >= 4 && query.includes(compactRegulationName))
  );
}

function pickDiverseArticles(scored: ScoreResult[], limit: number, context: RankingContext): ScoreResult[] {
  if (scored.some((item) => isDirectRegulationAsked(compact(item.article.regulation_name), context))) {
    return scored.slice(0, limit);
  }
  if (!shouldUseDiversity(context)) return scored.slice(0, limit);

  const selected: ScoreResult[] = [];
  const perRegulationCount = new Map<string, number>();
  const softCap = 2;

  for (const item of scored) {
    const key = item.article.regulation_name;
    const current = perRegulationCount.get(key) ?? 0;
    if (current >= softCap) continue;
    selected.push(item);
    perRegulationCount.set(key, current + 1);
    if (selected.length >= limit) return selected;
  }

  const selectedIds = new Set(selected.map((item) => item.article.id));
  for (const item of scored) {
    if (selectedIds.has(item.article.id)) continue;
    selected.push(item);
    if (selected.length >= limit) return selected;
  }

  return selected;
}

function shouldUseDiversity(context: RankingContext): boolean {
  if (context.queryIntent.intent === "article_lookup") return false;
  if (context.queryIntent.scope !== "unknown" && context.queryIntent.intent === "regulation_lookup") return false;
  if (/(총학생회|학생자치|학생회칙|차이|비교|영강|영어강의|외국어강의)/u.test(context.queryCompact)) return true;
  return context.queryIntent.scope === "unknown" || context.queryIntent.intent === "duration";
}

function toRankedArticle(item: ScoreResult): ArticleRecord {
  const relevance: ArticleRelevance = {
    group: item.group,
    label: labelForGroup(item.group),
    score: Math.round(item.score),
    reasons: item.reasons,
  };
  return { ...item.article, relevance };
}

function labelForGroup(group: ArticleRelevanceGroup): string {
  switch (group) {
    case "primary":
      return "적용 가능성 높음";
    case "related":
      return "참고";
    case "out_of_scope":
      return "다른 소속 가능성";
    case "low_relevance":
      return "낮은 관련도";
  }
}

function dedupeArticles(articles: ArticleRecord[]): ArticleRecord[] {
  const seen = new Set<number>();
  const results: ArticleRecord[] = [];
  for (const article of articles) {
    if (seen.has(article.id)) continue;
    seen.add(article.id);
    results.push(article);
  }
  return results;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function isExpandedQuery(value: readonly string[] | ExpandedQuery): value is ExpandedQuery {
  return !Array.isArray(value);
}
