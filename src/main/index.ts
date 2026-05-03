import { app, BrowserWindow } from "electron";
import { APP_NAME } from "../shared/constants";
import { getAppPaths, ensureAppPaths, migrateLegacyAppData } from "./app-paths";
import { SessionManager } from "./auth/session-manager";
import { DatabaseService } from "./db/database";
import { Logger } from "./logs/logger";
import { ApiKeyStore } from "./security/api-key-store";
import { SettingsStore } from "./security/settings-store";
import { RegulationSyncService } from "./crawler/regulation-sync";
import { SearchService } from "./search/fts-search";
import { GeminiClient } from "./ai/gemini-client";
import { createMainWindow } from "./window";
import { registerIpcHandlers } from "./ipc/register-ipc";
import type { IpcContext } from "./ipc/types";

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
  migrateLegacyAppData(paths);
  ensureAppPaths(paths);

  logger = new Logger(paths);
  db = new DatabaseService(paths.dbPath);
  sessionManager = new SessionManager(paths, logger);
  apiKeyStore = new ApiKeyStore(paths);
  settingsStore = new SettingsStore(paths);
  syncService = new RegulationSyncService(db, logger, paths);
  searchService = new SearchService(db);
  geminiClient = new GeminiClient();

  const ipcContext: IpcContext = {
    getMainWindow: () => mainWindow,
    paths,
    db,
    logger,
    sessionManager,
    apiKeyStore,
    settingsStore,
    syncService,
    searchService,
    geminiClient,
  };
  registerIpcHandlers(ipcContext);
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
