import { z } from "zod";
import type { AnswerVerification, ArticleRecord, GeneratedAnswer } from "../../shared/types";
import { normalizeArticleNo } from "../crawler/regulation-parser";
import { AppError } from "../../shared/errors";

const AnswerSchema = z.object({
  answer: z.string(),
  used_article_ids: z.array(z.coerce.number().int()).default([]),
  confidence: z.enum(["high", "medium", "low"]).default("low"),
  missing_evidence: z.boolean().default(false),
  warnings: z.array(z.string()).default([]),
});

export function parseAndValidateAnswer(rawText: string, candidateArticles: ArticleRecord[]): GeneratedAnswer {
  const parsed = parseAnswerJson(rawText);
  const candidateIds = new Set(candidateArticles.map((article) => article.id));
  const candidateNos = new Set(candidateArticles.map((article) => article.article_no));
  const unknownUsedArticleIds = parsed.used_article_ids.filter((id) => !candidateIds.has(id));
  const citedArticleNos = extractArticleNos(parsed.answer);
  const unknownArticleNos = citedArticleNos.filter((articleNo) => !candidateNos.has(articleNo));

  if (parsed.used_article_ids.length === 0 && parsed.missing_evidence === false) {
    throw new AppError("MODEL_RESPONSE_INVALID");
  }

  const verification: AnswerVerification = {
    valid: unknownUsedArticleIds.length === 0 && unknownArticleNos.length === 0,
    usedArticleIdsValid: unknownUsedArticleIds.length === 0,
    citedArticleNosValid: unknownArticleNos.length === 0,
    unknownUsedArticleIds,
    unknownArticleNos,
    warningMessage:
      unknownUsedArticleIds.length > 0 || unknownArticleNos.length > 0
        ? "[주의] 답변에 근거 목록에 없는 조항이 포함되어 검증되지 않았습니다."
        : null,
  };

  return {
    ...parsed,
    warnings: [...parsed.warnings, ...(verification.warningMessage ? [verification.warningMessage] : [])],
    verification,
    rawText,
  };
}

function parseAnswerJson(rawText: string): z.infer<typeof AnswerSchema> {
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

function extractArticleNos(text: string): string[] {
  const values = new Set<string>();
  for (const match of text.matchAll(/제\s*\d+\s*조(?:\s*의\s*\d+)?/gu)) {
    values.add(normalizeArticleNo(match[0]));
  }
  return Array.from(values);
}
