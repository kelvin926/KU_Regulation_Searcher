import { safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";
import { AppError } from "../../shared/errors";
import type { AppPaths } from "../app-paths";

export class ApiKeyStore {
  private readonly keyPath: string;

  constructor(paths: AppPaths) {
    this.keyPath = path.join(paths.authDir, "gemini-api-key.enc");
  }

  hasApiKey(): boolean {
    return fs.existsSync(this.keyPath);
  }

  save(apiKey: string): void {
    const trimmed = apiKey.trim();
    if (!trimmed) throw new AppError("API_KEY_MISSING");
    if (!safeStorage.isEncryptionAvailable()) {
      throw new AppError("UNKNOWN_API_ERROR", "safeStorage encryption is not available.");
    }
    const encrypted = safeStorage.encryptString(trimmed);
    fs.writeFileSync(this.keyPath, encrypted);
  }

  load(): string {
    if (!this.hasApiKey()) throw new AppError("API_KEY_MISSING");
    if (!safeStorage.isEncryptionAvailable()) {
      throw new AppError("UNKNOWN_API_ERROR", "safeStorage encryption is not available.");
    }
    return safeStorage.decryptString(fs.readFileSync(this.keyPath));
  }

  delete(): void {
    if (fs.existsSync(this.keyPath)) {
      fs.rmSync(this.keyPath, { force: true });
    }
  }
}
