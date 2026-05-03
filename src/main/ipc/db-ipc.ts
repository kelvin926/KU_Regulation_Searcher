import { ipcMain } from "electron";
import type { IpcContext } from "./types";
import type { IpcHandlerWrap } from "./wrap";

export function registerDbIpc(context: IpcContext, wrap: IpcHandlerWrap): void {
  ipcMain.handle("db:stats", async () => wrap(() => context.db.getStats()));
  ipcMain.handle("db:failures", async () => wrap(() => context.db.listLatestFailures()));
  ipcMain.handle("db:storedSeqHistories", async () => wrap(() => context.db.listStoredSeqHistories()));
  ipcMain.handle("db:clear", async () =>
    wrap(() => {
      context.db.clearDatabase();
      return context.db.getStats();
    }),
  );
}
