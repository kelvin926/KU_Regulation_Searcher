import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

export interface AppPaths {
  userData: string;
  dataDir: string;
  dbPath: string;
  authDir: string;
  logsDir: string;
  logPath: string;
  configDir: string;
  settingsPath: string;
  targetCachePath: string;
}

export function getAppPaths(): AppPaths {
  const userData = app.getPath("userData");
  const dataDir = path.join(userData, "data");
  const authDir = path.join(userData, "auth");
  const logsDir = path.join(userData, "logs");
  const configDir = path.join(userData, "config");

  return {
    userData,
    dataDir,
    dbPath: path.join(dataDir, "ku-policy.sqlite"),
    authDir,
    logsDir,
    logPath: path.join(logsDir, "app.log"),
    configDir,
    settingsPath: path.join(configDir, "settings.json"),
    targetCachePath: path.join(configDir, "regulation-targets.json"),
  };
}

export function ensureAppPaths(paths: AppPaths): void {
  for (const dir of [paths.userData, paths.dataDir, paths.authDir, paths.logsDir, paths.configDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
