import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { LEGACY_APP_DATA_FOLDER_NAME } from "../shared/constants";

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

export function migrateLegacyAppData(paths: AppPaths): void {
  const legacyUserData = path.join(app.getPath("appData"), LEGACY_APP_DATA_FOLDER_NAME);
  if (legacyUserData === paths.userData || !fs.existsSync(legacyUserData)) return;

  for (const name of ["data", "auth", "config", "logs"] as const) {
    copyIfMissing(path.join(legacyUserData, name), path.join(paths.userData, name));
  }

  for (const name of ["Local State", "Preferences"] as const) {
    copyIfMissing(path.join(legacyUserData, name), path.join(paths.userData, name));
  }
}

function copyIfMissing(source: string, destination: string): void {
  if (!fs.existsSync(source) || fs.existsSync(destination)) return;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}
