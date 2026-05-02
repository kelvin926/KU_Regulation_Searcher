import type { ApiResult } from "../../shared/types";

export function unwrap<T>(result: ApiResult<T>): T {
  if (!result.ok) {
    throw new Error(result.message ?? (result.errorCode ? `[${result.errorCode}]` : "Unknown error"));
  }
  return result.data as T;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
}
