import { AppError } from "../../shared/errors";
import type { RegulationTarget, SyncFailure, SyncProgress } from "../../shared/types";

export type SyncProgressBase = Omit<
  SyncProgress,
  "totalCount" | "successCount" | "failedCount" | "failures" | "completedSeqHistories"
>;

export interface SyncProgressSnapshot {
  totalCount: number;
  successCount: number;
  failures: SyncFailure[];
  completedSeqHistories: number[];
}

export function buildSyncProgress(base: SyncProgressBase, snapshot: SyncProgressSnapshot): SyncProgress {
  return {
    ...base,
    totalCount: snapshot.totalCount,
    successCount: snapshot.successCount,
    failedCount: snapshot.failures.length,
    failures: [...snapshot.failures],
    completedSeqHistories: [...snapshot.completedSeqHistories],
  };
}

export function toSyncFailure(target: RegulationTarget, error: unknown): SyncFailure {
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

export function delay(ms: number, signal: AbortSignal): Promise<void> {
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
