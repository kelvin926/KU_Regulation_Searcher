import { AppError } from "../../shared/errors";

export const GEMINI_CONNECTION_TEST_PROMPT = "연결 테스트입니다. OK만 출력하세요.";

export function assertValidConnectionTestResponse(text: string): void {
  if (!text.trim()) {
    throw new AppError("MODEL_RESPONSE_INVALID");
  }
}
