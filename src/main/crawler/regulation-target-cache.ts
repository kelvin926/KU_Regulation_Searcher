import fs from "node:fs";
import { MVP_REGULATION_TARGETS } from "../../shared/constants";
import type { RegulationTarget, RegulationTargetCacheInfo } from "../../shared/types";
import type { AppPaths } from "../app-paths";
import type { Logger } from "../logs/logger";

export interface RegulationTargetCache {
  refreshedAt: string | null;
  targets: RegulationTarget[];
}

export class RegulationTargetCacheStore {
  constructor(
    private readonly paths: AppPaths,
    private readonly logger: Logger,
  ) {}

  loadTargets(): RegulationTarget[] {
    return this.load().targets;
  }

  loadInfo(): RegulationTargetCacheInfo {
    const cached = this.load();
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

  load(): RegulationTargetCache {
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
        !Array.isArray(parsed) &&
        parsed &&
        typeof parsed === "object" &&
        typeof (parsed as { refreshedAt?: unknown }).refreshedAt === "string"
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

  save(targets: RegulationTarget[]): void {
    fs.writeFileSync(
      this.paths.targetCachePath,
      JSON.stringify({ refreshedAt: new Date().toISOString(), targets: sortTargets(targets) }, null, 2),
      "utf8",
    );
  }
}

export function getFallbackTargets(): RegulationTarget[] {
  return MVP_REGULATION_TARGETS.map((target) => ({ ...target }));
}

export function cloneTargets(targets: RegulationTarget[]): RegulationTarget[] {
  return targets.map((target) => ({ ...target }));
}

export function sortTargets(targets: RegulationTarget[]): RegulationTarget[] {
  return [...targets].sort((a, b) => {
    const bySortPath = compareNumberPath(a.sortPath, b.sortPath);
    if (bySortPath !== 0) return bySortPath;
    const byCategory = (a.category ?? "").localeCompare(b.category ?? "", "ko-KR");
    if (byCategory !== 0) return byCategory;
    return a.regulationName.localeCompare(b.regulationName, "ko-KR");
  });
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
