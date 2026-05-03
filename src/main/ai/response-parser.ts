import { Type } from "@google/genai";
import { z } from "zod";
import { AppError } from "../../shared/errors";
import { ANSWER_CONFIDENCE_VALUES } from "../../shared/types";

const AnswerSchema = z.object({
  answer: z.string(),
  used_article_ids: z.array(z.coerce.number().int()).default([]),
  confidence: z.enum(ANSWER_CONFIDENCE_VALUES).default("low"),
  missing_evidence: z.boolean().default(false),
  warnings: z.array(z.string()).default([]),
});

export type ParsedAnswerResponse = z.infer<typeof AnswerSchema>;

export const ANSWER_RESPONSE_SCHEMA = {
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
      enum: [...ANSWER_CONFIDENCE_VALUES],
    },
    missing_evidence: { type: Type.BOOLEAN },
    warnings: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
};

export function parseAnswerResponse(rawText: string): ParsedAnswerResponse {
  const trimmed = rawText.trim();
  const candidates = [trimmed, extractJsonObject(trimmed)].filter(Boolean) as string[];
  for (const candidate of candidates) {
    try {
      return AnswerSchema.parse(JSON.parse(candidate));
    } catch {
      continue;
    }
  }
  throw new AppError("MODEL_RESPONSE_INVALID");
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}
