import { ipcMain } from "electron";
import { AI_MODELS } from "../../shared/constants";
import { AppError } from "../../shared/errors";
import type { AiModelId } from "../../shared/types";
import type { IpcContext } from "./types";
import type { IpcHandlerWrap } from "./wrap";

export function registerSettingsIpc(context: IpcContext, wrap: IpcHandlerWrap): void {
  ipcMain.handle("settings:get", async () => wrap(() => getAiSettings(context)));
  ipcMain.handle("settings:setModel", async (_event, modelId: AiModelId) =>
    wrap(() => {
      assertModelId(modelId);
      context.settingsStore.setModelId(modelId);
      return getAiSettings(context);
    }),
  );
  ipcMain.handle("settings:saveApiKey", async (_event, apiKey: string) =>
    wrap(() => {
      context.apiKeyStore.save(apiKey);
      return getAiSettings(context);
    }),
  );
  ipcMain.handle("settings:deleteApiKey", async () =>
    wrap(() => {
      context.apiKeyStore.delete();
      return getAiSettings(context);
    }),
  );
  ipcMain.handle("settings:testConnection", async (_event, apiKey?: string) =>
    wrap(async () => {
      const key = apiKey?.trim() ? apiKey : context.apiKeyStore.load();
      const usage = await context.geminiClient.testConnection(key, context.settingsStore.getModelId());
      context.settingsStore.addUsage(usage);
      return true;
    }),
  );
  ipcMain.handle("settings:setRagSettings", async (_event, settings: unknown) =>
    wrap(() => {
      context.settingsStore.setRagSettings(isRecord(settings) ? settings : {});
      return getAiSettings(context);
    }),
  );
  ipcMain.handle("settings:usage", async () => wrap(() => context.settingsStore.getUsage()));
  ipcMain.handle("settings:resetUsage", async () =>
    wrap(() => {
      context.settingsStore.resetUsage();
      return getAiSettings(context);
    }),
  );
}

function getAiSettings(context: IpcContext) {
  return {
    modelId: context.settingsStore.getModelId(),
    hasApiKey: context.apiKeyStore.hasApiKey(),
    usage: context.settingsStore.getUsage(),
    rag: context.settingsStore.getRagSettings(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertModelId(modelId: AiModelId): void {
  if (!AI_MODELS.some((model) => model.id === modelId)) {
    throw new AppError("MODEL_UNAVAILABLE");
  }
}
