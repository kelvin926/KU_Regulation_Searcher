import { normalizeArticleNo } from "../crawler/regulation-parser";
import { parseQueryIntent, type ParsedQueryIntent, type QueryIntent } from "./query-intent";

const SYNONYM_GROUPS = [
  ["학위청구논문", "청구논문"],
  ["학위논문심사", "학위청구논문심사", "논문심사"],
  ["졸업논문", "졸업논문심사"],
  ["조건", "요건", "자격", "제출자격"],
  ["휴학", "일반휴학"],
  ["군입대", "군휴학", "입대휴학", "군입대휴학", "군복무", "병역", "입영", "입영통지서"],
  ["질병휴학", "질병으로인한휴학"],
  ["복학", "복학신청"],
  ["재입학", "재입학신청"],
  ["자퇴", "자퇴원", "퇴학", "제적"],
  ["졸업", "학위수여"],
  ["수료", "과정수료"],
  ["장학금", "장학"],
  ["등록금", "수업료"],
  ["등록", "등록기간"],
  ["징계", "징계처분"],
  ["제적", "퇴학"],
  ["경고", "학사경고"],
  ["학점", "학점인정"],
  ["이수", "수강"],
  ["교과목", "교과"],
  ["교원", "전임교원", "비전임교원"],
  ["직원", "행정직원"],
  ["조교", "교육조교", "연구조교"],
  ["성적", "평점"],
  ["전과", "전부"],
  ["복수전공", "이중전공"],
  ["부전공", "부전공이수"],
  ["연구등록", "수료연구등록"],
  ["수료연구생", "수료연구등록생"],
  ["학위청구", "학위청구논문"],
];

const STOP_WORDS = new Set([
  "몇",
  "몇학기",
  "얼마나",
  "어떻게",
  "무엇",
  "언제",
  "어디",
  "있는지",
  "있나요",
  "되나요",
  "어떤",
  "경우",
  "하나요",
  "내용",
  "찾아줘",
  "알려줘",
  "알려주세요",
  "안내",
  "설명",
  "관련된",
  "필요한가요",
  "가능한가요",
  "가능한가",
  "가능",
  "해줘",
  "진행",
  "진행해야",
  "해야",
  "해야하나요",
  "해야하나",
  "있나",
  "있냐",
  "하는",
  "하려면",
  "하려면요",
  "할수있나",
  "할수있나요",
  "수있나",
  "수있나요",
  "입학하자마자",
  "신청하는",
  "알려",
  "답변",
  "정리",
  "요약",
  "궁금",
  "까지",
  "일반",
  "방법",
  "절차",
  "조건",
  "주세요",
  "관련",
  "규정",
  "세칙",
  "내규",
  "학칙",
  "조항",
  "기준",
  "해당",
  "대상",
  "문의",
  "확인",
  "학생",
  "학부생",
  "학부생의",
  "빌릴",
  "고려대",
  "고려대학교",
]);

export interface ExpandedQuery {
  ftsQuery: string;
  keywords: string[];
  requiredTerms: string[];
  optionalTerms: string[];
  intent: QueryIntent;
  queryIntent: ParsedQueryIntent;
  intentWords: string[];
  coreKeywords: string[];
  auxiliaryKeywords: string[];
  scopeKeywords: string[];
  removedStopWords: string[];
}

