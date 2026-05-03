import { AppError } from "../../shared/errors";
import type { RegulationTarget, RegulationTargetCacheInfo, SyncProgress, SyncSummary } from "../../shared/types";
import type { AppPaths } from "../app-paths";
import type { DatabaseService } from "../db/database";
import type { Logger } from "../logs/logger";
import { fetchRegulationTargetsFromSite } from "./regulation-targets";
import { RegulationSyncRunner } from "./regulation-sync-runner";
import { cloneTargets, getFallbackTargets, RegulationTargetCacheStore } from "./regulation-target-cache";

export class RegulationSyncService {
  private cachedTargets: RegulationTarget[] | null = null;
  private readonly targetCache: RegulationTargetCacheStore;
  private readonly runner: RegulationSyncRunner;

  constructor(
    db: DatabaseService,
    logger: Logger,
    paths: AppPaths,
  ) {
    this.targetCache = new RegulationTargetCacheStore(paths, logger);
    this.runner = new RegulationSyncRunner(db, logger);
  }

  getTargets(): RegulationTarget[] {
    if (this.cachedTargets) return cloneTargets(this.cachedTargets);

    const diskTargets = this.targetCache.loadTargets();
    if (diskTargets.length > 0) {
      this.cachedTargets = diskTargets;
      return cloneTargets(diskTargets);
    }

    return getFallbackTargets();
  }

  getTargetCacheInfo(): RegulationTargetCacheInfo {
    return this.targetCache.loadInfo();
  }

  async refreshTargets(): Promise<RegulationTarget[]> {
    const targets = await fetchRegulationTargetsFromSite();
    if (targets.length === 0) {
      throw new AppError("SYNC_FAILED", "규정 목록을 찾지 못했습니다.");
    }

    this.cachedTargets = targets;
    this.targetCache.save(targets);
    return cloneTargets(targets);
  }

  stop(): void {
    this.runner.stop();
  }

  async syncTargets(
    targets: RegulationTarget[],
    onProgress: (progress: SyncProgress) => void,
  ): Promise<SyncSummary> {
    return this.runner.run(targets, onProgress);
  }
}
