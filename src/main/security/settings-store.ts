import fs from "node:fs";
import { DEFAULT_MODEL_ID } from "../../shared/constants";
import type { AiModelId } from "../../shared/types";
import type { AppPaths } from "../app-paths";

interface SettingsFile {
  modelId?: AiModelId;
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
