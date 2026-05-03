import { ipcMain } from "electron";
import { AppError } from "../../shared/errors";
import type { RegulationTarget } from "../../shared/types";
import type { IpcContext } from "./types";
import type { IpcHandlerWrap } from "./wrap";

export function registerSyncIpc(context: IpcContext, wrap: IpcHandlerWrap): void {
  ipcMain.handle("sync:targets", async () => wrap(() => context.syncService.getTargets()));
  ipcMain.handle("sync:targetCacheInfo", async () => wrap(() => context.syncService.getTargetCacheInfo()));
  ipcMain.handle("sync:refreshTargets", async () =>
    wrap(async () => {
      const authStatus = await context.sessionManager.checkStatus();
      if (authStatus.status !== "AUTHENTICATED") {
        throw new AppError(authStatus.status, authStatus.message);
      }
      return context.syncService.refreshTargets();
    }),
  );
  ipcMain.handle("sync:start", async (event, seqHistories?: number[]) =>
    wrap(async () => {
      const authStatus = await context.sessionManager.checkStatus();
      if (authStatus.status !== "AUTHENTICATED") {
        throw new AppError(authStatus.status, authStatus.message);
      }
      const targets = selectTargets(context.syncService.getTargets(), seqHistories);
      return context.syncService.syncTargets(targets, (progress) => {
        event.sender.send("sync:progress", progress);
      });
    }),
  );
  ipcMain.handle("sync:stop", async () =>
    wrap(() => {
      context.syncService.stop();
      return true;
    }),
  );
}

function selectTargets(allTargets: RegulationTarget[], seqHistories?: number[]): RegulationTarget[] {
  if (!seqHistories || seqHistories.length === 0) return allTargets;
  const selected = new Set(seqHistories);
  const targets = allTargets.filter((target) => selected.has(target.seqHistory));
  if (targets.length === 0) {
    throw new AppError("SYNC_FAILED", "동기화할 규정이 선택되지 않았습니다.");
  }
  return targets;
}
