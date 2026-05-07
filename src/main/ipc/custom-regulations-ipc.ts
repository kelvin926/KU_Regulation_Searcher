import { ipcMain } from "electron";
import type { CustomRegulationInput } from "../../shared/types";
import type { IpcContext } from "./types";
import type { IpcHandlerWrap } from "./wrap";

export function registerCustomRegulationsIpc(context: IpcContext, wrap: IpcHandlerWrap): void {
  ipcMain.handle("customRegulations:list", async () => wrap(() => context.db.listCustomRegulations()));
  ipcMain.handle("customRegulations:create", async (_event, input: CustomRegulationInput) =>
    wrap(() => context.db.createCustomRegulation(validateCustomRegulationInput(input))),
  );
  ipcMain.handle("customRegulations:update", async (_event, id: number, input: CustomRegulationInput) =>
    wrap(() => context.db.updateCustomRegulation(id, validateCustomRegulationInput(input))),
  );
  ipcMain.handle("customRegulations:delete", async (_event, id: number) =>
    wrap(() => context.db.deleteCustomRegulation(id)),
  );
}

function validateCustomRegulationInput(input: CustomRegulationInput): CustomRegulationInput {
  const regulationName = input.regulationName.trim();
  const body = input.body.trim();
  if (regulationName.length < 2) throw new Error("커스텀 규정명은 2자 이상이어야 합니다.");
  if (body.length < 10) throw new Error("커스텀 규정 본문은 10자 이상 입력해야 합니다.");
  return {
    regulationName,
    customCampus: input.customCampus ?? "auto",
    customScope: input.customScope,
    customNote: input.customNote?.trim() ?? "",
    body,
  };
}
