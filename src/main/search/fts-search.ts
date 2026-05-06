import type { AskSearchResult, ArticleRecord, SearchPageRequest } from "../../shared/types";
import { AppError } from "../../shared/errors";
import {
  HARD_MAX_RAG_ARTICLES,
  HARD_MAX_SEARCH_CANDIDATE_LIMIT,
  MIN_RAG_ARTICLES,
} from "../../shared/constants";
import type { DatabaseService } from "../db/database";
import { normalizeArticleNo } from "../crawler/regulation-parser";
import { rankArticlesForQuestion } from "./article-ranker";
import { expandQuery } from "./query-expander";
import { createSearchQueryPlan, mergeExpandedQueries } from "./query-planner";
import { parseSearchOperators } from "./search-operators";

const RERANK_POOL_MULTIPLIER = 5;
const MIN_RERANK_POOL_SIZE = 150;
const MAX_RERANK_POOL_SIZE = 300;
const MAX_COMPOUND_RERANK_POOL_SIZE = 900;
const DIRECT_REGULATION_POOL_SIZE = 800;

export class SearchService {
  constructor(private readonly db: DatabaseService) {}

  searchForQuestion(query: string, limit: number): AskSearchResult {
    const stats = this.db.getStats();
    if (stats.articleCount === 0) {
      return { articles: [], expandedKeywords: [], errorCode: "LOCAL_DB_EMPTY" };
    }

    const safeLimit = clampSearchCandidateLimit(limit);
    const operatorQuery = parseSearchOperators(query);
    const searchPoolLimit = getRerankPoolLimit(safeLimit, 1);
    if (operatorQuery.hasOperators) {
      const result = this.db.searchArticlesByBooleanQuery(query, searchPoolLimit);
      const ranked = rankArticlesForQuestion(result.articles, query, result.highlightTerms, safeLimit);
      return {
        articles: ranked.articles,
        expandedKeywords: result.highlightTerms,
        errorCode: result.articles.length === 0 ? "NO_RELEVANT_ARTICLES" : undefined,
        candidateLimitReached: ranked.candidateLimitReached,
        searchedCandidateCount: ranked.searchedCandidateCount,
        suggestedQueries: buildSuggestedQueries(query, ranked.articles),
      };
    }

    const expanded = expandQuery(query);
    if (!expanded.ftsQuery) {
      return { articles: [], expandedKeywords: [], errorCode: "NO_RELEVANT_ARTICLES" };
    }

    const plan = createSearchQueryPlan(query);
    const expandedVariants = plan.variants.map((variant) => expandQuery(variant));
    const rankingQueryInfo = mergeExpandedQueries(expanded, expandedVariants, plan.isCompound);
    const plannedPoolLimit = getRerankPoolLimit(safeLimit, plan.variants.length);
    let articles: ArticleRecord[] = [];

    for (let index = 0; index < plan.variants.length; index += 1) {
      const variant = plan.variants[index];
      const variantExpanded = expandedVariants[index];
      const poolLimit = index === 0 ? plannedPoolLimit : Math.max(MIN_RERANK_POOL_SIZE, Math.floor(plannedPoolLimit / 2));

      for (const directRegulationName of extractDirectRegulationNames(variant)) {
        articles = [
          ...articles,
          ...this.db.searchArticlesByCompactRegulationName(
            directRegulationName,
            Math.max(poolLimit, DIRECT_REGULATION_POOL_SIZE),
          ),
        ];
      }

      if (variantExpanded.intent === "regulation_lookup" || /\s*(규정|세칙|내규|학칙|지침|회칙)\b/u.test(variant)) {
        articles = [
          ...articles,
          ...this.db.searchArticlesByRegulationNameTerms(
            [...variantExpanded.scopeKeywords, ...variantExpanded.coreKeywords].slice(0, 4),
            poolLimit,
          ),
        ];
      }

      articles = [
        ...articles,
        ...this.db.searchArticlesByRequiredTerms(variantExpanded.requiredTerms, variantExpanded.optionalTerms, poolLimit),
      ];
      try {
        articles = [...articles, ...this.db.searchArticlesByFts(variantExpanded.ftsQuery, poolLimit)];
      } catch {
        articles = [...articles, ...this.db.searchArticlesByLike(variantExpanded.keywords, poolLimit)];
      }

      if (plan.isCompound) {
        articles = [...articles, ...this.db.searchArticlesByLike(variantExpanded.keywords.slice(0, 12), poolLimit)];
      }
    }

    if (articles.length === 0) {
      articles = this.db.searchArticlesByLike(rankingQueryInfo.keywords, plannedPoolLimit);
    }

    const ranked = rankArticlesForQuestion(articles, query, rankingQueryInfo, safeLimit);
    const suggestedQueries = buildSuggestedQueries(query, ranked.articles, plan.variants);
    return {
      articles: ranked.articles,
      expandedKeywords: rankingQueryInfo.keywords.slice(0, 32),
      errorCode: articles.length === 0 ? "NO_RELEVANT_ARTICLES" : undefined,
      candidateLimitReached: ranked.candidateLimitReached,
      searchedCandidateCount: ranked.searchedCandidateCount,
      routingNotes: plan.routingNotes,
      suggestedQueries,
    };
  }

