import { normalizeArticleNo } from "../crawler/regulation-parser";

const SYNONYM_GROUPS = [
  ["졸업논문", "학위논문", "청구논문", "논문심사"],
  ["휴학", "일반휴학", "군휴학", "질병휴학"],
  ["복학", "재입학"],
  ["수료", "졸업", "학위수여"],
  ["장학금", "등록금", "수업료"],
  ["징계", "제적", "경고"],
  ["학점", "이수", "교과목"],
  ["교원", "직원", "조교"],
  ["등록", "등록기간", "등록금", "수업료"],
  ["성적", "평점", "학점인정"],
  ["전과", "복수전공", "이중전공", "부전공"],
  ["연구등록", "수료연구생", "학위청구"],
];

const STOP_WORDS = new Set([
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
  "관련된",
  "필요한가요",
  "가능한가요",
  "주세요",
  "관련",
  "규정",
  "조항",
  "기준",
  "학생",
  "빌릴",
  "고려대",
  "고려대학교",
]);

export interface ExpandedQuery {
  ftsQuery: string;
  keywords: string[];
}

export function expandQuery(input: string): ExpandedQuery {
  const directArticleNos = extractArticleNos(input);
  const keywords = new Set<string>();
  const compactInput = input.replace(/\s+/g, "");

  for (const token of tokenize(input)) {
    if (!STOP_WORDS.has(token)) keywords.add(token);
    for (const group of SYNONYM_GROUPS) {
      if (group.includes(token)) {
        for (const synonym of group) keywords.add(synonym);
      }
    }
  }

  for (const group of SYNONYM_GROUPS) {
    if (group.some((term) => compactInput.includes(term))) {
      for (const synonym of group) keywords.add(synonym);
    }
  }

  for (const articleNo of directArticleNos) {
    keywords.add(articleNo);
  }

  const keywordList = Array.from(keywords).filter((keyword) => keyword.length > 0).slice(0, 24);
  return {
    keywords: keywordList,
    ftsQuery: buildFtsQuery(keywordList),
  };
}

function tokenize(input: string): string[] {
  return input
    .replace(/[^\p{L}\p{N}의조]+/gu, " ")
    .split(/\s+/u)
    .map((token) => stripKoreanParticle(token.trim()))
    .filter((token) => token.length >= 2 && !/^\d+$/u.test(token));
}

function stripKoreanParticle(token: string): string {
  return token.replace(/(은|는|이|가|을|를|와|과|도|만|에|에서|으로|로|에게|께|부터|까지)$/u, "");
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
