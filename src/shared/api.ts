import type {
  AiModelId,
  AiSettings,
  AiUsageStats,
  ApiResult,
  ArticleRecord,
  AskSearchResult,
  AuthStatus,
  DownloadRegulationFileRequest,
  DownloadResult,
  DbStats,
  GenerateAnswerRequest,
  GeneratedAnswer,
  RagCandidateSettings,
  RegulationFile,
  RegulationTargetCacheInfo,
  RegulationTarget,
  SearchArticlesRequest,
  SearchPageRequest,
  SyncFailure,
  SyncProgress,
  SyncSummary,
} from "./types";

export interface KuRegulationApi {
  auth: {
    openLogin: () => Promise<ApiResult<AuthStatus>>;
    status: () => Promise<ApiResult<AuthStatus>>;
    logout: () => Promise<ApiResult<AuthStatus>>;
  };
  sync: {
    targets: () => Promise<ApiResult<RegulationTarget[]>>;
    targetCacheInfo: () => Promise<ApiResult<RegulationTargetCacheInfo>>;
    refreshTargets: () => Promise<ApiResult<RegulationTarget[]>>;
    start: (seqHistories?: number[]) => Promise<ApiResult<SyncSummary>>;
    stop: () => Promise<ApiResult<boolean>>;
    onProgress: (callback: (progress: SyncProgress) => void) => () => void;
  };
  db: {
    stats: () => Promise<ApiResult<DbStats>>;
    failures: () => Promise<ApiResult<SyncFailure[]>>;
    storedSeqHistories: () => Promise<ApiResult<number[]>>;
    clear: () => Promise<ApiResult<DbStats>>;
  };
  settings: {
    get: () => Promise<ApiResult<AiSettings>>;
    setModel: (modelId: AiModelId) => Promise<ApiResult<AiSettings>>;
    saveApiKey: (apiKey: string) => Promise<ApiResult<AiSettings>>;
    deleteApiKey: () => Promise<ApiResult<AiSettings>>;
    testConnection: (apiKey?: string) => Promise<ApiResult<boolean>>;
    setRagSettings: (settings: Partial<RagCandidateSettings>) => Promise<ApiResult<AiSettings>>;
    usage: () => Promise<ApiResult<AiUsageStats>>;
    resetUsage: () => Promise<ApiResult<AiSettings>>;
  };
  ask: {
    search: (request: SearchArticlesRequest) => Promise<ApiResult<AskSearchResult>>;
    generate: (request: GenerateAnswerRequest) => Promise<ApiResult<GeneratedAnswer>>;
  };
  search: {
    articles: (request: SearchPageRequest) => Promise<ApiResult<ArticleRecord[]>>;
  };
  articles: {
    get: (id: number) => Promise<ApiResult<ArticleRecord | null>>;
  };
  files: {
    attachments: (seq: number | null, seqHistory: number | null) => Promise<ApiResult<RegulationFile[]>>;
    download: (request: DownloadRegulationFileRequest) => Promise<ApiResult<DownloadResult>>;
  };
  data: {
    openFolder: () => Promise<ApiResult<boolean>>;
    clearSession: () => Promise<ApiResult<boolean>>;
    clearAll: () => Promise<ApiResult<DbStats>>;
  };
}
