import type { BrowserWindow } from "electron";
import type { GeminiClient } from "../ai/gemini-client";
import type { AppPaths } from "../app-paths";
import type { SessionManager } from "../auth/session-manager";
import type { RegulationSyncService } from "../crawler/regulation-sync";
import type { DatabaseService } from "../db/database";
import type { Logger } from "../logs/logger";
import type { SearchService } from "../search/fts-search";
import type { ApiKeyStore } from "../security/api-key-store";
import type { SettingsStore } from "../security/settings-store";

export interface IpcContext {
  getMainWindow: () => BrowserWindow | null;
  paths: AppPaths;
  db: DatabaseService;
  logger: Logger;
  sessionManager: SessionManager;
  apiKeyStore: ApiKeyStore;
  settingsStore: SettingsStore;
  syncService: RegulationSyncService;
  searchService: SearchService;
  geminiClient: GeminiClient;
}
