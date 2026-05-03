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
    const directRegulationName = extractDirectRegulationName(query);
    if (directRegulationName) {
      articles = this.db.searchArticlesByCompactRegulationName(directRegulationName, searchPoolLimit);
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

function extractDirectRegulationName(query: string): string | null {
  const normalized = query.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  const match = normalized.match(
    /^(.+(?:운영\s*규\s*정|시행\s*세\s*칙|규\s*정|내\s*규|세\s*칙|학\s*칙|지\s*침|규\s*칙))(?:의|에서|\s|$)/u,
  );
  const name = match?.[1]?.trim();
  return name && name.length >= 4 ? name : null;
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
