import { Copy } from "lucide-react";
import type { ArticleRecord, GeneratedAnswer } from "../../shared/types";

export function AnswerPanel({ answer, articles = [] }: { answer: GeneratedAnswer | null; articles?: ArticleRecord[] }) {
  if (!answer) {
    return <div className="empty-panel">아직 생성된 답변이 없습니다.</div>;
  }

  const usedArticleIds = new Set(answer.used_article_ids);
  const highlightedArticles = articles.filter((article) => usedArticleIds.has(article.id));
  const copyText = [
    answer.verification.warningMessage,
    answer.answer,
    "",
    `사용 근거 ID: ${answer.used_article_ids.join(", ") || "없음"}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <section className="answer-panel">
      <div className="section-heading">
        <h2>AI 답변</h2>
        <button className="icon-button" type="button" title="답변 복사" onClick={() => navigator.clipboard.writeText(copyText)}>
          <Copy size={17} />
        </button>
      </div>
      {answer.verification.warningMessage && <div className="validation-warning">{answer.verification.warningMessage}</div>}
      <div className="answer-text">{answer.answer}</div>
      <div className="meta-line">
        신뢰도 {answer.confidence} · 근거 부족 {answer.missing_evidence ? "예" : "아니오"}
      </div>
      {highlightedArticles.length > 0 && (
        <div className="answer-highlight-list">
          <h3>AI가 언급한 조항과 내용</h3>
          {highlightedArticles.map((article) => (
            <article key={article.id} className="answer-highlight">
              <div className="answer-highlight-title">
                <mark>{article.regulation_name}</mark>
                <mark>{article.article_no}</mark>
                {article.article_title && <span>{article.article_title}</span>}
              </div>
              <div className="answer-highlight-body">{article.article_body}</div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
