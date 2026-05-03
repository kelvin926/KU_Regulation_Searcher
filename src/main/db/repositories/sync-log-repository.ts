import type BetterSqlite3 from "better-sqlite3";
import type { SyncFailure } from "../../../shared/types";

export class SyncLogRepository {
  constructor(private readonly db: BetterSqlite3.Database) {}

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

  clearSyncFailures(): void {
    this.db.prepare("DELETE FROM sync_failures").run();
  }
}
