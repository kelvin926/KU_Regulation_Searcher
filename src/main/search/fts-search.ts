import type { AskSearchResult, ArticleRecord, SearchPageRequest } from "../../shared/types";
import { AppError } from "../../shared/errors";
import { HARD_MAX_RAG_ARTICLES, MIN_RAG_ARTICLES } from "../../shared/constants";
import type { DatabaseService } from "../db/database";
import { normalizeArticleNo } from "../crawler/regulation-parser";
import { rankArticlesForQuestion } from "./article-ranker";
import { expandQuery } from "./query-expander";
import { parseSearchOperators } from "./search-operators";

const RERANK_POOL_MULTIPLIER = 4;
const MIN_RERANK_POOL_SIZE = 60;
const MAX_RERANK_POOL_SIZE = 160;

export class SearchService {
  constructor(private readonly db: DatabaseService) {}

  searchForQuestion(query: string, limit: number): AskSearchResult {
    const stats = this.db.getStats();
    if (stats.articleCount === 0) {
      return { articles: [], expandedKeywords: [], errorCode: "LOCAL_DB_EMPTY" };
    }

    const safeLimit = clampCandidateLimit(limit);
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
    try {
      articles = this.db.searchArticlesByFts(expanded.ftsQuery, searchPoolLimit);
    } catch {
      articles = this.db.searchArticlesByLike(expanded.keywords, searchPoolLimit);
    }

    if (articles.length === 0) {
      articles = this.db.searchArticlesByLike(expanded.keywords, searchPoolLimit);
    }

    const ranked = rankArticlesForQuestion(articles, query, expanded.keywords, safeLimit);
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
    const limit = clampCandidateLimit(maxCandidateLimit);
    const articles = this.db.getArticlesByIds(articleIds.slice(0, limit));
    if (articles.length === 0) {
      throw new AppError("NO_RELEVANT_ARTICLES");
    }
    return articles;
  }
}

function clampCandidateLimit(value: number): number {
  if (!Number.isFinite(value)) return MIN_RAG_ARTICLES;
  return Math.min(Math.max(Math.round(value), MIN_RAG_ARTICLES), HARD_MAX_RAG_ARTICLES);
}

function getRerankPoolLimit(limit: number): number {
  return Math.min(Math.max(limit * RERANK_POOL_MULTIPLIER, MIN_RERANK_POOL_SIZE), MAX_RERANK_POOL_SIZE);
}
