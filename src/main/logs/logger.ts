import fs from "node:fs";
import type { AppPaths } from "../app-paths";

type LogLevel = "INFO" | "WARN" | "ERROR";

const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z_-]{20,}/g,
  /(cookie|set-cookie|authorization|password|passwd|api[_-]?key)\s*[:=]\s*[^,\s}]+/gi,
  /KU[A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+/g,
];

export class Logger {
  constructor(private readonly paths: AppPaths) {}

  info(message: string, meta?: Record<string, unknown>): void {
    this.write("INFO", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write("WARN", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.write("ERROR", message, meta);
  }

  private write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const serializedMeta = meta ? ` ${this.redact(JSON.stringify(meta))}` : "";
    const line = `${new Date().toISOString()} ${level} ${this.redact(message)}${serializedMeta}\n`;
    fs.appendFileSync(this.paths.logPath, line, "utf8");
  }

  private redact(value: string): string {
    return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, "[REDACTED]"), value);
  }
}
