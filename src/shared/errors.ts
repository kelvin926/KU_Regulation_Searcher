export const ERROR_CODES = [
  "AUTH_REQUIRED",
  "AUTH_EXPIRED",
  "LOCAL_DB_EMPTY",
  "NO_RELEVANT_ARTICLES",
  "API_KEY_MISSING",
  "API_KEY_INVALID",
  "RATE_LIMITED",
  "MODEL_UNAVAILABLE",
  "MODEL_RESPONSE_INVALID",
  "CITATION_VERIFICATION_FAILED",
  "SYNC_FAILED",
  "NOT_FOUND",
  "NETWORK_ERROR",
  "UNKNOWN_API_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export function formatErrorCode(code: ErrorCode): string {
  return `[${code}]`;
}

export class AppError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message?: string) {
    super(message ?? formatErrorCode(code));
    this.name = "AppError";
    this.code = code;
  }
}

export function isErrorCode(value: string): value is ErrorCode {
  return (ERROR_CODES as readonly string[]).includes(value);
}
