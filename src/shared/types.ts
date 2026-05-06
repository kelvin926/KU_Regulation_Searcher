import type { AI_MODELS } from "./constants";
import type { ErrorCode } from "./errors";

export type AiModelId = (typeof AI_MODELS)[number]["id"];

export const AUTH_STATUS_VALUES = ["AUTHENTICATED", "AUTH_REQUIRED", "AUTH_EXPIRED"] as const;
export type AuthStatusCode = (typeof AUTH_STATUS_VALUES)[number];

export const SYNC_STATUS_VALUES = ["idle", "running", "stopping", "completed", "failed", "cancelled"] as const;
export type SyncStatus = (typeof SYNC_STATUS_VALUES)[number];

export const ANSWER_CONFIDENCE_VALUES = ["high", "medium", "low"] as const;
export type AnswerConfidence = (typeof ANSWER_CONFIDENCE_VALUES)[number];

export interface RegulationTarget {
  regulationName: string;
  seqHistory: number;
  sourceUrl: string;
  seq?: number;
  category?: string;
  categoryPath?: readonly string[];
  sortPath?: readonly number[];
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
  source_type?: RegulationSourceType;
  sourceType?: RegulationSourceType;
  custom_scope?: QueryScopeOption | null;
  customScope?: QueryScopeOption | null;
  custom_note?: string | null;
  customNote?: string | null;
  rank?: number;
  relevance?: ArticleRelevance;
}

export const REGULATION_SOURCE_TYPE_VALUES = ["official", "custom"] as const;
export type RegulationSourceType = (typeof REGULATION_SOURCE_TYPE_VALUES)[number];

export const QUERY_SCOPE_OPTION_VALUES = [
  "auto",
  "undergraduate",
  "general_graduate",
  "professional_special_graduate",
  "faculty",
  "staff_assistant",
  "seoul",
  "sejong",
  "other",
] as const;
export type QueryScopeOption = (typeof QUERY_SCOPE_OPTION_VALUES)[number];

export interface CustomRegulationInput {
  regulationName: string;
  customScope: QueryScopeOption;
  customNote?: string;
  body: string;
}

export interface CustomRegulationRecord {
  id: number;
  regulation_name: string;
  source_url: string;
  custom_scope: QueryScopeOption;
  custom_note: string | null;
  fetched_at: string;
  updated_at: string;
  article_count: number;
  body?: string;
}

export const ARTICLE_RELEVANCE_GROUP_VALUES = ["primary", "related", "out_of_scope", "low_relevance"] as const;
export type ArticleRelevanceGroup = (typeof ARTICLE_RELEVANCE_GROUP_VALUES)[number];

export interface ArticleRelevance {
  group: ArticleRelevanceGroup;
  label: string;
  score: number;
  reasons: string[];
}

export interface DbStats {
  regulationCount: number;
  articleCount: number;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSuccessCount: number;
  lastFailedCount: number;
  storageBytes: number;
}

export interface SyncFailure {
  regulationName: string;
  seqHistory: number;
  errorCode: ErrorCode | "UNKNOWN";
  message: string;
}

export interface SyncProgress {
  status: SyncStatus;
  totalCount: number;
  successCount: number;
  failedCount: number;
  currentSeqHistory: number | null;
  currentName: string | null;
  message: string;
  failures: SyncFailure[];
  completedSeqHistories: number[];
}

export interface SyncSummary extends SyncProgress {
  startedAt: string;
  finishedAt: string | null;
}

export interface AuthStatus {
  status: AuthStatusCode;
  message: string;
}

export interface AiSettings {
  modelId: AiModelId;
  hasApiKey: boolean;
  usage: AiUsageStats;
  rag: RagCandidateSettings;
}

export interface RagCandidateSettings {
  searchCandidateLimit: number;
  maxCandidateLimit: number;
}

export interface AiUsageStats {
  requestCount: number;
  promptTokenCount: number;
  candidatesTokenCount: number;
  thoughtsTokenCount: number;
  totalTokenCount: number;
  lastUsedAt: string | null;
}

export interface AiTokenUsage {
  promptTokenCount: number;
  candidatesTokenCount: number;
  thoughtsTokenCount: number;
  totalTokenCount: number;
}

export interface SearchArticlesRequest {
  query: string;
  limit?: number;
  scope?: QueryScopeOption;
  includeCustomRules?: boolean;
}

export interface AskSearchResult {
  articles: ArticleRecord[];
  expandedKeywords: string[];
  errorCode?: ErrorCode;
  candidateLimitReached?: boolean;
  searchedCandidateCount?: number;
  routingNotes?: string[];
  suggestedQueries?: string[];
}

export interface GenerateAnswerRequest {
  question: string;
  articleIds: number[];
  scope?: QueryScopeOption;
  includeCustomRules?: boolean;
}

export interface GeneratedAnswer {
  answer: string;
  used_article_ids: number[];
  confidence: AnswerConfidence;
  missing_evidence: boolean;
  warnings: string[];
  verification: AnswerVerification;
  usage?: AiTokenUsage;
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

export type ApiResult<T> =
  | {
      ok: true;
      data: T;
      errorCode?: never;
      message?: never;
    }
  | {
      ok: false;
      data?: never;
      errorCode?: ErrorCode;
      message?: string;
    };

export interface SearchPageRequest {
  regulationName?: string;
  bodyQuery?: string;
  articleNo?: string;
  limit?: number;
}

export interface RegulationTargetCacheInfo {
  hasRefreshed: boolean;
  refreshedAt: string | null;
  targetCount: number;
}

export type RegulationFileType = "ori" | "oriPdf" | "attach";

export interface RegulationFile {
  fileSeq: number;
  fileType: RegulationFileType;
  fileName: string;
  label: string;
}

export interface DownloadRegulationFileRequest {
  fileSeq: number;
  fileType: RegulationFileType;
  fileName?: string;
}

export interface DownloadResult {
  filePath: string;
  fileName: string;
}
