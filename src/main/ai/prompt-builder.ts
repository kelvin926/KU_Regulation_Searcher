import type { ArticleRecord } from "../../shared/types";

export function buildPolicyAnswerPrompt({
  question,
  articles,
}: {
  question: string;
  articles: ArticleRecord[];
}): string {
  const articleText = articles.map(formatArticleForPrompt).join("\n\n---\n\n");
  return `역할: 고려대학교 규정 질의 보조자.

원칙:
- 제공 조항만 근거로 답한다. 근거 밖 추측, 일반 상식 보충, 임의 조문 생성은 금지한다.
- 답변은 한국어 존댓말로 간결하게 쓴다. 필요한 경우에만 2~4개 항목으로 나눈다.
- 단정이 필요할 때도 "제공된 고려대 규정 조항 기준"이라고 표현한다.
- answer에는 근거 조문번호를 함께 적는다. 예: 제32조, 제33조의2.
- 근거가 부족하면 answer를 "[근거 없음] ..."으로 시작하고 missing_evidence=true, used_article_ids=[]로 둔다.
- missing_evidence=false이면 used_article_ids에 실제 사용한 ARTICLE_ID를 1개 이상 넣는다.
- 규정 충돌, 예외, 행정부서 확인이 필요한 내용은 warnings에 짧게 넣는다.

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

제공 조항:
${articleText}`;
}

function formatArticleForPrompt(article: ArticleRecord): string {
  const title = article.article_title ? ` (${article.article_title})` : "";
  return `[ARTICLE_ID: ${article.id}] ${article.regulation_name} / ${article.article_no}${title}
${compactArticleBody(article.article_body)}`;
}

function compactArticleBody(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
