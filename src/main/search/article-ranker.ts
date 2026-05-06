import type { ArticleRecord, QueryScopeOption } from "../../shared/types";
import type { ExpandedQuery } from "./query-expander";
import { rankArticlesByScope } from "./scope-ranker";

export interface RankedArticleResult {
  articles: ArticleRecord[];
  candidateLimitReached: boolean;
  searchedCandidateCount: number;
}

export function dedupeAndLimitArticles(articles: ArticleRecord[], limit: number): ArticleRecord[] {
  const seen = new Set<number>();
  const results: ArticleRecord[] = [];
  for (const article of articles) {
    if (seen.has(article.id)) continue;
    seen.add(article.id);
    results.push(article);
    if (results.length >= limit) break;
  }
  return results;
}

export function rankArticlesForQuestion(
  articles: ArticleRecord[],
  query: string,
  queryInfo: readonly string[] | ExpandedQuery,
  limit: number,
  options: { scope?: QueryScopeOption } = {},
): RankedArticleResult {
  return rankArticlesByScope(articles, { query, queryInfo, limit, scope: options.scope });
}
