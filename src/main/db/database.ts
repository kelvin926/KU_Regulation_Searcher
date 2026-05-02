import BetterSqlite3 from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ArticleRecord, DbStats, RegulationRecord, SyncFailure } from "../../shared/types";
import { runMigrations } from "./migrations";

export interface ParsedArticleForDb {
  articleNo: string;
  articleTitle: string | null;
  articleBody: string;
  seqContents: number;
}

export interface ParsedRegulationForDb {
  regulationName: string;
  articles: ParsedArticleForDb[];
}

export interface RegulationMetaForDb {
  regulationName: string;
  seqHistory: number;
  seq?: number | null;
  regulationCode?: string | null;
  department?: string | null;
  sourceUrl: string;
  fetchedAt: string;
}

interface CountRow {
  count: number;
}

export class DatabaseService {
  private readonly db: BetterSqlite3.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new BetterSqlite3(dbPath);
    runMigrations(this.db);
  }

  close(): void {
    this.db.close();
  }

  getStats(): DbStats {
    const regulationCount = this.db.prepare("SELECT COUNT(*) AS count FROM regulations").get() as CountRow;
    const articleCount = this.db.prepare("SELECT COUNT(*) AS count FROM articles").get() as CountRow;
    const lastSync = this.db
      .prepare(
        `SELECT finished_at, status, success_count, failed_count
         FROM sync_logs
         ORDER BY id DESC
         LIMIT 1`,
      )
      .get() as
      | { finished_at: string | null; status: string; success_count: number; failed_count: number }
      | undefined;

    return {
      regulationCount: regulationCount.count,
      articleCount: articleCount.count,
      lastSyncAt: lastSync?.finished_at ?? null,
      lastSyncStatus: lastSync?.status ?? null,
      lastSuccessCount: lastSync?.success_count ?? 0,
      lastFailedCount: lastSync?.failed_count ?? 0,
    };
  }

  upsertRegulation(meta: RegulationMetaForDb, parsed: ParsedRegulationForDb, rawHtml: string): RegulationRecord {
    const rawHtmlHash = crypto.createHash("sha256").update(rawHtml).digest("hex");
    const regulationName = parsed.regulationName || meta.regulationName;
    const transaction = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO regulations (
             regulation_name, regulation_code, department, seq, seq_history, source_url, fetched_at, raw_html_hash
           ) VALUES (
             @regulationName, @regulationCode, @department, @seq, @seqHistory, @sourceUrl, @fetchedAt, @rawHtmlHash
           )
           ON CONFLICT(seq_history) DO UPDATE SET
             regulation_name = excluded.regulation_name,
             regulation_code = excluded.regulation_code,
             department = excluded.department,
             seq = excluded.seq,
             source_url = excluded.source_url,
             fetched_at = excluded.fetched_at,
             raw_html_hash = excluded.raw_html_hash`,
        )
        .run({
          regulationName,
          regulationCode: meta.regulationCode ?? null,
          department: meta.department ?? null,
          seq: meta.seq ?? null,
          seqHistory: meta.seqHistory,
          sourceUrl: meta.sourceUrl,
          fetchedAt: meta.fetchedAt,
          rawHtmlHash,
        });

      const regulation = this.db
        .prepare("SELECT * FROM regulations WHERE seq_history = ?")
        .get(meta.seqHistory) as RegulationRecord;

      const articleStatement = this.db.prepare(
        `INSERT INTO articles (
           regulation_id, regulation_name, article_no, article_title, article_body,
           seq, seq_history, seq_contents, source_url, fetched_at
         ) VALUES (
           @regulationId, @regulationName, @articleNo, @articleTitle, @articleBody,
           @seq, @seqHistory, @seqContents, @sourceUrl, @fetchedAt
         )
         ON CONFLICT(regulation_name, article_no, seq_history) DO UPDATE SET
           regulation_id = excluded.regulation_id,
           article_title = excluded.article_title,
           article_body = excluded.article_body,
           seq = excluded.seq,
           seq_contents = excluded.seq_contents,
           source_url = excluded.source_url,
           fetched_at = excluded.fetched_at`,
      );

      for (const article of parsed.articles) {
        articleStatement.run({
          regulationId: regulation.id,
          regulationName,
          articleNo: article.articleNo,
          articleTitle: article.articleTitle,
          articleBody: article.articleBody,
          seq: meta.seq ?? null,
          seqHistory: meta.seqHistory,
          seqContents: article.seqContents,
          sourceUrl: meta.sourceUrl,
          fetchedAt: meta.fetchedAt,
        });
      }

      return regulation;
    });

    return transaction();
  }

  beginSync(totalCount: number): number {
    const result = this.db
      .prepare(
        `INSERT INTO sync_logs (started_at, status, total_count, success_count, failed_count)
         VALUES (?, 'running', ?, 0, 0)`,
      )
      .run(new Date().toISOString(), totalCount);
    return Number(result.lastInsertRowid);
  }

  finishSync(
    syncLogId: number,
    status: "completed" | "failed" | "cancelled",
    successCount: number,
    failedCount: number,
    failures: SyncFailure[],
  ): void {
    const transaction = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE sync_logs
           SET finished_at = ?, status = ?, success_count = ?, failed_count = ?, error_summary = ?
           WHERE id = ?`,
        )
        .run(
          new Date().toISOString(),
          status,
          successCount,
          failedCount,
          failures.length > 0 ? JSON.stringify(failures) : null,
          syncLogId,
        );

      const failureStatement = this.db.prepare(
        `INSERT INTO sync_failures (
           sync_log_id, regulation_name, seq_history, error_code, message, created_at
         ) VALUES (?, ?, ?, ?, ?, ?)`,
      );
      for (const failure of failures) {
        failureStatement.run(
          syncLogId,
          failure.regulationName,
          failure.seqHistory,
          failure.errorCode,
          failure.message,
          new Date().toISOString(),
        );
      }
    });
    transaction();
  }

  listLatestFailures(limit = 50): SyncFailure[] {
    return this.db
      .prepare(
        `SELECT regulation_name AS regulationName, seq_history AS seqHistory, error_code AS errorCode, message
         FROM sync_failures
         ORDER BY id DESC
         LIMIT ?`,
      )
      .all(limit) as SyncFailure[];
  }

  searchArticlesByFts(ftsQuery: string, limit: number): ArticleRecord[] {
    return this.db
      .prepare(
        `SELECT a.*, bm25(article_fts, 2.0, 3.0, 2.0, 1.0) AS rank
         FROM article_fts
         JOIN articles a ON a.id = article_fts.rowid
         WHERE article_fts MATCH ?
         ORDER BY rank ASC
         LIMIT ?`,
      )
      .all(ftsQuery, limit) as ArticleRecord[];
  }

  searchArticlesByLike(terms: string[], limit: number): ArticleRecord[] {
    if (terms.length === 0) return [];
    const clauses = terms
      .map(
        (_, index) =>
          `(regulation_name LIKE @term${index} OR article_no LIKE @term${index} OR article_title LIKE @term${index} OR article_body LIKE @term${index})`,
      )
      .join(" OR ");
    const params = Object.fromEntries(terms.map((term, index) => [`term${index}`, `%${term}%`]));
    return this.db
      .prepare(
        `SELECT *
         FROM articles
         WHERE ${clauses}
         ORDER BY fetched_at DESC, id ASC
         LIMIT @limit`,
      )
      .all({ ...params, limit }) as ArticleRecord[];
  }

  searchArticlePage(params: {
    regulationName?: string;
    bodyQuery?: string;
    articleNo?: string;
    limit: number;
  }): ArticleRecord[] {
    const where: string[] = [];
    const bind: Record<string, unknown> = { limit: params.limit };
    if (params.regulationName?.trim()) {
      where.push("regulation_name LIKE @regulationName");
      bind.regulationName = `%${params.regulationName.trim()}%`;
    }
    if (params.bodyQuery?.trim()) {
      where.push("(article_title LIKE @bodyQuery OR article_body LIKE @bodyQuery)");
      bind.bodyQuery = `%${params.bodyQuery.trim()}%`;
    }
    if (params.articleNo?.trim()) {
      where.push("article_no = @articleNo");
      bind.articleNo = params.articleNo.trim();
    }
    const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    return this.db
      .prepare(
        `SELECT *
         FROM articles
         ${clause}
         ORDER BY regulation_name ASC, seq_contents ASC, id ASC
         LIMIT @limit`,
      )
      .all(bind) as ArticleRecord[];
  }

  getArticleById(id: number): ArticleRecord | null {
    return (this.db.prepare("SELECT * FROM articles WHERE id = ?").get(id) as ArticleRecord | undefined) ?? null;
  }

  getArticlesByIds(ids: number[]): ArticleRecord[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(",");
    return this.db
      .prepare(`SELECT * FROM articles WHERE id IN (${placeholders}) ORDER BY regulation_name ASC, seq_contents ASC`)
      .all(...ids) as ArticleRecord[];
  }

  listRegulations(): RegulationRecord[] {
    return this.db.prepare("SELECT * FROM regulations ORDER BY regulation_name ASC").all() as RegulationRecord[];
  }

  clearDatabase(): void {
    const transaction = this.db.transaction(() => {
      this.db.prepare("DELETE FROM articles").run();
      this.db.prepare("DELETE FROM regulations").run();
      this.db.prepare("DELETE FROM sync_failures").run();
      this.db.prepare("DELETE FROM sync_logs").run();
      this.db.exec("INSERT INTO article_fts(article_fts) VALUES('rebuild');");
    });
    transaction();
    this.db.exec("VACUUM;");
  }
}
