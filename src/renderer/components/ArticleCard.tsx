import { ExternalLink } from "lucide-react";
import type { ArticleRecord } from "../../shared/types";

export function ArticleCard({
  article,
  checked,
  onCheckedChange,
  compact = false,
}: {
  article: ArticleRecord;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  compact?: boolean;
}) {
  return (
    <article className="article-card">
      <div className="article-card-header">
        {typeof checked === "boolean" && (
          <input
            aria-label="근거 조항 선택"
            type="checkbox"
            checked={checked}
            onChange={(event) => onCheckedChange?.(event.currentTarget.checked)}
          />
        )}
        <div>
          <div className="article-title">
            {article.regulation_name} {article.article_no}
            {article.article_title ? ` (${article.article_title})` : ""}
          </div>
          <div className="meta-line">
            ID {article.id} · 수집 {formatDate(article.fetched_at)}
          </div>
          <div className="meta-line source-url">출처 {article.source_url}</div>
        </div>
        <a className="icon-link" href={article.source_url} target="_blank" rel="noreferrer" title="출처 열기">
          <ExternalLink size={16} />
        </a>
      </div>
      <pre className={compact ? "article-body compact" : "article-body"}>{article.article_body}</pre>
    </article>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR");
}
