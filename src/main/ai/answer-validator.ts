import type { AnswerVerification, ArticleRecord, GeneratedAnswer } from "../../shared/types";
import { normalizeArticleNo } from "../crawler/regulation-parser";
import { AppError } from "../../shared/errors";
import { parseAnswerResponse } from "./response-parser";

export function parseAndValidateAnswer(rawText: string, candidateArticles: ArticleRecord[]): GeneratedAnswer {
  const parsed = parseAnswerResponse(rawText);
  const candidateIds = new Set(candidateArticles.map((article) => article.id));
  const candidateNos = new Set(candidateArticles.map((article) => article.article_no));
  const citedArticleNos = extractArticleNos(parsed.answer);
  const suspiciousInternalIdArticleNos = extractSuspiciousInternalIdArticleNos(parsed.answer, candidateIds);
  const usedArticleIds = inferMissingUsedArticleIds(parsed.used_article_ids, citedArticleNos, candidateArticles);
  const unknownUsedArticleIds = usedArticleIds.filter((id) => !candidateIds.has(id));
  const unknownArticleNos = citedArticleNos.filter((articleNo) => !candidateNos.has(articleNo));
  const warningMessages = [
    unknownUsedArticleIds.length > 0 || unknownArticleNos.length > 0
      ? "[주의] 답변에 근거 목록에 없는 조항이 포함되어 검증되지 않았습니다."
      : null,
    suspiciousInternalIdArticleNos.length > 0
      ? "[주의] 답변이 앱 내부 ARTICLE_ID를 조문번호처럼 언급했을 수 있습니다."
      : null,
  ].filter((message): message is string => message !== null);

  if (usedArticleIds.length === 0 && parsed.missing_evidence === false) {
    throw new AppError("MODEL_RESPONSE_INVALID");
  }

  const verification: AnswerVerification = {
    valid: unknownUsedArticleIds.length === 0 && unknownArticleNos.length === 0 && suspiciousInternalIdArticleNos.length === 0,
    usedArticleIdsValid: unknownUsedArticleIds.length === 0,
    citedArticleNosValid: unknownArticleNos.length === 0 && suspiciousInternalIdArticleNos.length === 0,
    unknownUsedArticleIds,
    unknownArticleNos,
    warningMessage: warningMessages.length > 0 ? warningMessages.join(" ") : null,
  };

  return {
    ...parsed,
    used_article_ids: usedArticleIds,
    warnings: [...parsed.warnings, ...(verification.warningMessage ? [verification.warningMessage] : [])],
    verification,
    rawText,
  };
}

function inferMissingUsedArticleIds(
  usedArticleIds: number[],
  citedArticleNos: string[],
  candidateArticles: ArticleRecord[],
): number[] {
  if (usedArticleIds.length > 0 || citedArticleNos.length === 0) return usedArticleIds;
  const ids = new Set<number>();
  for (const articleNo of citedArticleNos) {
    for (const article of candidateArticles) {
      if (article.article_no === articleNo) ids.add(article.id);
    }
  }
  return Array.from(ids);
}

function extractArticleNos(text: string): string[] {
  const values = new Set<string>();
  for (const match of text.matchAll(/제\s*\d+\s*조(?:\s*의\s*\d+)?/gu)) {
    values.add(normalizeArticleNo(match[0]));
  }
  return Array.from(values);
}

function extractSuspiciousInternalIdArticleNos(text: string, candidateIds: Set<number>): string[] {
  const values = new Set<string>();
  for (const match of text.matchAll(/제\s*(\d{4,})\s*조/gu)) {
    const numeric = Number(match[1]);
    if (candidateIds.has(numeric) || numeric >= 1000) {
      values.add(normalizeArticleNo(match[0]));
    }
  }
  return Array.from(values);
}