  searchPage(request: SearchPageRequest): ArticleRecord[] {
    const normalizedArticleNo = request.articleNo?.trim() ? normalizeArticleNo(request.articleNo) : undefined;
    return this.db.searchArticlePage({
      regulationName: request.regulationName,
      bodyQuery: request.bodyQuery,
      articleNo: normalizedArticleNo,
      limit: request.limit ?? 50,
    });
  }

  getCandidateArticles(articleIds: number[], maxCandidateLimit: number): ArticleRecord[] {
    const limit = clampAiCandidateLimit(maxCandidateLimit);
    const articles = this.db.getArticlesByIds(articleIds.slice(0, limit));
    if (articles.length === 0) {
      throw new AppError("NO_RELEVANT_ARTICLES");
    }
    return articles;
  }
}

function extractDirectRegulationNames(query: string): string[] {
  const normalized = query.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const names: string[] = [];
  for (const match of normalized.matchAll(/(고려대학교\s+대학원)(?:의|에서|으로|로|에|을|를|\s|$)/gu)) {
    addRegulationNameCandidate(names, match[1]);
  }
  const anchoredMatch = normalized.match(
    /^(.+(?:운영\s*규\s*정|시행\s*세\s*칙|규\s*정|내\s*규|세\s*칙|학\s*칙|지\s*침|규\s*칙|회\s*칙|수\s*칙|규\s*약)(?:\s*\([^)]*\))?)(?:의|에서|\s|$)/u,
  );
  addRegulationNameCandidate(names, anchoredMatch?.[1]);

  for (const match of normalized.matchAll(
    /([가-힣A-Za-z0-9<>()\[\]·ㆍ\s_.\-]{2,90}?(?:운영\s*규\s*정|시행\s*세\s*칙|규\s*정|내\s*규|세\s*칙|학\s*칙|지\s*침|규\s*칙|회\s*칙|수\s*칙|규\s*약)(?:\s*\([^)]*\))?)(?:의|에서|으로|로|에|을|를|\s|$)/gu,
  )) {
    addRegulationNameCandidate(names, match[1]);
  }

  return Array.from(new Set(names)).slice(0, 4);
}

function addRegulationNameCandidate(names: string[], rawValue?: string): void {
  const name = cleanRegulationNameCandidate(rawValue);
  if (!name || name.length < 4) return;
  names.push(name);
}

function cleanRegulationNameCandidate(rawValue?: string): string | null {
  if (!rawValue) return null;
  const chunks = rawValue
    .replace(/[<>〈〉《》「」『』]/gu, " ")
    .split(
      /[,，.。?？!！]|(?:원칙만\s*보면\s*안\s*될\s*것\s*같은데|안\s*될\s*것\s*같은데|누구에게\s*적용되는지|적용되는지|금액이나\s*지원\s*기준을|지원\s*기준을|기준을\s*볼\s*때|포함되지\s*않는\s*경우나\s*예외가\s*있는지|언제까지|몇\s*학기까지|가능한지|있는지|헷갈리는데|궁금한데|찾는데|보는데|있는데|갖춰야\s*하는지|해야\s*하는지|하는지|연결되는|조항을|조항으로|근거로|기준으로|인데|라면|이면|면)\s*/u,
    )
    .map((value) => value.trim())
    .filter(Boolean);
  const value = (chunks.at(-1) ?? rawValue).trim();
  const cleaned = value
    .replace(/^(?:그리고|또는|혹시|근거는|근거로|기준으로)\s+/u, "")
    .replace(/\s+/g, " ")
    .trim();
  if (isGenericRegulationCandidate(cleaned)) return null;
  return cleaned;
}

function isGenericRegulationCandidate(value: string): boolean {
  const compacted = value.replace(/\s+/g, "");
  const withoutRuleType = compacted.replace(/(운영규정|시행세칙|규정|내규|세칙|학칙|지침|규칙|회칙|수칙|규약)$/u, "");
  if (withoutRuleType.length < 2) return true;
  return /^(기간|기준|관련|절차|방법|대상|조건|요건|제한|예외|근거|조항|내용)+$/u.test(withoutRuleType);
}

