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
import { parseSearchOperators } from "./search-operators";

const RERANK_POOL_MULTIPLIER = 5;
const MIN_RERANK_POOL_SIZE = 150;
const MAX_RERANK_POOL_SIZE = 300;
const DIRECT_REGULATION_POOL_SIZE = 800;

export class SearchService {
  constructor(private readonly db: DatabaseService) {}

  searchForQuestion(query: string, limit: number): AskSearchResult {
    const stats = this.db.getStats();
    if (stats.articleCount === 0) {
      return { articles: [], expandedKeywords: [], errorCode: "LOCAL_DB_EMPTY" };
    }

    const safeLimit = clampSearchCandidateLimit(limit);
    const searchPoolLimit = getRerankPoolLimit(safeLimit);
    const operatorQuery = parseSearchOperators(query);
    if (operatorQuery.hasOperators) {
      const result = this.db.searchArticlesByBooleanQuery(query, searchPoolLimit);
      const ranked = rankArticlesForQuestion(result.articles, query, result.highlightTerms, safeLimit);
      return {
        articles: ranked.articles,
        expandedKeywords: result.highlightTerms,
        errorCode: result.articles.length === 0 ? "NO_RELEVANT_ARTICLES" : undefined,
        candidateLimitReached: ranked.candidateLimitReached,
        searchedCandidateCount: ranked.searchedCandidateCount,
      };
    }

    const expanded = expandQuery(query);
    if (!expanded.ftsQuery) {
      return { articles: [], expandedKeywords: [], errorCode: "NO_RELEVANT_ARTICLES" };
    }

    let articles: ArticleRecord[] = [];
    for (const directRegulationName of extractDirectRegulationNames(query)) {
      articles = [
        ...articles,
        ...this.db.searchArticlesByCompactRegulationName(
          directRegulationName,
          Math.max(searchPoolLimit, DIRECT_REGULATION_POOL_SIZE),
        ),
      ];
    }

    if (expanded.intent === "regulation_lookup") {
      articles = [...articles, ...this.db.searchArticlesByRegulationNameTerms(
        [...expanded.scopeKeywords, ...expanded.coreKeywords].slice(0, 4),
        searchPoolLimit,
      )];
    }

    articles = [...articles, ...this.db.searchArticlesByRequiredTerms(
      expanded.requiredTerms,
      expanded.optionalTerms,
      searchPoolLimit,
    )];
    try {
      if (articles.length < safeLimit) {
        articles = [...articles, ...this.db.searchArticlesByFts(expanded.ftsQuery, searchPoolLimit)];
      }
    } catch {
      if (articles.length < safeLimit) {
        articles = [...articles, ...this.db.searchArticlesByLike(expanded.keywords, searchPoolLimit)];
      }
    }

    if (articles.length === 0) {
      articles = this.db.searchArticlesByLike(expanded.keywords, searchPoolLimit);
    }

    const ranked = rankArticlesForQuestion(articles, query, expanded, safeLimit);
    return {
      articles: ranked.articles,
      expandedKeywords: expanded.keywords,
      errorCode: articles.length === 0 ? "NO_RELEVANT_ARTICLES" : undefined,
      candidateLimitReached: ranked.candidateLimitReached,
      searchedCandidateCount: ranked.searchedCandidateCount,
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

function getRerankPoolLimit(limit: number): number {
  return Math.min(Math.max(limit * RERANK_POOL_MULTIPLIER, MIN_RERANK_POOL_SIZE), MAX_RERANK_POOL_SIZE);
}
