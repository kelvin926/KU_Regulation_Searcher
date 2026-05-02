import { app, BrowserWindow, ipcMain } from "electron";
import fs from "node:fs";
import { APP_NAME, AI_MODELS, DEFAULT_RAG_ARTICLES } from "../shared/constants";
import { AppError } from "../shared/errors";
import type {
  AiModelId,
  ApiResult,
  GenerateAnswerRequest,
  RegulationTarget,
  SearchArticlesRequest,
  SearchPageRequest,
} from "../shared/types";
import { getAppPaths, ensureAppPaths } from "./app-paths";
import { SessionManager } from "./auth/session-manager";
import { DatabaseService } from "./db/database";
import { Logger } from "./logs/logger";
import { ApiKeyStore } from "./security/api-key-store";
import { SettingsStore } from "./security/settings-store";
import { RegulationSyncService } from "./crawler/regulation-sync";
import { SearchService } from "./search/fts-search";
import { GeminiClient } from "./ai/gemini-client";
import { createMainWindow } from "./window";

app.setName(APP_NAME);

let mainWindow: BrowserWindow | null = null;
let db: DatabaseService;
let logger: Logger;
let sessionManager: SessionManager;
let apiKeyStore: ApiKeyStore;
let settingsStore: SettingsStore;
let syncService: RegulationSyncService;
let searchService: SearchService;
let geminiClient: GeminiClient;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

void app.whenReady().then(() => {
  const paths = getAppPaths();
  ensureAppPaths(paths);

  logger = new Logger(paths);
  db = new DatabaseService(paths.dbPath);
  sessionManager = new SessionManager(paths, logger);
  apiKeyStore = new ApiKeyStore(paths);
  settingsStore = new SettingsStore(paths);
  syncService = new RegulationSyncService(db, logger, paths);
  searchService = new SearchService(db);
  geminiClient = new GeminiClient();

  registerIpcHandlers();
  mainWindow = createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  db?.close();
});

function registerIpcHandlers(): void {
  ipcMain.handle("auth:openLogin", async () =>
    wrap(async () => {
      if (!mainWindow) throw new AppError("UNKNOWN_API_ERROR");
      return sessionManager.openLoginWindow(mainWindow);
    }),
  );

  ipcMain.handle("auth:status", async () => wrap(() => sessionManager.checkStatus()));
  ipcMain.handle("auth:logout", async () =>
    wrap(async () => {
      await sessionManager.clearSession();
      return { status: "AUTH_REQUIRED", message: "[AUTH_REQUIRED] 세션을 삭제했습니다." };
    }),
  );

  ipcMain.handle("sync:targets", async () => wrap(() => syncService.getTargets()));
  ipcMain.handle("sync:refreshTargets", async () =>
    wrap(async () => {
      const authStatus = await sessionManager.checkStatus();
      if (authStatus.status !== "AUTHENTICATED") {
        throw new AppError(authStatus.status, authStatus.message);
      }
      return syncService.refreshTargets();
    }),
  );
  ipcMain.handle("sync:start", async (event, seqHistories?: number[]) =>
    wrap(async () => {
      const authStatus = await sessionManager.checkStatus();
      if (authStatus.status !== "AUTHENTICATED") {
        throw new AppError(authStatus.status, authStatus.message);
      }
      const targets = selectTargets(seqHistories);
      return syncService.syncTargets(targets, (progress) => {
        event.sender.send("sync:progress", progress);
      });
    }),
  );
  ipcMain.handle("sync:stop", async () =>
    wrap(() => {
      syncService.stop();
      return true;
    }),
  );

  ipcMain.handle("db:stats", async () => wrap(() => db.getStats()));
  ipcMain.handle("db:failures", async () => wrap(() => db.listLatestFailures()));
  ipcMain.handle("db:clear", async () =>
    wrap(() => {
      db.clearDatabase();
      return db.getStats();
    }),
  );

  ipcMain.handle("settings:get", async () =>
    wrap(() => ({
      modelId: settingsStore.getModelId(),
      hasApiKey: apiKeyStore.hasApiKey(),
    })),
  );
  ipcMain.handle("settings:setModel", async (_event, modelId: AiModelId) =>
    wrap(() => {
      assertModelId(modelId);
      settingsStore.setModelId(modelId);
      return { modelId, hasApiKey: apiKeyStore.hasApiKey() };
    }),
  );
  ipcMain.handle("settings:saveApiKey", async (_event, apiKey: string) =>
    wrap(() => {
      apiKeyStore.save(apiKey);
      return { modelId: settingsStore.getModelId(), hasApiKey: true };
    }),
  );
  ipcMain.handle("settings:deleteApiKey", async () =>
    wrap(() => {
      apiKeyStore.delete();
      return { modelId: settingsStore.getModelId(), hasApiKey: false };
    }),
  );
  ipcMain.handle("settings:testConnection", async (_event, apiKey?: string) =>
    wrap(async () => {
      const key = apiKey?.trim() ? apiKey : apiKeyStore.load();
      await geminiClient.testConnection(key, settingsStore.getModelId());
      return true;
    }),
  );

  ipcMain.handle("ask:search", async (_event, request: SearchArticlesRequest) =>
    wrap(() => searchService.searchForQuestion(request.query, request.limit ?? DEFAULT_RAG_ARTICLES)),
  );
  ipcMain.handle("ask:generate", async (_event, request: GenerateAnswerRequest) =>
    wrap(async () => {
      const articles = searchService.getCandidateArticles(request.articleIds);
      return geminiClient.generateAnswer({
        apiKey: apiKeyStore.load(),
        modelId: settingsStore.getModelId(),
        question: request.question,
        articles,
      });
    }),
  );
  ipcMain.handle("search:articles", async (_event, request: SearchPageRequest) =>
    wrap(() => searchService.searchPage(request)),
  );
  ipcMain.handle("articles:get", async (_event, id: number) => wrap(() => db.getArticleById(id)));

  ipcMain.handle("data:clearSession", async () =>
    wrap(async () => {
      await sessionManager.clearSession();
      return true;
    }),
  );
  ipcMain.handle("data:clearAll", async () =>
    wrap(async () => {
      db.clearDatabase();
      await sessionManager.clearSession();
      apiKeyStore.delete();
      settingsStore.clear();
      fs.writeFileSync(loggerPath(), "", "utf8");
      return db.getStats();
    }),
  );
}

async function wrap<T>(fn: () => T | Promise<T>): Promise<ApiResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, errorCode: error.code, message: error.message };
    }
    logger?.error("Unhandled IPC error", { errorType: error instanceof Error ? error.name : "unknown" });
    return {
      ok: false,
      errorCode: "UNKNOWN_API_ERROR",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function selectTargets(seqHistories?: number[]): RegulationTarget[] {
  const allTargets = syncService.getTargets();
  if (!seqHistories || seqHistories.length === 0) return allTargets;
  const selected = new Set(seqHistories);
  const targets = allTargets.filter((target) => selected.has(target.seqHistory));
  if (targets.length === 0) {
    throw new AppError("SYNC_FAILED", "동기화할 규정이 선택되지 않았습니다.");
  }
  return targets;
}

function assertModelId(modelId: AiModelId): void {
  if (!AI_MODELS.some((model) => model.id === modelId)) {
    throw new AppError("MODEL_UNAVAILABLE");
  }
}

function loggerPath(): string {
  return getAppPaths().logPath;
}
