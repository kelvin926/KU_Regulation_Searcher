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
  ["등록금", "수업료", "납입금", "학비"],
  ["등록", "등록기간"],
  ["징계", "징계처분"],
  ["제적", "퇴학"],
  ["경고", "학사경고"],
  ["학점", "학점인정"],
  ["학점인정", "학점취득", "취득학점", "인정학점"],
  ["이수", "수강"],
  ["교과목", "교과"],
  ["수강신청", "수강신청정정", "수강정정", "수강변경", "정정원서", "수강신청정정원서"],
  ["교원", "교수", "전임교원", "비전임교원"],
  ["신임교원", "신임교수"],
  ["책임수업시간", "책임시수", "강의시수", "수업시수", "의무시수", "강의의무", "책임시간"],
  ["영어강의", "영강", "영어수업", "영어강좌", "외국어강의", "외국어강좌", "외국어수업"],
  ["총학생회", "총학생회칙", "학생회", "학생자치", "학생자치단체"],
  ["직원", "행정직원"],
  ["조교", "교육조교", "연구조교"],
  ["성적", "평점"],
  ["출석", "출석일수", "결석", "불출석"],
  ["시험", "고사", "중간고사", "기말고사", "불응시", "성적인정"],
  ["전과", "전부"],
  ["복수전공", "이중전공"],
  ["부전공", "부전공이수"],
  ["연구등록", "수료연구등록"],
  ["수료연구생", "수료연구등록생"],
  ["신입생", "입학생", "입학자"],
  ["편입학생", "편입생"],
  ["재입학생", "재입학자"],
  ["재학생", "재적생"],
  ["졸업유예", "학사학위취득유예", "학위취득유예"],
  ["학위청구논문제출", "학위논문제출", "논문제출"],
  ["학위청구", "학위청구논문"],
  ["지도교수", "논문지도교수"],
  ["지도교수변경", "지도교수 변경", "논문지도교수변경"],
  ["신청", "신청서", "신청서류", "접수", "접수기간"],
  ["제출", "제출서류", "구비서류", "증빙서류", "첨부서류"],
  ["허가", "승인", "심의", "심사", "인정"],
  ["변경", "정정", "전환", "취소", "철회", "연기"],
  ["휴학원", "일반휴학원", "군입대휴학원", "휴학신청서"],
  ["복학원", "일반복학원서", "군제대복학원서", "복학신청서"],
  ["자퇴원", "자퇴신청서", "퇴학원"],
  ["대관", "대여", "사용", "임대", "공간대관", "시설대관", "장소사용", "시설사용", "사용신청"],
  ["사용료", "대여료", "대관료", "이용료"],
  ["교환학생", "교환학생프로그램", "방문학생", "SEP", "VSP", "파견학생"],
  ["외국인", "국제학생", "유학생"],
  ["서울", "안암", "안암캠퍼스"],
  ["세종", "세종캠퍼스"],
  ["임용", "채용", "신규임용", "초빙"],
  ["재임용", "재계약"],
  ["퇴직", "면직", "해임", "파면"],
  ["감면", "면제", "감액"],
  ["회의소집", "회의의소집", "회의소집과의결", "회의의소집과의결"],
  ["회의록", "회의록작성"],
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
  "누가",
  "어느",
  "경우",
  "하나요",
  "내용",
  "조문",
  "사안이면",
  "찾아줘",
  "알려줘",
  "알려주세요",
  "봐야",
  "안내",
  "설명",
  "관련된",
  "관련해서",
  "관련해",
  "필요한가요",
  "가능한가요",
  "가능한가",
  "가능",
  "해줘",
  "확인해줘",
  "답해줘",
  "찾고",
  "찾아서",
  "있는데",
  "궁금해",
  "헷갈리는데",
  "뭐라고",
  "되어",
  "제목",
  "대해",
  "실제",
  "있으면",
  "필요",
  "서류나",
  "예외나",
  "다만이나",
  "지급하거나",
  "부담하는지",
  "연결되",
  "제외되",
  "제외되는",
  "갖춰야",
  "하는지",
  "누구",
  "적용되는지",
  "정리해줘",
  "짧게",
  "간단히",
  "간단하게",
  "정확히",
  "실제로",
  "혹시",
  "제가",
  "근거",
  "같이",
  "함께",
  "한번에",
  "한",
  "번에",
  "부분",
  "볼",
  "때",
  "나오는",
  "표현",
  "핵심",
  "적용할",
  "주의할",
  "주의점",
  "진행",
  "진행해야",
  "해야",
  "해야하나요",
  "해야하나",
  "있나",
  "있냐",
  "싶대",
  "냈다",
  "냈다가",
  "전환하고",
  "바꾸고",
  "차이",
  "차이를",
  "비교",
  "다른점",
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
  "빌리다",
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

  if (/(빌리|빌려|빌릴|대관|대여|사용신청)/u.test(compactInput) && /(강의실|회의실|강당|공간|시설|장소|운동장|기기|장비|물품|도서|자료)/u.test(compactInput)) {
    for (const keyword of ["대관", "대여", "사용", "공간대관", "시설대관", "장소사용", "시설사용", "사용신청"]) {
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
  const normalized = stripNominalSuffix(stripVerbEnding(stripKoreanParticle(token)));
  if (normalized === "대학원생") return "대학원";
  if (["군휴학", "입대휴학", "군입대휴학"].includes(normalized)) return "군입대";
  if (normalized === "교수") return "교원";
  if (normalized === "신임교수") return "신임교원";
  if (normalized === "영강") return "영어강의";
  if (["학비", "등록비"].includes(normalized)) return "등록금";
  if (["책임시수", "강의시수", "수업시수", "의무시수", "강의의무", "책임시간"].includes(normalized)) return "책임수업시간";
  if (["영어수업", "영어강좌"].includes(normalized)) return "영어강의";
  if (["외국어수업", "외국어강좌"].includes(normalized)) return "외국어강의";
  if (/^(빌리|빌려|빌릴|빌린)/u.test(normalized)) return "빌리다";
  if (/^(바꾸|바꿔|바꿀|돌리|되돌리|되돌려)/u.test(normalized)) return "변경";
  if (normalized === "수강정정" || normalized === "수강변경") return "수강신청정정";
  if (normalized === "논문제출" || normalized === "학위논문제출") return "학위청구논문제출";
  if (normalized === "방문학생") return "교환학생";
  if (normalized === "안암") return "서울";
  return normalized;
}

function stripKoreanParticle(token: string): string {
  if (/학과$/u.test(token)) return token;
  if (/(허가|평가|대가|휴가|인가)$/u.test(token)) return token;
  return token.replace(/(에서는|에는|으로는|로는|이나|은|는|이|가|을|를|와|과|의|도|만|에|에서|으로|로|에게|께|부터|까지)$/u, "");
}

function stripVerbEnding(token: string): string {
  return token
    .replace(/(하는|하려면|하려고|하려|하면|하고|하여|해서|해야|한|할)$/u, "")
    .replace(/(하)$/u, "");
}

function stripNominalSuffix(token: string): string {
  return token.replace(/(이라는|이라는지|이라고|이라|라는|라고|인지|처럼)$/u, "");
}

function isRequiredTerm(token: string): boolean {
  if (STOP_WORDS.has(token)) return false;
  if (/(학과|전공|학부)$/u.test(token) && token !== "학부") return false;
  if (/^(일반휴학|신청|제출|원서|복학원|휴학원|소정기일|승인|접수기간|기간|서류)$/u.test(token)) return false;
  if (/^(변경|정정|전환|취소|철회|연기|허가|심의|인정|접수|감면|면제|감액)$/u.test(token)) return false;
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
