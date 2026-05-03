import { ipcMain } from "electron";
import type { DownloadRegulationFileRequest } from "../../shared/types";
import { downloadRegulationFile, listAttachmentFiles } from "../crawler/regulation-files";
import type { IpcContext } from "./types";
import type { IpcHandlerWrap } from "./wrap";

export function registerFilesIpc(_context: IpcContext, wrap: IpcHandlerWrap): void {
  ipcMain.handle("files:attachments", async (_event, seq: number | null, seqHistory: number | null) =>
    wrap(() => listAttachmentFiles(seq, seqHistory)),
  );
  ipcMain.handle("files:download", async (_event, request: DownloadRegulationFileRequest) =>
    wrap(() => downloadRegulationFile(request)),
  );
}
