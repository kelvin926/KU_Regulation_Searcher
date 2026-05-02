import type { AskSearchResult, ArticleRecord, SearchPageRequest } from "../../shared/types";
import { AppError } from "../../shared/errors";
import { MAX_RAG_ARTICLES } from "../../shared/constants";
import type { DatabaseService } from "../db/database";
import { normalizeArticleNo } from "../crawler/regulation-parser";
import { dedupeAndLimitArticles } from "./article-ranker";
import { expandQuery } from "./query-expander";
import { parseSearchOperators } from "./search-operators";

export class SearchService {
  constructor(private readonly db: DatabaseService) {}

  searchForQuestion(query: string, limit: number): AskSearchResult {
    const stats = this.db.getStats();
    if (stats.articleCount === 0) {
      return { articles: [], expandedKeywords: [], errorCode: "LOCAL_DB_EMPTY" };
    }

    const operatorQuery = parseSearchOperators(query);
    if (operatorQuery.hasOperators) {
      const result = this.db.searchArticlesByBooleanQuery(query, limit);
      return {
        articles: dedupeAndLimitArticles(result.articles, limit),
        expandedKeywords: result.highlightTerms,
        errorCode: result.articles.length === 0 ? "NO_RELEVANT_ARTICLES" : undefined,
      };
    }

    const expanded = expandQuery(query);
    if (!expanded.ftsQuery) {
      return { articles: [], expandedKeywords: [], errorCode: "NO_RELEVANT_ARTICLES" };
    }

    let articles: ArticleRecord[] = [];
    try {
      articles = this.db.searchArticlesByFts(expanded.ftsQuery, limit);
    } catch {
      articles = this.db.searchArticlesByLike(expanded.keywords, limit);
    }

    if (articles.length === 0) {
      articles = this.db.searchArticlesByLike(expanded.keywords, limit);
    }

    return {
      articles: dedupeAndLimitArticles(articles, limit),
      expandedKeywords: expanded.keywords,
      errorCode: articles.length === 0 ? "NO_RELEVANT_ARTICLES" : undefined,
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

  getCandidateArticles(articleIds: number[]): ArticleRecord[] {
    const articles = this.db.getArticlesByIds(articleIds.slice(0, MAX_RAG_ARTICLES));
    if (articles.length === 0) {
      throw new AppError("NO_RELEVANT_ARTICLES");
    }
    return articles;
  }
}
