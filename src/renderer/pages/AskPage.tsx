import { Bot, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ArticleRecord, GeneratedAnswer } from "../../shared/types";
import { DEFAULT_RAG_ARTICLES } from "../../shared/constants";
import { ArticleCard } from "../components/ArticleCard";
import { AnswerPanel } from "../components/AnswerPanel";
import { CitationPanel } from "../components/CitationPanel";
import { WarningBox } from "../components/WarningBox";
import { getErrorMessage, unwrap } from "../lib/api";

export function AskPage() {
  const [question, setQuestion] = useState("");
  const [articles, setArticles] = useState<ArticleRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [keywords, setKeywords] = useState<string[]>([]);
  const [answer, setAnswer] = useState<GeneratedAnswer | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selectedArticles = useMemo(() => articles.filter((article) => selectedIds.has(article.id)), [articles, selectedIds]);

  async function findArticles() {
    setBusy(true);
    setMessage(null);
    setAnswer(null);
    try {
      const result = unwrap(await window.kuRegulation.ask.search({ query: question, limit: DEFAULT_RAG_ARTICLES }));
      setArticles(result.articles);
      setSelectedIds(new Set(result.articles.map((article) => article.id)));
      setKeywords(result.expandedKeywords);
      if (result.errorCode === "LOCAL_DB_EMPTY") setMessage("[LOCAL_DB_EMPTY] 먼저 규정을 동기화하세요.");
      else if (result.errorCode === "NO_RELEVANT_ARTICLES") setMessage("[근거 없음] 관련 조항을 찾지 못했습니다.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function generateAnswer() {
    setBusy(true);
    setMessage(null);
    try {
      setAnswer(
        unwrap(
          await window.kuRegulation.ask.generate({
            question,
            articleIds: Array.from(selectedIds),
          }),
        ),
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ask-layout">
      <div className="ask-column">
        <section className="panel">
          <div className="section-heading">
            <h1>규정 질의</h1>
          </div>
          <textarea
            className="question-box"
            value={question}
            onChange={(event) => setQuestion(event.currentTarget.value)}
            placeholder="예: 일반휴학은 몇 학기까지 가능한가요?"
          />
          <div className="button-row">
            <button type="button" disabled={busy || question.trim().length === 0} onClick={findArticles}>
              <Search size={17} />
              관련 조항 찾기
            </button>
            <button type="button" disabled={busy || selectedIds.size === 0} onClick={generateAnswer}>
              <Bot size={17} />
              답변 생성
            </button>
          </div>
          {keywords.length > 0 && <div className="keyword-row">{keywords.map((keyword) => <code key={keyword}>{keyword}</code>)}</div>}
          {message && <WarningBox>{message}</WarningBox>}
        </section>
        <section className="panel">
          <AnswerPanel answer={answer} />
        </section>
      </div>
      <div className="ask-column">
        <section className="panel">
          <div className="section-heading">
            <h2>검색된 근거 후보</h2>
            <span className="status-pill">{articles.length}개</span>
          </div>
          <div className="article-list">
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                checked={selectedIds.has(article.id)}
                onCheckedChange={(checked) => {
                  const next = new Set(selectedIds);
                  if (checked) next.add(article.id);
                  else next.delete(article.id);
                  setSelectedIds(next);
                }}
                compact
              />
            ))}
            {articles.length === 0 && <div className="empty-panel">검색된 조항이 없습니다.</div>}
          </div>
        </section>
        <section className="panel">
          <CitationPanel articles={selectedArticles} />
        </section>
      </div>
    </div>
  );
}
