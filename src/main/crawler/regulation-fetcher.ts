import { KOREA_POLICY_CONTENT_URL, KOREA_POLICY_ORIGIN } from "../../shared/constants";
import { AppError } from "../../shared/errors";
import type { RegulationTarget } from "../../shared/types";
import type { ParsedRegulationForDb } from "../db/database";
import { fetchWithSession } from "./fetch-with-session";
import { parseRegulationHtml } from "./regulation-parser";

export interface FetchedRegulationDocument {
  parsed: ParsedRegulationForDb;
  rawHtml: string;
  sourceUrl: string;
  fetchedAt: string;
}

export async function fetchRegulationDocument(target: RegulationTarget): Promise<FetchedRegulationDocument> {
  const url = target.sourceUrl || `${KOREA_POLICY_CONTENT_URL}?SEQ_HISTORY=${target.seqHistory}`;
  const fetchedAt = new Date().toISOString();
  let result = await fetchWithSession(url);
  let sourceUrl = url;

  let parsed = parseRegulationHtml(result.text, target.regulationName);
  if (parsed.articles.length === 0 && target.seq) {
    const fullViewUrl = buildFullViewUrl(target);
    if (fullViewUrl !== url) {
      const fallbackResult = await fetchWithSession(fullViewUrl);
      const fallbackParsed = parseRegulationHtml(fallbackResult.text, target.regulationName);
      if (fallbackParsed.articles.length > 0) {
        result = fallbackResult;
        sourceUrl = fullViewUrl;
        parsed = fallbackParsed;
      }
    }
  }

  if (parsed.articles.length === 0) {
    const processingPlaceholder = isProcessingPlaceholder(result.text);
    const message = processingPlaceholder
      ? "규정관리시스템이 본문 대신 처리 중 페이지를 반환했습니다."
      : "파싱된 조문이 없습니다.";
    throw new AppError(processingPlaceholder ? "NOT_FOUND" : "SYNC_FAILED", message);
  }

  return {
    parsed,
    rawHtml: result.text,
    sourceUrl,
    fetchedAt,
  };
}

function buildFullViewUrl(target: RegulationTarget): string {
  return `${KOREA_POLICY_ORIGIN}/lmxsrv/law/lawFullView.do?SEQ=${target.seq}&SEQ_HISTORY=${target.seqHistory}`;
}

function isProcessingPlaceholder(html: string): boolean {
  const compact = html.replace(/<[^>]*>/gu, " ").replace(/\s+/g, " ").trim();
  return compact.includes("처리 중 입니다") && compact.length < 160;
}
