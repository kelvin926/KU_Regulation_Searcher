import BetterSqlite3 from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type {
  ArticleRecord,
  CustomRegulationInput,
  CustomRegulationRecord,
  DbStats,
  RegulationRecord,
  SyncFailure,
} from "../../shared/types";
import { parseCustomRegulationBody } from "./custom-regulation-parser";
import { runMigrations } from "./migrations";
import { ArticleRepository } from "./repositories/article-repository";
import { RegulationRepository } from "./repositories/regulation-repository";
import { SearchRepository } from "./repositories/search-repository";
import { SyncLogRepository } from "./repositories/sync-log-repository";

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
  private readonly dbPath: string;
  private readonly articles: ArticleRepository;
  private readonly regulations: RegulationRepository;
  private readonly search: SearchRepository;
  private readonly syncLogs: SyncLogRepository;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new BetterSqlite3(dbPath);
    runMigrations(this.db);
    this.articles = new ArticleRepository(this.db);
    this.regulations = new RegulationRepository(this.db);
    this.search = new SearchRepository(this.db);
    this.syncLogs = new SyncLogRepository(this.db);
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
      storageBytes: this.getStorageBytes(),
    };
  }

  upsertRegulation(meta: RegulationMetaForDb, parsed: ParsedRegulationForDb, rawHtml: string): RegulationRecord {
    return this.regulations.upsertRegulation(meta, parsed, rawHtml);
  }

  createCustomRegulation(input: CustomRegulationInput): CustomRegulationRecord {
    return this.regulations.createCustomRegulation(input, parseCustomRegulationBody(input.regulationName, input.body));
  }

  updateCustomRegulation(id: number, input: CustomRegulationInput): CustomRegulationRecord {
    return this.regulations.updateCustomRegulation(id, input, parseCustomRegulationBody(input.regulationName, input.body));
  }

  deleteCustomRegulation(id: number): boolean {
    return this.regulations.deleteCustomRegulation(id);
  }

  listCustomRegulations(): CustomRegulationRecord[] {
    return this.regulations.listCustomRegulations();
  }

  beginSync(totalCount: number): number {
    return this.syncLogs.beginSync(totalCount);
  }

  finishSync(
    syncLogId: number,
    status: "completed" | "failed" | "cancelled",
    successCount: number,
    failedCount: number,
    failures: SyncFailure[],
  ): void {
    this.syncLogs.finishSync(syncLogId, status, successCount, failedCount, failures);
  }

  listLatestFailures(limit = 50): SyncFailure[] {
    return this.syncLogs.listLatestFailures(limit);
  }

  clearSyncFailures(): void {
    this.syncLogs.clearSyncFailures();
  }

  searchArticlesByFts(ftsQuery: string, limit: number): ArticleRecord[] {
    return this.search.searchArticlesByFts(ftsQuery, limit);
  }

  searchArticlesByLike(terms: string[], limit: number): ArticleRecord[] {
    return this.search.searchArticlesByLike(terms, limit);
  }

  searchArticlesByRequiredTerms(requiredTerms: string[], optionalTerms: string[], limit: number): ArticleRecord[] {
    return this.search.searchArticlesByRequiredTerms(requiredTerms, optionalTerms, limit);
  }

  searchArticlesByRegulationNameTerms(terms: string[], limit: number): ArticleRecord[] {
    return this.search.searchArticlesByRegulationNameTerms(terms, limit);
  }

  searchArticlesByCompactRegulationName(regulationName: string, limit: number): ArticleRecord[] {
    return this.search.searchArticlesByCompactRegulationName(regulationName, limit);
  }

  searchArticlesByBooleanQuery(query: string, limit: number): { articles: ArticleRecord[]; highlightTerms: string[] } {
    return this.search.searchArticlesByBooleanQuery(query, limit);
  }

  searchArticlePage(params: {
    regulationName?: string;
    bodyQuery?: string;
    articleNo?: string;
    limit: number;
  }): ArticleRecord[] {
    return this.search.searchArticlePage(params);
  }

  getArticleById(id: number): ArticleRecord | null {
    return this.articles.getArticleById(id);
  }

  getArticlesByIds(ids: number[]): ArticleRecord[] {
    return this.articles.getArticlesByIds(ids);
  }

  listRegulations(): RegulationRecord[] {
    return this.regulations.listRegulations();
  }

  listStoredSeqHistories(): number[] {
    return this.regulations.listStoredSeqHistories();
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

  private getStorageBytes(): number {
    return [this.dbPath, `${this.dbPath}-wal`, `${this.dbPath}-shm`].reduce((total, filePath) => {
      try {
        return total + fs.statSync(filePath).size;
      } catch {
        return total;
      }
    }, 0);
  }
}
