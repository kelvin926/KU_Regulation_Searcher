import type { ArticleRecord } from "../../shared/types";

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
