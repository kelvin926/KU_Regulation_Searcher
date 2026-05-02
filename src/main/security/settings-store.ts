import fs from "node:fs";
import { DEFAULT_MODEL_ID, DEFAULT_RAG_ARTICLES, HARD_MAX_RAG_ARTICLES, MAX_RAG_ARTICLES, MIN_RAG_ARTICLES } from "../../shared/constants";
import type { AiModelId, AiTokenUsage, AiUsageStats, RagCandidateSettings } from "../../shared/types";
import type { AppPaths } from "../app-paths";

interface SettingsFile {
  modelId?: AiModelId;
  usage?: Partial<AiUsageStats>;
  rag?: Partial<RagCandidateSettings>;
}

export class SettingsStore {
  constructor(private readonly paths: AppPaths) {}

  getModelId(): AiModelId {
    const settings = this.read();
    return settings.modelId ?? DEFAULT_MODEL_ID;
  }

  setModelId(modelId: AiModelId): void {
    this.write({ ...this.read(), modelId });
  }

  getRagSettings(): RagCandidateSettings {
    return normalizeRagSettings(this.read().rag);
  }

  setRagSettings(settings: Partial<RagCandidateSettings>): RagCandidateSettings {
    const current = this.read();
    const next = normalizeRagSettings({ ...current.rag, ...settings });
    this.write({ ...current, rag: next });
    return next;
  }

  getUsage(): AiUsageStats {
    return normalizeUsage(this.read().usage);
  }

  addUsage(usage: Partial<AiTokenUsage>): AiUsageStats {
    const current = this.getUsage();
    const next: AiUsageStats = {
      requestCount: current.requestCount + 1,
      promptTokenCount: current.promptTokenCount + (usage.promptTokenCount ?? 0),
      candidatesTokenCount: current.candidatesTokenCount + (usage.candidatesTokenCount ?? 0),
      thoughtsTokenCount: current.thoughtsTokenCount + (usage.thoughtsTokenCount ?? 0),
      totalTokenCount: current.totalTokenCount + (usage.totalTokenCount ?? 0),
      lastUsedAt: new Date().toISOString(),
    };
    this.write({ ...this.read(), usage: next });
    return next;
  }

  resetUsage(): AiUsageStats {
    const next = emptyUsage();
    this.write({ ...this.read(), usage: next });
    return next;
  }

  clear(): void {
    if (fs.existsSync(this.paths.settingsPath)) {
      fs.rmSync(this.paths.settingsPath, { force: true });
    }
  }

  private read(): SettingsFile {
    try {
      if (!fs.existsSync(this.paths.settingsPath)) return {};
      return JSON.parse(fs.readFileSync(this.paths.settingsPath, "utf8")) as SettingsFile;
    } catch {
      return {};
    }
  }

  private write(settings: SettingsFile): void {
    fs.writeFileSync(this.paths.settingsPath, JSON.stringify(settings, null, 2), "utf8");
  }
}

function normalizeUsage(usage?: Partial<AiUsageStats>): AiUsageStats {
  return {
    requestCount: toNumber(usage?.requestCount),
    promptTokenCount: toNumber(usage?.promptTokenCount),
    candidatesTokenCount: toNumber(usage?.candidatesTokenCount),
    thoughtsTokenCount: toNumber(usage?.thoughtsTokenCount),
    totalTokenCount: toNumber(usage?.totalTokenCount),
    lastUsedAt: typeof usage?.lastUsedAt === "string" ? usage.lastUsedAt : null,
  };
}

function normalizeRagSettings(settings?: Partial<RagCandidateSettings>): RagCandidateSettings {
  return {
    searchCandidateLimit: clampInteger(settings?.searchCandidateLimit, DEFAULT_RAG_ARTICLES),
    maxCandidateLimit: clampInteger(settings?.maxCandidateLimit, MAX_RAG_ARTICLES),
  };
}

function emptyUsage(): AiUsageStats {
  return {
    requestCount: 0,
    promptTokenCount: 0,
    candidatesTokenCount: 0,
    thoughtsTokenCount: 0,
    totalTokenCount: 0,
    lastUsedAt: null,
  };
}

function toNumber(value: unknown): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function clampInteger(value: unknown, fallback: number): number {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, MIN_RAG_ARTICLES), HARD_MAX_RAG_ARTICLES);
}
