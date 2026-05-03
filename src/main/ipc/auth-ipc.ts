import { ipcMain } from "electron";
import { AppError } from "../../shared/errors";
import type { IpcContext } from "./types";
import type { IpcHandlerWrap } from "./wrap";

export function registerAuthIpc(context: IpcContext, wrap: IpcHandlerWrap): void {
  ipcMain.handle("auth:openLogin", async () =>
    wrap(async () => {
      const mainWindow = context.getMainWindow();
      if (!mainWindow) throw new AppError("UNKNOWN_API_ERROR");
      return context.sessionManager.openLoginWindow(mainWindow);
    }),
  );

  ipcMain.handle("auth:status", async () => wrap(() => context.sessionManager.checkStatus()));
  ipcMain.handle("auth:logout", async () =>
    wrap(async () => {
      await context.sessionManager.clearSession();
      return { status: "AUTH_REQUIRED", message: "[AUTH_REQUIRED] 로그인 세션을 삭제했습니다." };
    }),
  );
}
