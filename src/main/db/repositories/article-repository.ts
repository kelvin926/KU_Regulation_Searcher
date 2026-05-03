import type BetterSqlite3 from "better-sqlite3";
import type { ArticleRecord } from "../../../shared/types";

export class ArticleRepository {
  constructor(private readonly db: BetterSqlite3.Database) {}

  getArticleById(id: number): ArticleRecord | null {
    return (this.db.prepare("SELECT * FROM articles WHERE id = ?").get(id) as ArticleRecord | undefined) ?? null;
  }

  getArticlesByIds(ids: number[]): ArticleRecord[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(",");
    const articles = this.db
      .prepare(`SELECT * FROM articles WHERE id IN (${placeholders})`)
      .all(...ids) as ArticleRecord[];
    const byId = new Map(articles.map((article) => [article.id, article]));
    return ids.map((id) => byId.get(id)).filter((article): article is ArticleRecord => Boolean(article));
  }
}
