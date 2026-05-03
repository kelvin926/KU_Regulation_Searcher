import { normalizeArticleNo } from "../crawler/regulation-parser";

const SYNONYM_GROUPS = [
  ["학위청구논문", "청구논문"],
  ["학위논문심사", "학위청구논문심사", "논문심사"],
  ["졸업논문", "졸업논문심사"],
  ["휴학", "일반휴학"],
  ["군휴학", "입대휴학", "군입대휴학"],
  ["질병휴학", "질병으로인한휴학"],
  ["복학", "복학신청"],
  ["재입학", "재입학신청"],
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
  "관련된",
  "필요한가요",
  "가능한가요",
  "가능",
  "까지",
  "일반",
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

  if (isLeaveDurationQuestion(compactInput)) {
    for (const keyword of ["일반휴학", "휴학기간", "휴학연한", "통산", "학기", "초과", "넘지"]) {
      keywords.add(keyword);
    }
  }

  const keywordList = Array.from(keywords).filter((keyword) => keyword.length > 0).slice(0, 24);
  return {
    keywords: keywordList,
    ftsQuery: buildFtsQuery(keywordList),
  };
}

function isLeaveDurationQuestion(compactInput: string): boolean {
  return (
    compactInput.includes("휴학") &&
    /(몇|기간|연한|학기|까지|가능|최대|통산|초과|넘지)/u.test(compactInput)
  );
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
