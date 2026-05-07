import type { ArticleRecord, QueryCampusOption, QueryGroupOption } from "../../shared/types";

export function buildPolicyAnswerPrompt({
  question,
  articles,
  group,
  campus,
  includeCustomRules,
}: {
  question: string;
  articles: ArticleRecord[];
  group?: QueryGroupOption;
  campus?: QueryCampusOption;
  includeCustomRules?: boolean;
}): string {
  const articleText = articles.map(formatArticleForPrompt).join("\n\n---\n\n");
  const customEvidenceNote = articles.some((article) => (article.source_type ?? article.sourceType ?? "official") === "custom")
    ? "\n- 제공 조항 중 [커스텀 규정]은 사용자가 직접 입력한 학과 내규/부서 내규입니다. 공식 규정과 커스텀 규정이 함께 있으면 둘을 구분해서 설명하고, 충돌 가능성이 있으면 확인 필요하다고 말한다."
    : "";
  const scopeNote = `\n질의 캠퍼스: ${formatCampus(campus)} / 질의 그룹: ${formatGroup(group)} / 커스텀 규정 포함: ${
    includeCustomRules === false ? "아니오" : "예"
  }`;
  return `역할: 고려대학교 규정 질의 보조자.

원칙:
- 제공 조항만 근거로 답한다. 근거 밖 추측, 일반 상식 보충, 임의 조문 생성은 금지한다.
- 답변은 한국어 존댓말로 간결하게 쓴다. 여러 소속, 대학원, 학과 내규가 다르면 범위별로 나누어 쓴다.
- 단정이 필요할 때도 "제공된 고려대 규정 조항 기준"이라고 표현한다.
- answer에는 규정명과 실제 조문번호를 함께 적는다. 예: 학사운영 규정 제23조, 대학원학칙 일반대학원 시행세칙 제17조.
- ARTICLE_ID는 앱 내부 식별자다. ARTICLE_ID 숫자를 조문번호처럼 "제1234조"로 절대 쓰지 않는다.
- used_article_ids에는 실제 사용한 ARTICLE_ID 숫자만 넣고, answer 본문에는 ARTICLE_ID를 쓰지 않는다.
- 근거가 부족하면 answer를 "[근거 없음] ..."으로 시작하고 missing_evidence=true, used_article_ids=[]로 둔다.
- missing_evidence=false이면 used_article_ids에 실제 사용한 ARTICLE_ID를 1개 이상 넣는다.
- 질문 범위가 넓어 제공 조항만으로 전체 소속, 전체 학과, 전체 대학원을 빠짐없이 보장할 수 없으면 그 한계를 answer와 warnings에 밝힌다.
- 제공 조항 중 적용 범위가 질문과 다른 조항은 직접 근거로 쓰지 않는다.
- 학부생 질문이면 학사운영 규정, 고려대학교 학칙 등 학부 공통 규정을 우선 보고, 대학원·전문대학원·교원 규정은 직접 근거로 쓰지 않는다.
- 대학원 질문이면 대학원학칙과 해당 대학원 시행세칙을 우선 보고, 학부 전용 학사운영 조항은 준용 관계가 명확할 때만 보조 근거로 쓴다.
- 예를 들어 질문이 일반대학원인데 교육대학원, 법학전문대학원, 특수사업 내규이면 직접 근거로 쓰지 말고 필요 시 "적용 범위 확인 필요"로만 언급한다.
- 질문 대상이나 소속이 불명확하면 단정하지 말고 적용 범위 확인이 필요하다고 말한다.
- 학부/대학원 구분이 없는 학사 질문은 먼저 "학부, 일반대학원, 전문·특수대학원에 따라 다를 수 있음"을 밝히고, 제공 조항 안에서 확인되는 범위만 요약한다.
- used_article_ids에는 실제로 답변에 사용한 조항만 넣는다. 후보에 있지만 사용하지 않은 조항을 억지로 포함하지 않는다.
- 숫자 제한(학기, 기간, 횟수)을 묻는 질문에서는 제공 조항 중 숫자 제한이 있는 관련 조항을 우선 반영한다.
- 규정 충돌, 소속별 예외, 행정부서 확인이 필요한 내용은 warnings에 짧게 넣는다.
${customEvidenceNote}

반환 형식: JSON 객체 1개만. Markdown 코드블록 금지.
{
  "answer": "사용자에게 보여줄 답변",
  "used_article_ids": [1, 2, 3],
  "confidence": "high | medium | low",
  "missing_evidence": true | false,
  "warnings": ["..."]
}

사용자 질문:
${question}
${scopeNote}

제공 조항:
${articleText}`;
}

