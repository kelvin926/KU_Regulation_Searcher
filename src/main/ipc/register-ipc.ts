import { registerAskIpc } from "./ask-ipc";
import { registerAuthIpc } from "./auth-ipc";
import { registerDataIpc } from "./data-ipc";
import { registerDbIpc } from "./db-ipc";
import { registerFilesIpc } from "./files-ipc";
import { registerSearchIpc } from "./search-ipc";
import { registerSettingsIpc } from "./settings-ipc";
import { registerSyncIpc } from "./sync-ipc";
import type { IpcContext } from "./types";
import { createIpcWrapper } from "./wrap";

export function registerIpcHandlers(context: IpcContext): void {
  const wrap = createIpcWrapper(context.logger);

  registerAuthIpc(context, wrap);
  registerSyncIpc(context, wrap);
  registerDbIpc(context, wrap);
  registerSettingsIpc(context, wrap);
  registerAskIpc(context, wrap);
  registerSearchIpc(context, wrap);
  registerFilesIpc(context, wrap);
  registerDataIpc(context, wrap);
}
