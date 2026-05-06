import { ExternalLink } from "lucide-react";
import type { ArticleRecord } from "../../shared/types";
import { HighlightedText } from "./HighlightedText";
import { RegulationDownloadButtons } from "./RegulationDownloadButtons";

export function ArticleCard({
  article,
  checked,
  onCheckedChange,
  compact = false,
  highlightTerms = [],
}: {
  article: ArticleRecord;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  compact?: boolean;
  highlightTerms?: string[];
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
            <HighlightedText text={`${article.regulation_name} ${article.article_no}`} terms={highlightTerms} />
            {article.article_title ? (
              <>
                {" ("}
                <HighlightedText text={article.article_title} terms={highlightTerms} />
                {")"}
              </>
            ) : (
              ""
            )}
          </div>
          <div className="meta-line">
            ID {article.id} · 수집 {formatDate(article.fetched_at)}
          </div>
          {article.relevance && (
            <div className="article-badge-row">
              <span className={`relevance-badge ${article.relevance.group}`}>{article.relevance.label}</span>
              <span className={`source-badge ${getSourceType(article)}`}>{getSourceLabel(article)}</span>
            </div>
          )}
          {!article.relevance && (
            <div className="article-badge-row">
              <span className={`source-badge ${getSourceType(article)}`}>{getSourceLabel(article)}</span>
            </div>
          )}
          <div className="meta-line source-url">출처 {article.source_url}</div>
        </div>
        {getSourceType(article) === "official" && (
          <a className="icon-link" href={article.source_url} target="_blank" rel="noreferrer" title="출처 열기">
            <ExternalLink size={16} />
          </a>
        )}
      </div>
      <pre className={compact ? "article-body compact" : "article-body"}>
        <HighlightedText text={article.article_body} terms={highlightTerms} />
      </pre>
      <RegulationDownloadButtons article={article} compact={compact} />
    </article>
  );
}

function getSourceType(article: ArticleRecord): "official" | "custom" {
  return (article.source_type ?? article.sourceType ?? "official") === "custom" ? "custom" : "official";
}

function getSourceLabel(article: ArticleRecord): string {
  return getSourceType(article) === "custom" ? "커스텀 규정" : "공식 규정";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR");
}
