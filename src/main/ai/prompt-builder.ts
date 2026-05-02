import type { ArticleRecord } from "../../shared/types";

export function buildPolicyAnswerPrompt({
  question,
  articles,
}: {
  question: string;
  articles: ArticleRecord[];
}): string {
  const articleText = articles.map(formatArticleForPrompt).join("\n\n---\n\n");
  return `너는 고려대학교 규정 질의 보조자다.
아래 제공된 조항만 근거로 답하라.

규칙:
1. 제공된 조항에 없는 내용은 답하지 마라.
2. 추측하지 마라.
3. 근거가 부족하면 [근거 없음]이라고 답하라.
4. 원문 내용과 해석을 분리해서 답하라.
5. 답변에는 반드시 사용한 근거 조항 ID를 포함하라.
6. 조문번호를 임의로 만들지 마라.
7. 사용자에게 법률 자문처럼 단정하지 말고, "제공된 고려대 규정 조항 기준"이라고 표현하라.
8. 규정 간 충돌이나 예외가 있으면 "추가 확인 필요"라고 표시하라.
9. 답변은 한국어 존댓말로 작성한다.
10. 가능하면 간결하게 답하되, 근거 조항은 생략하지 않는다.
11. missing_evidence가 false이면 used_article_ids는 반드시 1개 이상이어야 한다.
12. answer 본문에는 사용한 조문번호(예: 제32조, 제33조의2)를 함께 적어라.

출력은 반드시 JSON 객체 하나만 반환하라. Markdown 코드블록을 쓰지 마라.
형식:
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
  return `[ARTICLE_ID: ${article.id}]
규정명: ${article.regulation_name}
조문번호: ${article.article_no}
조문제목: ${article.article_title ?? ""}
수집시각: ${article.fetched_at}
출처URL: ${article.source_url}
본문:
${article.article_body}`;
}
