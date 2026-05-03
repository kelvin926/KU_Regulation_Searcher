import { ipcMain } from "electron";
import type { SearchPageRequest } from "../../shared/types";
import type { IpcContext } from "./types";
import type { IpcHandlerWrap } from "./wrap";

export function registerSearchIpc(context: IpcContext, wrap: IpcHandlerWrap): void {
  ipcMain.handle("search:articles", async (_event, request: SearchPageRequest) =>
    wrap(() => context.searchService.searchPage(request)),
  );
  ipcMain.handle("articles:get", async (_event, id: number) => wrap(() => context.db.getArticleById(id)));
}
