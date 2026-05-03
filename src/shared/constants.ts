export const APP_NAME = "KU Regulation Searcher";
export const APP_DATA_FOLDER_NAME = "KU Regulation Searcher";
export const LEGACY_APP_DATA_FOLDER_NAME = "KU Regulation Assistant";
export const APP_VERSION = "0.8.5";

export const KOREA_POLICY_ORIGIN = "https://policies.korea.ac.kr";
export const KOREA_POLICY_MAIN_URL = `${KOREA_POLICY_ORIGIN}/lmxsrv/main/main.do`;
export const KOREA_POLICY_CONTENT_URL = `${KOREA_POLICY_ORIGIN}/lmxsrv/law/lawFullContent.do`;

export const DEFAULT_REQUEST_DELAY_MS = 1100;

export const AI_MODELS = [
  {
    label: "Gemma 4 31B",
    id: "gemma-4-31b-it",
    description: "여러 조항을 비교하거나 긴 설명이 필요할 때 유리합니다.",
    bestFor: "복잡한 규정 질문, 여러 근거 조항 비교",
    tradeoff: "답변이 길어질 수 있고 토큰을 더 많이 쓸 수 있습니다.",
  },
  {
    label: "Gemini 3.1 Flash Lite",
    id: "gemini-3.1-flash-lite-preview",
    description: "빠른 확인과 짧은 답변이 필요할 때 유리합니다.",
    bestFor: "간단한 질문, 빠른 연결 테스트, 짧은 요약",
    tradeoff: "복잡한 비교 질문에서는 일부 조항을 덜 자세히 볼 수 있습니다.",
  },
] as const;

export const DEFAULT_MODEL_ID = AI_MODELS[0].id;
export const PREVIEW_MODEL_WARNING =
  "Preview 모델은 Google 정책에 따라 제공 여부, 모델명, 가격, 사용 제한이 바뀔 수 있습니다.";

export const MVP_REGULATION_TARGETS = [
  {
    regulationName: "2-1-1 고려대학교 학칙",
    seq: 15,
    seqHistory: 2502,
    sourceUrl: `${KOREA_POLICY_CONTENT_URL}?SEQ=15&SEQ_HISTORY=2502`,
    category: "규정 / 2편1장(학칙)",
    categoryPath: ["규정", "2편1장(학칙)"],
    sortPath: [2, 1],
  },
  {
    regulationName: "2-1-2 학사운영 규정",
    seq: 17,
    seqHistory: 2482,
    sourceUrl: `${KOREA_POLICY_CONTENT_URL}?SEQ=17&SEQ_HISTORY=2482`,
    category: "규정 / 2편1장(학칙)",
    categoryPath: ["규정", "2편1장(학칙)"],
    sortPath: [2, 2],
  },
  {
    regulationName: "2-1-50 대학원학칙",
    seq: 20,
    seqHistory: 2447,
    sourceUrl: `${KOREA_POLICY_CONTENT_URL}?SEQ=20&SEQ_HISTORY=2447`,
    category: "규정 / 2편1장(학칙)",
    categoryPath: ["규정", "2편1장(학칙)"],
    sortPath: [2, 50],
  },
] as const;

export const DEFAULT_SEARCH_CANDIDATE_LIMIT = 30;
export const HARD_MAX_SEARCH_CANDIDATE_LIMIT = 30;
export const DEFAULT_RAG_ARTICLES = DEFAULT_SEARCH_CANDIDATE_LIMIT;
export const MAX_RAG_ARTICLES = 12;
export const MIN_RAG_ARTICLES = 3;
export const HARD_MAX_RAG_ARTICLES = 15;
