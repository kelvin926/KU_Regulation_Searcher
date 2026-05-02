export const APP_NAME = "KU Regulation Assistant";
export const APP_DATA_FOLDER_NAME = "KU Regulation Assistant";

export const KOREA_POLICY_ORIGIN = "https://policies.korea.ac.kr";
export const KOREA_POLICY_MAIN_URL = `${KOREA_POLICY_ORIGIN}/lmxsrv/main/main.do`;
export const KOREA_POLICY_CONTENT_URL = `${KOREA_POLICY_ORIGIN}/lmxsrv/law/lawFullContent.do`;

export const DEFAULT_REQUEST_DELAY_MS = 1100;

export const AI_MODELS = [
  {
    label: "Gemma 4 31B",
    id: "gemma-4-31b-it",
    description: "호출량이 많고 비용 민감한 일반 규정 질의용",
  },
  {
    label: "Gemini 3.1 Flash Lite",
    id: "gemini-3.1-flash-lite-preview",
    description: "빠른 응답과 Gemini 계열 지시 이행을 우선할 때 사용",
  },
] as const;

export const DEFAULT_MODEL_ID = AI_MODELS[0].id;
export const PREVIEW_MODEL_WARNING =
  "Preview 모델은 제공 여부, 모델명, 가격, 제한이 변경될 수 있습니다.";

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

export const MAX_RAG_ARTICLES = 12;
export const DEFAULT_RAG_ARTICLES = 8;