function formatArticleForPrompt(article: ArticleRecord): string {
  const title = article.article_title ? ` (${article.article_title})` : "";
  const sourceType = article.source_type ?? article.sourceType ?? "official";
  const sourceLabel = sourceType === "custom" ? "커스텀 규정" : "공식 규정";
  const customScope = article.custom_scope ?? article.customScope;
  const customCampus = article.custom_campus ?? article.customCampus;
  const customNote = article.custom_note ?? article.customNote;
  return `[ARTICLE_ID: ${article.id}]
자료 구분: ${sourceLabel}${customCampus ? ` / 적용 캠퍼스: ${formatCampus(customCampus)}` : ""}${
    customScope ? ` / 적용 그룹: ${formatGroup(customScope)}` : ""
  }${customNote ? ` / 메모: ${customNote}` : ""}
규정명: ${article.regulation_name}
실제 조문번호: ${article.article_no}${title}
검색 관련도: ${article.relevance?.label ?? "참고"}
${compactArticleBody(article.article_body)}`;
}

function formatGroup(group?: QueryGroupOption | null): string {
  switch (group) {
    case "undergraduate":
      return "학부생";
    case "general_graduate":
      return "일반대학원";
    case "professional_special_graduate":
      return "전문·특수대학원";
    case "faculty":
      return "교원/교수";
    case "staff_assistant":
      return "직원/조교";
    case "other":
      return "기타";
    case "auto":
    case undefined:
    case null:
      return "자동 판단";
  }
}

function formatCampus(campus?: QueryCampusOption | null): string {
  switch (campus) {
    case "seoul":
      return "서울캠퍼스";
    case "sejong":
      return "세종캠퍼스";
    case "other":
      return "기타";
    case "auto":
    case undefined:
    case null:
      return "자동 판단";
  }
}

function compactArticleBody(value: string): string {
  const normalized = value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return compactLongEvidence(normalized);
}

function compactLongEvidence(value: string): string {
  const headSize = 2800;
  const tailSize = 1200;
  const minSaved = 1200;
  if (value.length <= headSize + tailSize + minSaved) return value;

  const head = cutAtSentenceBoundary(value.slice(0, headSize), "head");
  const tailStart = Math.max(head.length, value.length - tailSize);
  const tail = cutAtSentenceBoundary(value.slice(tailStart), "tail");
  const omitted = value.length - head.length - tail.length;
  if (omitted < minSaved) return value;

  return `${head}\n\n[중략: 긴 조항 본문 ${omitted.toLocaleString()}자 생략. 답변에는 제공된 조항 안에서 확인되는 내용만 사용할 것.]\n\n${tail}`;
}

function cutAtSentenceBoundary(value: string, direction: "head" | "tail"): string {
  if (direction === "head") {
    const boundaries = ["다.\n", "다. ", ".\n", "\n\n"].map((needle) => value.lastIndexOf(needle));
    const boundary = Math.max(...boundaries);
    return (boundary > value.length * 0.55 ? value.slice(0, boundary + 2) : value).trimEnd();
  }

  const candidates = ["\n\n", "다.\n", "다. ", ".\n"]
    .map((needle) => value.indexOf(needle))
    .filter((index) => index >= 0 && index < value.length * 0.45)
    .sort((a, b) => a - b);
  const boundary = candidates[0];
  return (boundary !== undefined ? value.slice(boundary + 2) : value).trimStart();
}