export function expandQuery(input: string): ExpandedQuery {
  const queryIntent = parseQueryIntent(input);
  const directArticleNos = extractArticleNos(input);
  const keywords = new Set<string>();
  const requiredTerms = new Set<string>();
  const optionalTerms = new Set<string>();
  const removedStopWords = new Set<string>();
  const compactInput = input.replace(/\s+/g, "");
  const scopeTerm = queryIntent.scope !== "unknown" && queryIntent.scope !== "학생" ? queryIntent.scope : null;

  if (scopeTerm) {
    addSearchKeyword(keywords, scopeTerm);
    if (scopeTerm !== "학부") requiredTerms.add(scopeTerm);
  }
  for (const topic of queryIntent.topics) {
    addSearchKeyword(keywords, topic);
  }

  for (const token of tokenize(input)) {
    if (STOP_WORDS.has(token)) {
      removedStopWords.add(token);
    } else {
      addSearchKeyword(keywords, token);
      if (isRequiredTerm(token)) requiredTerms.add(token);
    }
    for (const group of SYNONYM_GROUPS) {
      if (group.includes(token)) {
        for (const synonym of group) {
          addSearchKeyword(keywords, synonym);
          addOptionalTerm(optionalTerms, synonym);
        }
      }
    }
  }

  for (const group of SYNONYM_GROUPS) {
    if (group.some((term) => compactInput.includes(term))) {
      for (const synonym of group) {
        addSearchKeyword(keywords, synonym);
        addOptionalTerm(optionalTerms, synonym);
      }
    }
  }

  for (const articleNo of directArticleNos) {
    addSearchKeyword(keywords, articleNo);
  }

  if (queryIntent.intent === "duration" && queryIntent.topics.includes("휴학")) {
    for (const keyword of ["일반휴학", "휴학기간", "휴학연한", "통산", "학기", "초과", "넘지"]) {
      addSearchKeyword(keywords, keyword);
      addOptionalTerm(optionalTerms, keyword);
    }
  }

  if (queryIntent.topics.includes("휴학") && /(입학하자마자|입학후첫학기|첫학기|신입생)/u.test(compactInput)) {
    for (const keyword of ["신입생", "입학후첫학기", "첫학기", "휴학의제한", "휴학제한"]) {
      addSearchKeyword(keywords, keyword);
      addOptionalTerm(optionalTerms, keyword);
    }
  }

  if (queryIntent.intent === "procedure" && queryIntent.topics.length > 0) {
    for (const keyword of queryIntent.procedureHints) {
      addSearchKeyword(keywords, keyword);
      addOptionalTerm(optionalTerms, keyword);
    }
  }

  const keywordList = Array.from(keywords).filter((keyword) => keyword.length > 0).slice(0, 24);
  const requiredList = Array.from(requiredTerms).filter((keyword) => keyword.length > 0).slice(0, 6);
  const optionalList = Array.from(optionalTerms).filter((keyword) => keyword.length > 0).slice(0, 24);
  for (const intentWord of queryIntent.intentWords) {
    if (STOP_WORDS.has(intentWord)) removedStopWords.add(intentWord);
  }
  return {
    keywords: keywordList,
    requiredTerms: requiredList,
    optionalTerms: optionalList,
    intent: queryIntent.intent,
    queryIntent,
    intentWords: queryIntent.intentWords,
    coreKeywords: Array.from(new Set([...requiredList, ...queryIntent.topics])).slice(0, 12),
    auxiliaryKeywords: optionalList,
    scopeKeywords: scopeTerm ? [scopeTerm] : [],
    removedStopWords: Array.from(removedStopWords),
    ftsQuery: buildFtsQuery(keywordList),
  };
}

function tokenize(input: string): string[] {
  return input
    .replace(/[^\p{L}\p{N}의조]+/gu, " ")
    .split(/\s+/u)
    .map((token) => normalizeToken(token.trim()))
    .filter((token) => token.length >= 2 && !/^\d+$/u.test(token));
}

function normalizeToken(token: string): string {
  const normalized = stripVerbEnding(stripKoreanParticle(token));
  if (normalized === "대학원생") return "대학원";
  if (["군휴학", "입대휴학", "군입대휴학"].includes(normalized)) return "군입대";
  return normalized;
}

function stripKoreanParticle(token: string): string {
  if (/학과$/u.test(token)) return token;
  return token.replace(/(은|는|이|가|을|를|와|과|의|도|만|에|에서|으로|로|에게|께|부터|까지)$/u, "");
}

function stripVerbEnding(token: string): string {
  return token
    .replace(/(하는|하려면|하려고|하려|하면|하고|하여|해서|해야|한|할)$/u, "")
    .replace(/(하)$/u, "");
}

function isRequiredTerm(token: string): boolean {
  if (STOP_WORDS.has(token)) return false;
  if (/(학과|전공|학부)$/u.test(token) && token !== "학부") return false;
  if (/^(일반휴학|신청|제출|원서|복학원|휴학원|소정기일|승인|접수기간|기간|서류)$/u.test(token)) return false;
  return true;
}

function addSearchKeyword(keywords: Set<string>, keyword: string): void {
  if (!STOP_WORDS.has(keyword) && keyword.length > 0) keywords.add(keyword);
}

function addOptionalTerm(optionalTerms: Set<string>, keyword: string): void {
  if (!STOP_WORDS.has(keyword) && keyword.length > 0) optionalTerms.add(keyword);
}

function extractArticleNos(input: string): string[] {
  const values = new Set<string>();
  for (const match of input.matchAll(/제?\s*(\d+)\s*조(?:\s*의\s*(\d+))?/gu)) {
    values.add(normalizeArticleNo(match[2] ? `${match[1]}의${match[2]}` : match[1]));
  }
  return Array.from(values);
}

function buildFtsQuery(keywords: string[]): string {
  return keywords
    .map((keyword) => `"${keyword.replace(/"/g, '""')}"`)
    .join(" OR ");
}
