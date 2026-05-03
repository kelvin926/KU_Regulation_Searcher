import type { ArticleRecord, ArticleRelevance, ArticleRelevanceGroup } from "../../shared/types";
import { normalizeArticleNo } from "../crawler/regulation-parser";
import type { ExpandedQuery } from "./query-expander";
import { compact, parseQueryIntent, type ParsedQueryIntent, type QueryScope } from "./query-intent";

export interface ScopeRankInput {
  query: string;
  queryInfo: readonly string[] | ExpandedQuery;
  limit: number;
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
  const context = buildRankingContext(input.query, input.queryInfo);
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

function buildRankingContext(query: string, queryInfo: readonly string[] | ExpandedQuery): RankingContext {
  if (isExpandedQuery(queryInfo)) {
    return {
      query,
      queryCompact: compact(query),
      keywords: unique(queryInfo.keywords.map(compact).filter(Boolean)),
      requiredTerms: unique(queryInfo.requiredTerms.map(compact).filter(Boolean)),
      optionalTerms: unique(queryInfo.optionalTerms.map(compact).filter(Boolean)),
      queryIntent: queryInfo.queryIntent ?? parseQueryIntent(query),
    };
  }

  return {
    query,
    queryCompact: compact(query),
    keywords: unique(queryInfo.map(compact).filter(Boolean)),
    requiredTerms: [],
    optionalTerms: [],
    queryIntent: parseQueryIntent(query),
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

  const group = classifyArticle(score, missingRequired, scopeAdjustment.outOfScope, all, context);
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
    const topicTerms = context.queryIntent.topics.map(compact);
    const isMilitaryLeaveQuestion =
      topicTerms.includes("군입대") || /(군입대|군복무|군휴학|입대휴학|입영|소집|병역)/u.test(context.queryCompact);

    if (context.queryIntent.scope === "unknown") {
      if (HIGH_AUTHORITY_REGULATIONS.some((name) => regulationName.includes(name))) score += 60;
      if (isSpecificAcademicUnitRule(regulationName)) score -= 70;
    }

    if (isMilitaryLeaveQuestion) {
      if (regulationName.includes("학사운영규정")) score += 120;
      if (title.includes("군입대휴학") || title.includes("군입대")) score += 140;
      if (body.includes("입영통지서") || body.includes("소집통지서")) score += 70;
      if (body.includes("군입대휴학원")) score += 45;
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
      context.queryIntent.scope === "unknown" &&
      context.queryIntent.topics.includes("휴학") &&
      isSpecificAcademicUnitRule(regulationName)
    ) {
      score -= 70;
    }
  }

  if (context.queryIntent.intent === "eligibility") {
    if (/대상|자격|요건|조건|가능|해당/u.test(title)) score += 45;
    if (/대상|자격|요건|조건|가능|해당/u.test(body)) score += 18;
  }

  if (context.queryIntent.intent === "amount") {
    if (/금액|수업료|등록금|지급액/u.test(title)) score += 50;
    if (/금액|수업료|등록금|지급액/u.test(body)) score += 20;
  }

  if (context.queryIntent.intent === "definition") {
    if (/정의|용어의정의/u.test(title)) score += 70;
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

  if (queryScope === "학부" && /(교원|직원|조교|책임수업시간)/u.test(`${regulationName} ${title}`)) {
    score -= 90;
    outOfScope = true;
    reasons.push("학부생 질문과 다른 대상");
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
  return [];
}

function scoreHighAuthority(regulationName: string, context: RankingContext): number {
  if (context.queryIntent.scope === "학부" && isUndergraduateAuthority(regulationName)) return 42;
  if (context.queryIntent.scope !== "unknown" && context.queryIntent.intent !== "regulation_lookup") return 0;
  return HIGH_AUTHORITY_REGULATIONS.some((name) => regulationName.includes(name)) ? 24 : 0;
}

function scoreGenericArticle(title: string, body: string, intent: string): number {
  let score = 0;
  if (GENERIC_TITLES.test(title) && intent !== "definition") score -= 15;
  if (title.includes("부칙")) score -= 30;
  if (DELETED_BODY.test(body) || title.includes("삭제")) score -= 50;
  return score;
}

function classifyArticle(
  score: number,
  missingRequired: boolean,
  outOfScope: boolean,
  all: string,
  context: RankingContext,
): ArticleRelevanceGroup {
  if (outOfScope) return "out_of_scope";
  if (missingRequired && context.queryIntent.intent !== "article_lookup") return "low_relevance";
  if (!hasAnyTopicMatch(all, context) && context.queryIntent.articleNos.length === 0) return "low_relevance";
  if (
    context.queryIntent.scope === "unknown" &&
    context.queryIntent.intent === "duration" &&
    context.queryIntent.topics.includes("휴학") &&
    isSpecificAcademicUnitRule(all) &&
    score < 260
  ) {
    return "related";
  }
  if (score >= 135) return "primary";
  if (score >= 45) return "related";
  return "low_relevance";
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

function isUndergraduateAuthority(regulationName: string): boolean {
  return UNDERGRADUATE_AUTHORITY_REGULATIONS.some((name) => regulationName.includes(name));
}

function directQueryIncludesSpecificUnit(query: string, regulationName: string): boolean {
  const compactRegulationName = compact(regulationName);
  const specificTerms = query.match(/[가-힣a-z0-9·\-()]+(?:학과|학부|전공|사업단|센터|연구단|track|display)/giu) ?? [];
  if (specificTerms.some((term) => compactRegulationName.includes(compact(term)))) return true;
  return query.length >= 4 && compactRegulationName.includes(query);
}

function pickDiverseArticles(scored: ScoreResult[], limit: number, context: RankingContext): ScoreResult[] {
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
