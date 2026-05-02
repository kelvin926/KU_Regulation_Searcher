import { contextBridge, ipcRenderer } from "electron";
import type {
  AiModelId,
  ApiResult,
  AuthStatus,
  AiSettings,
  AiUsageStats,
  AskSearchResult,
  DbStats,
  DownloadRegulationFileRequest,
  DownloadResult,
  GenerateAnswerRequest,
  GeneratedAnswer,
  ArticleRecord,
  RegulationFile,
  RegulationTargetCacheInfo,
  RegulationTarget,
  SearchArticlesRequest,
  SearchPageRequest,
  SyncProgress,
  SyncSummary,
  SyncFailure,
} from "../shared/types";
import type { KuRegulationApi } from "../shared/api";

const api: KuRegulationApi = {
  auth: {
    openLogin: (): Promise<ApiResult<AuthStatus>> => ipcRenderer.invoke("auth:openLogin"),
    status: (): Promise<ApiResult<AuthStatus>> => ipcRenderer.invoke("auth:status"),
    logout: (): Promise<ApiResult<AuthStatus>> => ipcRenderer.invoke("auth:logout"),
  },
  sync: {
    targets: (): Promise<ApiResult<RegulationTarget[]>> => ipcRenderer.invoke("sync:targets"),
    targetCacheInfo: (): Promise<ApiResult<RegulationTargetCacheInfo>> => ipcRenderer.invoke("sync:targetCacheInfo"),
    refreshTargets: (): Promise<ApiResult<RegulationTarget[]>> => ipcRenderer.invoke("sync:refreshTargets"),
    start: (seqHistories?: number[]): Promise<ApiResult<SyncSummary>> => ipcRenderer.invoke("sync:start", seqHistories),
    stop: (): Promise<ApiResult<boolean>> => ipcRenderer.invoke("sync:stop"),
    onProgress: (callback: (progress: SyncProgress) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: SyncProgress) => callback(progress);
      ipcRenderer.on("sync:progress", listener);
      return () => ipcRenderer.removeListener("sync:progress", listener);
    },
  },
  db: {
    stats: (): Promise<ApiResult<DbStats>> => ipcRenderer.invoke("db:stats"),
    failures: (): Promise<ApiResult<SyncFailure[]>> => ipcRenderer.invoke("db:failures"),
    storedSeqHistories: (): Promise<ApiResult<number[]>> => ipcRenderer.invoke("db:storedSeqHistories"),
    clear: (): Promise<ApiResult<DbStats>> => ipcRenderer.invoke("db:clear"),
  },
  settings: {
    get: (): Promise<ApiResult<AiSettings>> => ipcRenderer.invoke("settings:get"),
    setModel: (modelId: AiModelId): Promise<ApiResult<AiSettings>> =>
      ipcRenderer.invoke("settings:setModel", modelId),
    saveApiKey: (apiKey: string): Promise<ApiResult<AiSettings>> =>
      ipcRenderer.invoke("settings:saveApiKey", apiKey),
    deleteApiKey: (): Promise<ApiResult<AiSettings>> => ipcRenderer.invoke("settings:deleteApiKey"),
    testConnection: (apiKey?: string): Promise<ApiResult<boolean>> =>
      ipcRenderer.invoke("settings:testConnection", apiKey),
    usage: (): Promise<ApiResult<AiUsageStats>> => ipcRenderer.invoke("settings:usage"),
    resetUsage: (): Promise<ApiResult<AiSettings>> => ipcRenderer.invoke("settings:resetUsage"),
  },
  ask: {
    search: (request: SearchArticlesRequest): Promise<ApiResult<AskSearchResult>> =>
      ipcRenderer.invoke("ask:search", request),
    generate: (request: GenerateAnswerRequest): Promise<ApiResult<GeneratedAnswer>> =>
      ipcRenderer.invoke("ask:generate", request),
  },
  search: {
    articles: (request: SearchPageRequest): Promise<ApiResult<ArticleRecord[]>> =>
      ipcRenderer.invoke("search:articles", request),
  },
  articles: {
    get: (id: number): Promise<ApiResult<ArticleRecord | null>> => ipcRenderer.invoke("articles:get", id),
  },
  files: {
    attachments: (seq: number | null, seqHistory: number | null): Promise<ApiResult<RegulationFile[]>> =>
      ipcRenderer.invoke("files:attachments", seq, seqHistory),
    download: (request: DownloadRegulationFileRequest): Promise<ApiResult<DownloadResult>> =>
      ipcRenderer.invoke("files:download", request),
  },
  data: {
    clearSession: (): Promise<ApiResult<boolean>> => ipcRenderer.invoke("data:clearSession"),
    clearAll: (): Promise<ApiResult<DbStats>> => ipcRenderer.invoke("data:clearAll"),
  },
};

contextBridge.exposeInMainWorld("kuRegulation", api);
