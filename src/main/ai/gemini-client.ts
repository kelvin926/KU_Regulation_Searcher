import { GoogleGenAI } from "@google/genai";
import type { ArticleRecord, GeneratedAnswer, AiModelId, AiTokenUsage, QueryCampusOption, QueryGroupOption } from "../../shared/types";
import { AppError } from "../../shared/errors";
import { buildPolicyAnswerPrompt } from "./prompt-builder";
import { parseAndValidateAnswer } from "./answer-validator";
import { ANSWER_RESPONSE_SCHEMA } from "./response-parser";
import { assertValidConnectionTestResponse, GEMINI_CONNECTION_TEST_PROMPT } from "./gemini-connection-test";

export class GeminiClient {
  async testConnection(apiKey: string, modelId: AiModelId): Promise<AiTokenUsage> {
    const result = await this.generateRaw({
      apiKey,
      modelId,
      prompt: GEMINI_CONNECTION_TEST_PROMPT,
      responseMimeType: "text/plain",
    });
    assertValidConnectionTestResponse(result.text);
    return result.usage;
  }

  async generateAnswer({
    apiKey,
    modelId,
    question,
    articles,
    group,
    campus,
    includeCustomRules,
  }: {
    apiKey: string;
    modelId: AiModelId;
    question: string;
    articles: ArticleRecord[];
    group?: QueryGroupOption;
    campus?: QueryCampusOption;
    includeCustomRules?: boolean;
  }): Promise<GeneratedAnswer> {
    const prompt = buildPolicyAnswerPrompt({ question, articles, group, campus, includeCustomRules });
    const result = await this.generateRaw({ apiKey, modelId, prompt, responseMimeType: "application/json" });
    return { ...parseAndValidateAnswer(result.text, articles), usage: result.usage };
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
  }): Promise<{ text: string; usage: AiTokenUsage }> {
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
          maxOutputTokens: 1536,
        },
      });
      const text = response.text;
      if (!text) throw new AppError("MODEL_RESPONSE_INVALID");
      return { text, usage: toTokenUsage(response.usageMetadata) };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw mapGeminiError(error);
    }
  }
}

function toTokenUsage(usage: unknown): AiTokenUsage {
  const record = usage && typeof usage === "object" ? (usage as Record<string, unknown>) : {};
  return {
    promptTokenCount: toNumber(record.promptTokenCount),
    candidatesTokenCount: toNumber(record.candidatesTokenCount),
    thoughtsTokenCount: toNumber(record.thoughtsTokenCount),
    totalTokenCount: toNumber(record.totalTokenCount),
  };
}

function toNumber(value: unknown): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

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
