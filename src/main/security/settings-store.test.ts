import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_RAG_ARTICLES, HARD_MAX_RAG_ARTICLES, MAX_RAG_ARTICLES, MIN_RAG_ARTICLES } from "../../shared/constants";
import type { AppPaths } from "../app-paths";
import { SettingsStore } from "./settings-store";

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

describe("SettingsStore RAG candidate settings", () => {
  it("uses default candidate limits when no settings file exists", () => {
    const store = new SettingsStore(createPaths());

    expect(store.getRagSettings()).toEqual({
      searchCandidateLimit: DEFAULT_RAG_ARTICLES,
      maxCandidateLimit: MAX_RAG_ARTICLES,
    });
  });

  it("persists and clamps candidate limits", () => {
    const store = new SettingsStore(createPaths());

    expect(store.setRagSettings({ searchCandidateLimit: 99, maxCandidateLimit: 1 })).toEqual({
      searchCandidateLimit: HARD_MAX_RAG_ARTICLES,
      maxCandidateLimit: MIN_RAG_ARTICLES,
    });
    expect(store.getRagSettings()).toEqual({
      searchCandidateLimit: HARD_MAX_RAG_ARTICLES,
      maxCandidateLimit: MIN_RAG_ARTICLES,
    });
  });
});

function createPaths(): AppPaths {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ku-reg-settings-"));
  const configDir = path.join(tempDir, "config");
  fs.mkdirSync(configDir, { recursive: true });
  return {
    userData: tempDir,
    dataDir: path.join(tempDir, "data"),
    dbPath: path.join(tempDir, "data", "ku-policy.sqlite"),
    authDir: path.join(tempDir, "auth"),
    logsDir: path.join(tempDir, "logs"),
    logPath: path.join(tempDir, "logs", "app.log"),
    configDir,
    settingsPath: path.join(configDir, "settings.json"),
    targetCachePath: path.join(configDir, "regulation-targets.json"),
  };
}
