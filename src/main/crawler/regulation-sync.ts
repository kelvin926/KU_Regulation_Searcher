import { AppError } from "../../shared/errors";
import {
  DEFAULT_REQUEST_DELAY_MS,
  KOREA_POLICY_CONTENT_URL,
  MVP_REGULATION_TARGETS,
} from "../../shared/constants";
import type { RegulationTarget, SyncFailure, SyncProgress, SyncSummary } from "../../shared/types";
import type { DatabaseService } from "../db/database";
import { fetchWithSession } from "./fetch-with-session";
import { parseRegulationHtml } from "./regulation-parser";
import type { Logger } from "../logs/logger";

export class RegulationSyncService {
  private abortController: AbortController | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly logger: Logger,
  ) {}

  getTargets(): RegulationTarget[] {
    return MVP_REGULATION_TARGETS.map((target) => ({ ...target }));
  }

  stop(): void {
    this.abortController?.abort();
  }

  async syncTargets(
    targets: RegulationTarget[],
    onProgress: (progress: SyncProgress) => void,
  ): Promise<SyncSummary> {
    if (this.abortController) {
      throw new AppError("SYNC_FAILED", "A sync job is already running.");
    }

    this.abortController = new AbortController();
    const startedAt = new Date().toISOString();
    const failures: SyncFailure[] = [];
    let successCount = 0;
    const syncLogId = this.db.beginSync(targets.length);

    const emit = (progress: Omit<SyncProgress, "totalCount" | "successCount" | "failedCount" | "failures">) => {
      onProgress({
        ...progress,
        totalCount: targets.length,
        successCount,
        failedCount: failures.length,
        failures: [...failures],
      });
    };

    emit({ status: "running", currentName: null, message: "동기화를 시작합니다." });

    try {
      for (const target of targets) {
        if (this.abortController.signal.aborted) {
          emit({ status: "cancelled", currentName: null, message: "동기화가 중지되었습니다." });
          break;
        }

        emit({ status: "running", currentName: target.regulationName, message: `${target.regulationName} 수집 중` });

        try {
          await this.syncOne(target);
          successCount += 1;
          emit({ status: "running", currentName: target.regulationName, message: `${target.regulationName} 저장 완료` });
        } catch (error) {
          const failure = toSyncFailure(target, error);
          failures.push(failure);
          this.logger.warn("Regulation sync failed", {
            regulationName: target.regulationName,
            seqHistory: target.seqHistory,
            errorCode: failure.errorCode,
          });
          emit({ status: "running", currentName: target.regulationName, message: `${target.regulationName} 실패` });
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
        currentName: null,
        message: cancelled ? "동기화가 중지되었습니다." : "동기화가 완료되었습니다.",
        failures,
      };
      onProgress(summary);
      return summary;
    } finally {
      this.abortController = null;
    }
  }

  private async syncOne(target: RegulationTarget): Promise<void> {
    const url = `${KOREA_POLICY_CONTENT_URL}?SEQ_HISTORY=${target.seqHistory}`;
    const fetchedAt = new Date().toISOString();
    const result = await fetchWithSession(url);

    if (!result.text.includes("lawname")) {
      throw new AppError("NOT_FOUND", "규정 본문을 찾을 수 없습니다.");
    }

    const parsed = parseRegulationHtml(result.text, target.regulationName);
    if (parsed.articles.length === 0) {
      throw new AppError("SYNC_FAILED", "파싱된 조문이 없습니다.");
    }

    this.db.upsertRegulation(
      {
        regulationName: target.regulationName,
        seqHistory: target.seqHistory,
        sourceUrl: url,
        fetchedAt,
      },
      parsed,
      result.text,
    );
  }
}

function toSyncFailure(target: RegulationTarget, error: unknown): SyncFailure {
  if (error instanceof AppError) {
    return {
      regulationName: target.regulationName,
      seqHistory: target.seqHistory,
      errorCode: error.code,
      message: error.message,
    };
  }
  return {
    regulationName: target.regulationName,
    seqHistory: target.seqHistory,
    errorCode: "UNKNOWN",
    message: error instanceof Error ? error.message : "Unknown sync error",
  };
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timeout = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}
