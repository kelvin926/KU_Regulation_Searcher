import { Bot, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ArticleRecord, GeneratedAnswer, QueryScopeOption } from "../../shared/types";
import { DEFAULT_SEARCH_CANDIDATE_LIMIT, MAX_RAG_ARTICLES } from "../../shared/constants";
import { ArticleCard } from "../components/ArticleCard";
import { AnswerPanel } from "../components/AnswerPanel";
import { CitationPanel } from "../components/CitationPanel";
import { SearchOperatorHint } from "../components/SearchOperatorHint";
import { WarningBox } from "../components/WarningBox";
import { getErrorMessage, unwrap } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { StatusMessage } from "../components/StatusMessage";
import { QUERY_SCOPE_SELECT_OPTIONS, formatQueryScopeOption } from "../lib/queryScopeOptions";

export function AskPage() {
  const [question, setQuestion] = useState("");
  const [articles, setArticles] = useState<ArticleRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [keywords, setKeywords] = useState<string[]>([]);
  const [answer, setAnswer] = useState<GeneratedAnswer | null>(null);
  const [queryScope, setQueryScope] = useState<QueryScopeOption>("auto");
  const [includeCustomRules, setIncludeCustomRules] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "warning" | "danger">("warning");
  const [busyAction, setBusyAction] = useState<"searching" | "generating" | null>(null);
  const [candidateLimits, setCandidateLimits] = useState({
    searchCandidateLimit: DEFAULT_SEARCH_CANDIDATE_LIMIT,
    maxCandidateLimit: MAX_RAG_ARTICLES,
  });
  const busy = busyAction !== null;
  const selectedArticles = useMemo(() => articles.filter((article) => selectedIds.has(article.id)), [articles, selectedIds]);

  useEffect(() => {
    void window.kuRegulation.settings.get().then((result) => {
      if (result.ok && result.data) setCandidateLimits(result.data.rag);
    });
  }, []);

  async function findArticles() {
    if (busy || question.trim().length === 0) return;
    setBusyAction("searching");
    setMessage(null);
    setAnswer(null);
    try {
      const result = unwrap(
        await window.kuRegulation.ask.search({
          query: question,
          limit: candidateLimits.searchCandidateLimit,
          scope: queryScope,
          includeCustomRules,
        }),
      );
      setArticles(result.articles);
      setSelectedIds(new Set(pickDefaultAiEvidence(result.articles, candidateLimits.maxCandidateLimit).map((article) => article.id)));
      setKeywords(result.expandedKeywords);
      if (result.errorCode === "LOCAL_DB_EMPTY") {
        setMessageTone("warning");
        setMessage("[LOCAL_DB_EMPTY] 먼저 규정을 동기화하세요.");
      } else if (result.errorCode === "NO_RELEVANT_ARTICLES") {
        setMessageTone("warning");
        setMessage(appendSearchHints("[근거 없음] 관련 조항을 찾지 못했습니다.", result.routingNotes, result.suggestedQueries));
      } else if (result.articles.length > 0 && result.articles.every((article) => !isDefaultAiEvidence(article))) {
        setMessageTone("warning");
        setMessage(
          appendSearchHints(
            "[근거 없음] 직접 적용 가능성이 높은 조항을 찾지 못했습니다. 화면에는 단어가 일부 일치한 낮은 관련도 후보만 표시됩니다.",
            result.routingNotes,
            result.suggestedQueries,
          ),
        );
      } else if (result.candidateLimitReached) {
        setMessageTone("info");
        setMessage(
          appendSearchHints(
            `관련 조항이 ${result.searchedCandidateCount ?? result.articles.length}개 이상 검색되었습니다. 현재 화면에는 재정렬된 상위 ${result.articles.length}개 후보가 표시되고, AI 답변에는 적용 가능성이 높은 근거 조항만 사용됩니다. 검색 결과가 넓으면 "일반대학원 복학", "일반대학원 장학금", "학사운영 규정 복학"처럼 소속이나 규정명을 함께 입력하세요.`,
            result.routingNotes,
            result.suggestedQueries,
          ),
        );
      }
    } catch (error) {
      setMessageTone("danger");
      setMessage(getErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function generateAnswer() {
    if (busy || selectedIds.size === 0) return;
    setBusyAction("generating");
    setAnswer(null);
    setMessageTone("info");
    setMessage(
      selectedIds.size > candidateLimits.maxCandidateLimit
        ? `AI 답변 생성 중입니다. 선택한 ${selectedIds.size}개 중 최대 ${candidateLimits.maxCandidateLimit}개 조항만 전달합니다.`
        : "AI 답변 생성 중입니다.",
    );
    try {
      setAnswer(
        unwrap(
          await window.kuRegulation.ask.generate({
            question,
            articleIds: Array.from(selectedIds),
            scope: queryScope,
            includeCustomRules,
          }),
        ),
      );
      setMessage(null);
    } catch (error) {
      setMessageTone("danger");
      setMessage(getErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="ask-layout">
      <div className="ask-column">
        <section className="panel">
          <PageHeader title="규정 질의" />
          <textarea
            className="question-box"
            value={question}
            onChange={(event) => setQuestion(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || event.key !== "Enter" || event.shiftKey) return;
              event.preventDefault();
              void findArticles();
            }}
            placeholder="예: 일반휴학은 몇 학기까지 가능한가요?"
          />
          <div className="query-scope-bar">
            <label className="field-label">
              질의 그룹
              <select value={queryScope} onChange={(event) => setQueryScope(event.currentTarget.value as QueryScopeOption)}>
                {QUERY_SCOPE_SELECT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={includeCustomRules}
                onChange={(event) => setIncludeCustomRules(event.currentTarget.checked)}
              />
              커스텀 규정 포함
            </label>
          </div>
          <SearchOperatorHint />
          <div className="button-row">
            <button type="button" disabled={busy || question.trim().length === 0} onClick={findArticles}>
              <Search size={17} />
              관련 조항 찾기
            </button>
            <button type="button" disabled={busy || selectedIds.size === 0} onClick={generateAnswer}>
              <Bot size={17} />
              {busyAction === "generating" ? "생성 중..." : "AI 답변 생성"}
            </button>
          </div>
          {keywords.length > 0 && <div className="keyword-row">{keywords.map((keyword) => <code key={keyword}>{keyword}</code>)}</div>}
          <div className="meta-line">
            검색 후보 {candidateLimits.searchCandidateLimit}개 · AI 최대 근거 {candidateLimits.maxCandidateLimit}개 · 질의 그룹 {formatQueryScopeOption(queryScope)}
          </div>
          {selectedIds.size > candidateLimits.maxCandidateLimit && (
            <WarningBox tone="info">
              선택된 근거 조항이 {selectedIds.size}개입니다. AI 답변에는 관련도가 높은 순서대로 최대 {candidateLimits.maxCandidateLimit}개까지만 전달됩니다. 너무 많은 근거를 넣으면 답변 품질이 떨어질 수 있습니다.
            </WarningBox>
          )}
          <StatusMessage message={message} tone={messageTone} />
        </section>
        <section className="panel">
          <AnswerPanel answer={answer} articles={selectedArticles} />
        </section>
      </div>
      <div className="ask-column">
        <section className="panel">
          <PageHeader title="검색된 근거 후보" level="h2">
            <span className="status-pill">{articles.length}개</span>
          </PageHeader>
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
                highlightTerms={keywords}
              />
            ))}
            {articles.length === 0 && <div className="empty-panel">검색된 조항이 없습니다.</div>}
          </div>
        </section>
        <section className="panel">
          <CitationPanel articles={selectedArticles} highlightTerms={keywords} />
        </section>
      </div>
    </div>
  );
}

function isDefaultAiEvidence(article: ArticleRecord): boolean {
  const group = article.relevance?.group;
  return group !== "out_of_scope" && group !== "low_relevance";
}

function pickDefaultAiEvidence(articles: ArticleRecord[], maxCount: number): ArticleRecord[] {
  const primary = articles.filter((article) => article.relevance?.group === "primary");
  const related = articles.filter((article) => article.relevance?.group === "related");
  if (primary.length > 0) return primary.slice(0, maxCount);
  return related.slice(0, maxCount);
}

function appendSearchHints(base: string, routingNotes?: string[], suggestedQueries?: string[]): string {
  const notes = (routingNotes ?? []).filter(Boolean);
  const suggestions = (suggestedQueries ?? []).filter(Boolean);
  const parts = [base];
  if (notes.length > 0) parts.push(`검색 분석: ${notes.slice(0, 2).join(" ")}`);
  if (suggestions.length > 0) parts.push(`재검색 예시: ${suggestions.slice(0, 3).map((query) => `"${query}"`).join(", ")}`);
  return parts.join("\n");
}
