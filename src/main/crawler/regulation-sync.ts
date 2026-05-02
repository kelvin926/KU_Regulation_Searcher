import { AppError } from "../../shared/errors";
import fs from "node:fs";
import {
  DEFAULT_REQUEST_DELAY_MS,
  KOREA_POLICY_CONTENT_URL,
  MVP_REGULATION_TARGETS,
} from "../../shared/constants";
import type { RegulationTarget, RegulationTargetCacheInfo, SyncFailure, SyncProgress, SyncSummary } from "../../shared/types";
import type { AppPaths } from "../app-paths";
import type { DatabaseService } from "../db/database";
import { fetchWithSession } from "./fetch-with-session";
import { fetchRegulationTargetsFromSite } from "./regulation-targets";
import { parseRegulationHtml } from "./regulation-parser";
import type { Logger } from "../logs/logger";

export class RegulationSyncService {
  private abortController: AbortController | null = null;
  private cachedTargets: RegulationTarget[] | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly logger: Logger,
    private readonly paths: AppPaths,
  ) {}

  getTargets(): RegulationTarget[] {
    if (this.cachedTargets) return cloneTargets(this.cachedTargets);

    const diskTargets = this.loadCachedTargets();
    if (diskTargets.length > 0) {
      this.cachedTargets = diskTargets;
      return cloneTargets(diskTargets);
    }

    return getFallbackTargets();
  }

  getTargetCacheInfo(): RegulationTargetCacheInfo {
    const cached = this.loadTargetCache();
    if (cached.targets.length > 0) {
      return {
        hasRefreshed: true,
        refreshedAt: cached.refreshedAt,
        targetCount: cached.targets.length,
      };
    }

    return {
      hasRefreshed: false,
      refreshedAt: null,
      targetCount: getFallbackTargets().length,
    };
  }

  async refreshTargets(): Promise<RegulationTarget[]> {
    const targets = await fetchRegulationTargetsFromSite();
    if (targets.length === 0) {
      throw new AppError("SYNC_FAILED", "규정 목록을 찾지 못했습니다.");
    }

    this.cachedTargets = targets;
    this.saveCachedTargets(targets);
    return cloneTargets(targets);
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
    const url = target.sourceUrl || `${KOREA_POLICY_CONTENT_URL}?SEQ_HISTORY=${target.seqHistory}`;
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

  private loadCachedTargets(): RegulationTarget[] {
    return this.loadTargetCache().targets;
  }

  private loadTargetCache(): { refreshedAt: string | null; targets: RegulationTarget[] } {
    if (!fs.existsSync(this.paths.targetCachePath)) return { refreshedAt: null, targets: [] };

    try {
      const parsed = JSON.parse(fs.readFileSync(this.paths.targetCachePath, "utf8")) as unknown;
      const rawTargets = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray((parsed as { targets?: unknown }).targets)
          ? (parsed as { targets: unknown[] }).targets
          : [];
      if (rawTargets.length === 0) return { refreshedAt: null, targets: [] };

      const targets = rawTargets
        .map((item) => normalizeTarget(item))
        .filter((target): target is RegulationTarget => target !== null);
      const refreshedAt =
        !Array.isArray(parsed) && parsed && typeof parsed === "object" && typeof (parsed as { refreshedAt?: unknown }).refreshedAt === "string"
          ? (parsed as { refreshedAt: string }).refreshedAt
          : fs.statSync(this.paths.targetCachePath).mtime.toISOString();
      return targets.length > 0 ? { refreshedAt, targets: sortTargets(targets) } : { refreshedAt: null, targets: [] };
    } catch (error) {
      this.logger.warn("Failed to load cached regulation targets", {
        errorType: error instanceof Error ? error.name : "unknown",
      });
      return { refreshedAt: null, targets: [] };
    }
  }

  private saveCachedTargets(targets: RegulationTarget[]): void {
    fs.writeFileSync(
      this.paths.targetCachePath,
      JSON.stringify({ refreshedAt: new Date().toISOString(), targets: sortTargets(targets) }, null, 2),
      "utf8",
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

function getFallbackTargets(): RegulationTarget[] {
  return MVP_REGULATION_TARGETS.map((target) => ({ ...target }));
}

function cloneTargets(targets: RegulationTarget[]): RegulationTarget[] {
  return targets.map((target) => ({ ...target }));
}

function normalizeTarget(value: unknown): RegulationTarget | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<RegulationTarget>;
  if (typeof record.regulationName !== "string" || record.regulationName.trim().length === 0) return null;
  if (!Number.isSafeInteger(record.seqHistory) || Number(record.seqHistory) <= 0) return null;
  if (typeof record.sourceUrl !== "string" || record.sourceUrl.trim().length === 0) return null;
  const sortPath = normalizeNumberArray(record.sortPath);
  if (!sortPath) return null;
  return {
    regulationName: record.regulationName,
    seqHistory: Number(record.seqHistory),
    sourceUrl: record.sourceUrl,
    seq: Number.isSafeInteger(record.seq) ? Number(record.seq) : undefined,
    category: typeof record.category === "string" ? record.category : undefined,
    categoryPath: normalizeStringArray(record.categoryPath) ?? splitCategoryPath(record.category),
    sortPath,
  };
}

function sortTargets(targets: RegulationTarget[]): RegulationTarget[] {
  return [...targets].sort((a, b) => {
    const bySortPath = compareNumberPath(a.sortPath, b.sortPath);
    if (bySortPath !== 0) return bySortPath;
    const byCategory = (a.category ?? "").localeCompare(b.category ?? "", "ko-KR");
    if (byCategory !== 0) return byCategory;
    return a.regulationName.localeCompare(b.regulationName, "ko-KR");
  });
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return result.length > 0 ? result : undefined;
}

function normalizeNumberArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result = value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
  return result.length > 0 ? result : undefined;
}

function splitCategoryPath(category?: string): string[] | undefined {
  return category
    ?.split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

function compareNumberPath(a?: readonly number[], b?: readonly number[]): number {
  if (!a?.length && !b?.length) return 0;
  if (!a?.length) return 1;
  if (!b?.length) return -1;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const left = a[index] ?? -1;
    const right = b[index] ?? -1;
    if (left !== right) return left - right;
  }
  return 0;
}