function clampSearchCandidateLimit(value: number): number {
  if (!Number.isFinite(value)) return HARD_MAX_SEARCH_CANDIDATE_LIMIT;
  return Math.min(Math.max(Math.round(value), MIN_RAG_ARTICLES), HARD_MAX_SEARCH_CANDIDATE_LIMIT);
}

function clampAiCandidateLimit(value: number): number {
  if (!Number.isFinite(value)) return MIN_RAG_ARTICLES;
  return Math.min(Math.max(Math.round(value), MIN_RAG_ARTICLES), HARD_MAX_RAG_ARTICLES);
}

function getRerankPoolLimit(limit: number, variantCount: number): number {
  const baseLimit = Math.min(Math.max(limit * RERANK_POOL_MULTIPLIER, MIN_RERANK_POOL_SIZE), MAX_RERANK_POOL_SIZE);
  if (variantCount <= 1) return baseLimit;
  return Math.min(baseLimit + (variantCount - 1) * 90, MAX_COMPOUND_RERANK_POOL_SIZE);
}

function buildSuggestedQueries(query: string, articles: ArticleRecord[], routeVariants: string[] = []): string[] {
  const suggestions = new Set<string>();
  const compactQuery = query.replace(/\s+/g, "");
  const hasDefaultEvidence = articles.some((article) => {
    const group = article.relevance?.group;
    return group === "primary" || group === "related";
  });

  const topics = inferSuggestionTopics(compactQuery);
  for (const topic of topics.slice(0, 3)) {
    if (/(학부생|학부|학과|전공)/u.test(compactQuery)) {
      addSuggestion(suggestions, query, `학사운영 규정 ${topic}`);
    }
    if (/(대학원생|대학원|석사|박사)/u.test(compactQuery)) {
      addSuggestion(suggestions, query, `대학원학칙 일반대학원 시행세칙 ${topic}`);
      addSuggestion(suggestions, query, `대학원학칙 ${topic}`);
    }
    if (!/(학부|대학원|교원|직원|조교)/u.test(compactQuery)) {
      addSuggestion(suggestions, query, `학부 ${topic}`);
      addSuggestion(suggestions, query, `일반대학원 ${topic}`);
    }
  }

  for (const unit of extractSpecificQueryUnits(query).slice(0, 2)) {
    for (const topic of topics.slice(0, 2)) {
      addSuggestion(suggestions, query, `${unit} ${topic}`);
    }
  }

  if (!hasDefaultEvidence || articles.length === 0) {
    for (const variant of routeVariants.slice(1, 5)) addSuggestion(suggestions, query, variant);
  }

  return Array.from(suggestions).slice(0, 5);
}

function addSuggestion(suggestions: Set<string>, originalQuery: string, suggestion: string): void {
  const value = suggestion.replace(/\s+/g, " ").trim();
  if (value.length < 2) return;
  if (value === originalQuery.replace(/\s+/g, " ").trim()) return;
  suggestions.add(value);
}

function inferSuggestionTopics(compactQuery: string): string[] {
  const topics = new Set<string>();
  const mappings: Array<[RegExp, string[]]> = [
    [/(군휴학|군입대|입대휴학|군복무|병역|입영|소집)/u, ["군입대 휴학", "휴학의 제한"]],
    [/(휴학|일반휴학)/u, ["휴학기간", "일반휴학"]],
    [/(복학|전역)/u, ["복학"]],
    [/(자퇴|퇴학|제적)/u, ["자퇴"]],
    [/(장학금|등록금|수업료|학비|납입금)/u, ["장학금", "등록금"]],
    [/(영강|영어강의|외국어강의|책임수업시간|강의시수)/u, ["외국어강의", "책임수업시간"]],
    [/(총학생회|학생자치|학생회칙)/u, ["총학생회", "학생자치활동"]],
    [/(대관|대여|빌리|공간|시설|강의실|운동장)/u, ["대관", "대여"]],
    [/(수강신청|수강정정|수강변경)/u, ["수강신청"]],
    [/(학위청구논문|논문심사|논문제출|지도교수)/u, ["학위청구논문", "지도교수"]],
  ];

  for (const [regex, values] of mappings) {
    if (!regex.test(compactQuery)) continue;
    for (const value of values) topics.add(value);
  }
  return Array.from(topics);
}

function extractSpecificQueryUnits(query: string): string[] {
  const units = new Set<string>();
  for (const match of query.matchAll(/[가-힣A-Za-z0-9·ㆍ\-()]+(?:학과|학부|전공|대학원|사업단|센터|연구단|MBA|Track|TRACK)/gu)) {
    const value = match[0].replace(/\s+/g, " ").trim();
    if (value.length >= 3) units.add(value);
  }
  return Array.from(units);
}
