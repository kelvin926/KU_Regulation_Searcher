import type { ApiResult } from "../../shared/types";
import { AppError } from "../../shared/errors";
import type { Logger } from "../logs/logger";

export type IpcHandlerWrap = <T>(fn: () => T | Promise<T>) => Promise<ApiResult<T>>;

export function createIpcWrapper(logger: Logger): IpcHandlerWrap {
  return async function wrap<T>(fn: () => T | Promise<T>): Promise<ApiResult<T>> {
    try {
      return { ok: true, data: await fn() };
    } catch (error) {
      if (error instanceof AppError) {
        return { ok: false, errorCode: error.code, message: error.message };
      }

      logger.error("Unhandled IPC error", { errorType: error instanceof Error ? error.name : "unknown" });
      return {
        ok: false,
        errorCode: "UNKNOWN_API_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };
}
