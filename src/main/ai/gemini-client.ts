import { GoogleGenAI, Type } from "@google/genai";
import type { ArticleRecord, GeneratedAnswer, AiModelId } from "../../shared/types";
import { AppError } from "../../shared/errors";
import { buildPolicyAnswerPrompt } from "./prompt-builder";
import { parseAndValidateAnswer } from "./answer-validator";

export class GeminiClient {
  async testConnection(apiKey: string, modelId: AiModelId): Promise<void> {
    await this.generateRaw({
      apiKey,
      modelId,
      prompt: "연결 테스트입니다. OK만 출력하세요.",
      responseMimeType: "text/plain",
    });
  }

  async generateAnswer({
    apiKey,
    modelId,
    question,
    articles,
  }: {
    apiKey: string;
    modelId: AiModelId;
    question: string;
    articles: ArticleRecord[];
  }): Promise<GeneratedAnswer> {
    const prompt = buildPolicyAnswerPrompt({ question, articles });
    const text = await this.generateRaw({ apiKey, modelId, prompt, responseMimeType: "application/json" });
    return parseAndValidateAnswer(text, articles);
  }

  private async generateRaw({
    apiKey,
    modelId,
    prompt,
    responseMimeType,
  }: {
    apiKey: string;
    modelId: AiModelId;
    prompt: string;
    responseMimeType: "application/json" | "text/plain";
  }): Promise<string> {
    if (!apiKey.trim()) throw new AppError("API_KEY_MISSING");

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          responseMimeType,
          ...(responseMimeType === "application/json" ? { responseSchema: ANSWER_RESPONSE_SCHEMA } : {}),
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      });
      const text = response.text;
      if (!text) throw new AppError("MODEL_RESPONSE_INVALID");
      return text;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw mapGeminiError(error);
    }
  }
}

const ANSWER_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  required: ["answer", "used_article_ids", "confidence", "missing_evidence", "warnings"],
  properties: {
    answer: { type: Type.STRING },
    used_article_ids: {
      type: Type.ARRAY,
      items: { type: Type.INTEGER },
    },
    confidence: {
      type: Type.STRING,
      format: "enum",
      enum: ["high", "medium", "low"],
    },
    missing_evidence: { type: Type.BOOLEAN },
    warnings: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
};

function mapGeminiError(error: unknown): AppError {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("api key") || lower.includes("apikey") || lower.includes("unauthorized") || lower.includes("401")) {
    return new AppError("API_KEY_INVALID", message);
  }
  if (lower.includes("rate") || lower.includes("quota") || lower.includes("429")) {
    return new AppError("RATE_LIMITED", message);
  }
  if (lower.includes("not found") || lower.includes("model") || lower.includes("404")) {
    return new AppError("MODEL_UNAVAILABLE", message);
  }
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("timeout")) {
    return new AppError("NETWORK_ERROR", message);
  }
  return new AppError("UNKNOWN_API_ERROR", message);
}
