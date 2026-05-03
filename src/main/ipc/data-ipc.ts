import { ipcMain, shell } from "electron";
import fs from "node:fs";
import { AppError } from "../../shared/errors";
import { ensureAppPaths } from "../app-paths";
import type { IpcContext } from "./types";
import type { IpcHandlerWrap } from "./wrap";

export function registerDataIpc(context: IpcContext, wrap: IpcHandlerWrap): void {
  ipcMain.handle("data:clearSession", async () =>
    wrap(async () => {
      await context.sessionManager.clearSession();
      return true;
    }),
  );
  ipcMain.handle("data:openFolder", async () =>
    wrap(async () => {
      ensureAppPaths(context.paths);
      const errorMessage = await shell.openPath(context.paths.userData);
      if (errorMessage) {
        throw new AppError("UNKNOWN_API_ERROR", errorMessage);
      }
      return true;
    }),
  );
  ipcMain.handle("data:clearAll", async () =>
    wrap(async () => {
      context.db.clearDatabase();
      await context.sessionManager.clearSession();
      context.apiKeyStore.delete();
      context.settingsStore.clear();
      fs.writeFileSync(context.paths.logPath, "", "utf8");
      return context.db.getStats();
    }),
  );
}
