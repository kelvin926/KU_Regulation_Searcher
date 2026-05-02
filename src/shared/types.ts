import type { AI_MODELS } from "./constants";
import type { ErrorCode } from "./errors";

export type AiModelId = (typeof AI_MODELS)[number]["id"];

export interface RegulationTarget {
  regulationName: string;
  seqHistory: number;
  sourceUrl: string;
}

export interface RegulationRecord {
  id: number;
  regulation_name: string;
  regulation_code: string | null;
  department: string | null;
  seq: number | null;
  seq_history: number | null;
  source_url: string;
  fetched_at: string;
  raw_html_hash: string;
}

export interface ArticleRecord {
  id: number;
  regulation_id: number;
  regulation_name: string;
  article_no: string;
  article_title: string | null;
  article_body: string;
  seq: number | null;
  seq_history: number | null;
  seq_contents: number | null;
  source_url: string;
  fetched_at: string;
  rank?: number;
}

export interface DbStats {
  regulationCount: number;
  articleCount: number;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSuccessCount: number;
  lastFailedCount: number;
}

export interface SyncFailure {
  regulationName: string;
  seqHistory: number;
  errorCode: ErrorCode | "UNKNOWN";
  message: string;
}

export interface SyncProgress {
  status: "idle" | "running" | "stopping" | "completed" | "failed" | "cancelled";
  totalCount: number;
  successCount: number;
  failedCount: number;
  currentName: string | null;
  message: string;
  failures: SyncFailure[];
}

export interface SyncSummary extends SyncProgress {
  startedAt: string;
  finishedAt: string | null;
}

export interface AuthStatus {
  status: "AUTHENTICATED" | "AUTH_REQUIRED" | "AUTH_EXPIRED";
  message: string;
}

export interface AiSettings {
  modelId: AiModelId;
  hasApiKey: boolean;
}

export interface SearchArticlesRequest {
  query: string;
  limit?: number;
}

export interface AskSearchResult {
  articles: ArticleRecord[];
  expandedKeywords: string[];
  errorCode?: ErrorCode;
}

export interface GenerateAnswerRequest {
  question: string;
  articleIds: number[];
}

export interface GeneratedAnswer {
  answer: string;
  used_article_ids: number[];
  confidence: "high" | "medium" | "low";
  missing_evidence: boolean;
  warnings: string[];
  verification: AnswerVerification;
  rawText?: string;
}

export interface AnswerVerification {
  valid: boolean;
  usedArticleIdsValid: boolean;
  citedArticleNosValid: boolean;
  unknownUsedArticleIds: number[];
  unknownArticleNos: string[];
  warningMessage: string | null;
}

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  errorCode?: ErrorCode;
  message?: string;
}

export interface SearchPageRequest {
  regulationName?: string;
  bodyQuery?: string;
  articleNo?: string;
  limit?: number;
}
