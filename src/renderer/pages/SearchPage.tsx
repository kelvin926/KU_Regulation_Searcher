import { Search } from "lucide-react";
import { useState } from "react";
import type { ArticleRecord } from "../../shared/types";
import { ArticleCard } from "../components/ArticleCard";
import { getErrorMessage, unwrap } from "../lib/api";
import { WarningBox } from "../components/WarningBox";

export function SearchPage() {
  const [regulationName, setRegulationName] = useState("");
  const [bodyQuery, setBodyQuery] = useState("");
  const [articleNo, setArticleNo] = useState("");
  const [results, setResults] = useState<ArticleRecord[]>([]);
  const [selected, setSelected] = useState<ArticleRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function search() {
    setMessage(null);
    try {
      const data = unwrap(await window.kuRegulation.search.articles({ regulationName, bodyQuery, articleNo, limit: 100 }));
      setResults(data);
      setSelected(data[0] ?? null);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  return (
    <div className="search-layout">
      <section className="panel">
        <div className="section-heading">
          <h1>규정 검색</h1>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void search();
          }}
        >
          <label className="field">
            <span>규정명</span>
            <input value={regulationName} onChange={(event) => setRegulationName(event.currentTarget.value)} />
          </label>
          <label className="field">
            <span>조문 본문</span>
            <input value={bodyQuery} onChange={(event) => setBodyQuery(event.currentTarget.value)} />
          </label>
          <label className="field">
            <span>조문번호</span>
            <input value={articleNo} onChange={(event) => setArticleNo(event.currentTarget.value)} placeholder="제76조의2" />
          </label>
          <button type="submit">
            <Search size={17} />
            검색
          </button>
        </form>
        {message && <WarningBox>{message}</WarningBox>}
        <div className="result-list">
          {results.map((article) => (
            <button key={article.id} type="button" onClick={() => setSelected(article)}>
              <strong>{article.regulation_name}</strong>
              <span>{article.article_no}{article.article_title ? ` · ${article.article_title}` : ""}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="panel">
        {selected ? <ArticleCard article={selected} /> : <div className="empty-panel">결과를 선택하면 전문이 표시됩니다.</div>}
      </section>
    </div>
  );
}
