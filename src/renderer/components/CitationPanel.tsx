import type { ArticleRecord } from "../../shared/types";
import { ArticleCard } from "./ArticleCard";

export function CitationPanel({ articles }: { articles: ArticleRecord[] }) {
  if (articles.length === 0) {
    return <div className="empty-panel">표시할 근거 조항이 없습니다.</div>;
  }
  return (
    <section>
      <div className="section-heading">
        <h2>근거 조항</h2>
      </div>
      <div className="article-list">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} compact />
        ))}
      </div>
    </section>
  );
}
