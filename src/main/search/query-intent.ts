import { normalizeArticleNo } from "../crawler/regulation-parser";

export const QUERY_INTENT_VALUES = [
  "regulation_lookup",
  "procedure",
  "eligibility",
  "duration",
  "amount",
  "definition",
  "article_lookup",
  "general_question",
] as const;

export type QueryIntent = (typeof QUERY_INTENT_VALUES)[number];

export const QUERY_SCOPE_VALUES = [
  "학부",
  "일반대학원",
  "전문대학원",
  "특수대학원",
  "교육대학원",
  "법학전문대학원",
  "세종캠퍼스",
  "교원",
  "직원",
  "조교",
  "학생",
  "unknown",
] as const;

export type QueryScope = (typeof QUERY_SCOPE_VALUES)[number];

export interface ParsedQueryIntent {
  rawQuery: string;
  compactQuery: string;
  intent: QueryIntent;
  scope: QueryScope;
  topics: string[];
  procedureHints: string[];
  intentWords: string[];
  articleNos: string[];
  needsClarification: boolean;
}

const TOPIC_TERMS = [
  "학위청구논문",
  "논문심사",
  "학위논문",
  "청구논문",
  "휴학",
  "복학",
  "재입학",
  "졸업",
  "수료",
  "장학금",
  "등록금",
  "수업료",
  "등록",
  "징계",
  "제적",
  "경고",
  "학점",
  "이수",
  "수강",
  "교과목",
  "교원",
  "직원",
  "조교",
  "성적",
  "전과",
  "복수전공",
  "이중전공",
  "부전공",
  "연구등록",
  "수료연구등록",
] as const;

const PROCEDURE_HINTS = ["신청", "제출", "기간", "서류", "원서", "승인", "접수기간"] as const;

export function parseQueryIntent(input: string): ParsedQueryIntent {
  const compactQuery = compact(input);
  const articleNos = extractArticleNos(input);
  const scope = detectScope(compactQuery);
  const intentWords = detectIntentWords(compactQuery);
  const topics = detectTopics(compactQuery);
  const intent = detectIntent(compactQuery, articleNos, intentWords);
  const procedureHints = intent === "procedure" ? detectProcedureHints(compactQuery, topics) : [];
  const needsClarification =
    scope === "unknown" && /(석사|박사|대학원|학부|전공|학과|소속|캠퍼스)/u.test(compactQuery);

  return {
    rawQuery: input,
    compactQuery,
    intent,
    scope,
    topics,
    procedureHints,
    intentWords,
    articleNos,
    needsClarification,
  };
}

function detectIntent(compactQuery: string, articleNos: string[], intentWords: string[]): QueryIntent {
  if (articleNos.length > 0) return "article_lookup";
  if (/(몇학기|몇년|기간|연한|얼마나|언제까지|최대|통산|초과|넘지)/u.test(compactQuery)) return "duration";
  if (/(금액|얼마|액수|수업료|등록금|장학금액|지급액)/u.test(compactQuery)) return "amount";
  if (/(정의|뜻|무엇|무슨의미|용어)/u.test(compactQuery)) return "definition";
  if (/(가능한가|가능한가요|할수있|되나요|대상|자격|요건|조건|해당)/u.test(compactQuery)) return "eligibility";
  if (/(방법|절차|신청|제출|어떻게|알려줘|알려주세요|안내|설명|문의|확인)/u.test(compactQuery)) {
    return "procedure";
  }
  if (intentWords.some((word) => /^(규정|세칙|내규|학칙)$/u.test(word))) return "regulation_lookup";
  return "general_question";
}

function detectScope(compactQuery: string): QueryScope {
  if (compactQuery.includes("법학전문대학원")) return "법학전문대학원";
  if (compactQuery.includes("교육대학원")) return "교육대학원";
  if (compactQuery.includes("일반대학원")) return "일반대학원";
  if (compactQuery.includes("전문대학원")) return "전문대학원";
  if (compactQuery.includes("특수대학원")) return "특수대학원";
  if (compactQuery.includes("세종캠퍼스") || compactQuery.includes("세종")) return "세종캠퍼스";
  if (compactQuery.includes("학부")) return "학부";
  if (compactQuery.includes("조교")) return "조교";
  if (compactQuery.includes("교원")) return "교원";
  if (compactQuery.includes("직원")) return "직원";
  if (compactQuery.includes("학생")) return "학생";
  return "unknown";
}

function detectTopics(compactQuery: string): string[] {
  const topics = new Set<string>();
  for (const topic of TOPIC_TERMS) {
    if (compactQuery.includes(topic)) topics.add(topic);
  }
  if (compactQuery.includes("학위청구") && compactQuery.includes("심사")) {
    topics.add("학위청구논문");
    topics.add("심사");
  }
  return Array.from(topics);
}

function detectIntentWords(compactQuery: string): string[] {
  const words = new Set<string>();
  for (const word of [
    "방법",
    "알려줘",
    "알려주세요",
    "안내",
    "설명",
    "절차",
    "관련",
    "내용",
    "규정",
    "세칙",
    "내규",
    "학칙",
    "기준",
    "해당",
    "대상",
    "문의",
    "확인",
  ]) {
    if (compactQuery.includes(word)) words.add(word);
  }
  return Array.from(words);
}

function detectProcedureHints(compactQuery: string, topics: string[]): string[] {
  const hints = new Set<string>(PROCEDURE_HINTS);
  if (topics.includes("복학")) hints.add("복학원");
  if (topics.includes("휴학")) hints.add("휴학원");
  if (compactQuery.includes("군")) hints.add("증명서");
  return Array.from(hints);
}

function extractArticleNos(input: string): string[] {
  const values = new Set<string>();
  for (const match of input.matchAll(/제?\s*(\d+)\s*조(?:\s*의\s*(\d+))?/gu)) {
    values.add(normalizeArticleNo(`제${match[1]}조${match[2] ? `의${match[2]}` : ""}`));
  }
  return Array.from(values);
}

export function compact(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}
