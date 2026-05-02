import type {
  AiModelId,
  AiSettings,
  ApiResult,
  ArticleRecord,
  AskSearchResult,
  AuthStatus,
  DbStats,
  GenerateAnswerRequest,
  GeneratedAnswer,
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
    refreshTargets: () => Promise<ApiResult<RegulationTarget[]>>;
    start: (seqHistories?: number[]) => Promise<ApiResult<SyncSummary>>;
    stop: () => Promise<ApiResult<boolean>>;
    onProgress: (callback: (progress: SyncProgress) => void) => () => void;
  };
  db: {
    stats: () => Promise<ApiResult<DbStats>>;
    failures: () => Promise<ApiResult<SyncFailure[]>>;
    clear: () => Promise<ApiResult<DbStats>>;
  };
  settings: {
    get: () => Promise<ApiResult<AiSettings>>;
    setModel: (modelId: AiModelId) => Promise<ApiResult<AiSettings>>;
    saveApiKey: (apiKey: string) => Promise<ApiResult<AiSettings>>;
    deleteApiKey: () => Promise<ApiResult<AiSettings>>;
    testConnection: (apiKey?: string) => Promise<ApiResult<boolean>>;
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
  data: {
    clearSession: () => Promise<ApiResult<boolean>>;
    clearAll: () => Promise<ApiResult<DbStats>>;
  };
}
