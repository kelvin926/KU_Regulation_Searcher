import { DEFAULT_REQUEST_DELAY_MS } from "../../shared/constants";
import { AppError } from "../../shared/errors";
import type { RegulationTarget, SyncFailure, SyncProgress, SyncSummary } from "../../shared/types";
import type { DatabaseService } from "../db/database";
import type { Logger } from "../logs/logger";
import { fetchRegulationDocument } from "./regulation-fetcher";
import { buildSyncProgress, delay, type SyncProgressBase, toSyncFailure } from "./sync-progress";

export class RegulationSyncRunner {
  private abortController: AbortController | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly logger: Logger,
  ) {}

  stop(): void {
    this.abortController?.abort();
  }

  async run(targets: RegulationTarget[], onProgress: (progress: SyncProgress) => void): Promise<SyncSummary> {
    if (this.abortController) {
      throw new AppError("SYNC_FAILED", "A sync job is already running.");
    }

    this.abortController = new AbortController();
    const startedAt = new Date().toISOString();
    const failures: SyncFailure[] = [];
    const completedSeqHistories: number[] = [];
    let successCount = 0;
    this.db.clearSyncFailures();
    const syncLogId = this.db.beginSync(targets.length);

    const emit = (progress: SyncProgressBase) => {
      onProgress(
        buildSyncProgress(progress, {
          totalCount: targets.length,
          successCount,
          failures,
          completedSeqHistories,
        }),
      );
    };

    emit({ status: "running", currentSeqHistory: null, currentName: null, message: "동기화를 시작합니다." });

    try {
      for (const target of targets) {
        if (this.abortController.signal.aborted) {
          emit({ status: "cancelled", currentSeqHistory: null, currentName: null, message: "동기화가 중지되었습니다." });
          break;
        }

        emit({
          status: "running",
          currentSeqHistory: target.seqHistory,
          currentName: target.regulationName,
          message: `${target.regulationName} 수집 중`,
        });

        try {
          await this.syncOne(target);
          successCount += 1;
          completedSeqHistories.push(target.seqHistory);
          emit({
            status: "running",
            currentSeqHistory: target.seqHistory,
            currentName: target.regulationName,
            message: `${target.regulationName} 저장 완료`,
          });
        } catch (error) {
          const failure = toSyncFailure(target, error);
          failures.push(failure);
          this.logger.warn("Regulation sync failed", {
            regulationName: target.regulationName,
            seqHistory: target.seqHistory,
            errorCode: failure.errorCode,
          });
          emit({
            status: "running",
            currentSeqHistory: target.seqHistory,
            currentName: target.regulationName,
            message: `${target.regulationName} 실패`,
          });
        }

        await delay(DEFAULT_REQUEST_DELAY_MS, this.abortController.signal);
      }

      const cancelled = this.abortController.signal.aborted;
      const finishedAt = new Date().toISOString();
      const status = cancelled ? "cancelled" : failures.length > 0 ? "failed" : "completed";
      this.db.finishSync(syncLogId, status, successCount, failures.length, failures);

      const summary: SyncSummary = {
        status,
        startedAt,
        finishedAt,
        totalCount: targets.length,
        successCount,
        failedCount: failures.length,
        currentSeqHistory: null,
        currentName: null,
        message: cancelled ? "동기화가 중지되었습니다." : "동기화가 완료되었습니다.",
        failures,
        completedSeqHistories,
      };
      onProgress(summary);
      return summary;
    } finally {
      this.abortController = null;
    }
  }

  private async syncOne(target: RegulationTarget): Promise<void> {
    const fetched = await fetchRegulationDocument(target);
    this.db.upsertRegulation(
      {
        regulationName: target.regulationName,
        seqHistory: target.seqHistory,
        seq: target.seq,
        sourceUrl: fetched.sourceUrl,
        fetchedAt: fetched.fetchedAt,
      },
      fetched.parsed,
      fetched.rawHtml,
    );
  }
}
