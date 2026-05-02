import { CheckSquare, PauseCircle, RefreshCw, RotateCw, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DbStats, RegulationTarget, SyncFailure, SyncProgress } from "../../shared/types";
import { getErrorMessage, unwrap } from "../lib/api";
import { WarningBox } from "../components/WarningBox";

export function SyncPage() {
  const [targets, setTargets] = useState<RegulationTarget[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [stats, setStats] = useState<DbStats | null>(null);
  const [failures, setFailures] = useState<SyncFailure[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [loadingTargets, setLoadingTargets] = useState(false);
  const visibleTargets = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return targets;
    return targets.filter(
      (target) =>
        target.regulationName.toLowerCase().includes(query) ||
        target.category?.toLowerCase().includes(query) ||
        String(target.seqHistory).includes(query),
    );
  }, [filter, targets]);

  useEffect(() => {
    void refresh();
    return window.kuRegulation.sync.onProgress((next) => setProgress(next));
  }, []);

  async function refresh() {
    const loadedTargets = unwrap(await window.kuRegulation.sync.targets());
    setTargets(loadedTargets);
    setSelected((previous) => {
      if (previous.size === 0 && loadedTargets.length <= 3) {
        return new Set(loadedTargets.map((target) => target.seqHistory));
      }
      const available = new Set(loadedTargets.map((target) => target.seqHistory));
      return new Set(Array.from(previous).filter((seqHistory) => available.has(seqHistory)));
    });
    setStats(unwrap(await window.kuRegulation.db.stats()));
    setFailures(unwrap(await window.kuRegulation.db.failures()));
  }

  async function refreshTargetList() {
    setLoadingTargets(true);
    setMessage(null);
    try {
      const loadedTargets = unwrap(await window.kuRegulation.sync.refreshTargets());
      setTargets(loadedTargets);
      setSelected((previous) => {
        const available = new Set(loadedTargets.map((target) => target.seqHistory));
        return new Set(Array.from(previous).filter((seqHistory) => available.has(seqHistory)));
      });
      setMessage(`${loadedTargets.length}개 규정 목록을 불러왔습니다. 필요한 규정만 선택해서 동기화하세요.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoadingTargets(false);
    }
  }

  async function start(seqHistories?: number[]) {
    setMessage(null);
    try {
      const result = unwrap(await window.kuRegulation.sync.start(seqHistories));
      setProgress(result);
      await refresh();
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <h1>동기화</h1>
          <span className="status-pill">{progress?.status ?? "idle"}</span>
        </div>
        <div className="button-row">
          <button type="button" disabled={loadingTargets} onClick={refreshTargetList}>
            <RotateCw size={17} />
            규정 목록 새로고침
          </button>
          <button type="button" disabled={selected.size === 0} onClick={() => start(Array.from(selected))}>
            <RefreshCw size={17} />
            선택 규정 동기화
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => setSelected(new Set(visibleTargets.map((target) => target.seqHistory)))}
          >
            <CheckSquare size={17} />
            표시 목록 전체 선택
          </button>
          <button type="button" className="secondary" onClick={() => setSelected(new Set())}>
            <Square size={17} />
            선택 해제
          </button>
          <button type="button" className="secondary" onClick={() => window.kuRegulation.sync.stop()}>
            <PauseCircle size={17} />
            동기화 중지
          </button>
        </div>
        <div className="target-toolbar">
          <input
            className="target-filter"
            value={filter}
            onChange={(event) => setFilter(event.currentTarget.value)}
            placeholder="규정명, 분류, SEQ_HISTORY로 검색"
          />
          <span className="meta-line">
            전체 {targets.length}개 · 표시 {visibleTargets.length}개 · 선택 {selected.size}개
          </span>
        </div>
        <div className="target-list">
          {visibleTargets.map((target) => (
            <label key={target.seqHistory} className="target-item">
              <input
                type="checkbox"
                checked={selected.has(target.seqHistory)}
                onChange={(event) => {
                  const next = new Set(selected);
                  if (event.currentTarget.checked) next.add(target.seqHistory);
                  else next.delete(target.seqHistory);
                  setSelected(next);
                }}
              />
              <span>{target.regulationName}</span>
              <span className="target-meta">
                {target.category && <span>{target.category}</span>}
                {target.seq && <code>SEQ {target.seq}</code>}
                <code>SEQ_HISTORY {target.seqHistory}</code>
              </span>
            </label>
          ))}
          {visibleTargets.length === 0 && <div className="empty-panel">표시할 규정이 없습니다.</div>}
        </div>
        {progress && (
          <div className="progress-block">
            <progress max={progress.totalCount || 1} value={progress.successCount + progress.failedCount} />
            <div className="meta-line">
              성공 {progress.successCount} · 실패 {progress.failedCount} · 현재 {progress.currentName ?? "-"}
            </div>
            <div>{progress.message}</div>
          </div>
        )}
        {message && <WarningBox>{message}</WarningBox>}
      </section>
      <section className="panel">
        <div className="section-heading">
          <h2>동기화 상태</h2>
        </div>
        <div className="stats-grid">
          <Stat label="규정" value={stats?.regulationCount ?? 0} />
          <Stat label="조문" value={stats?.articleCount ?? 0} />
          <Stat label="마지막 성공" value={stats?.lastSuccessCount ?? 0} />
          <Stat label="마지막 실패" value={stats?.lastFailedCount ?? 0} />
        </div>
        <div className="meta-line">마지막 동기화: {stats?.lastSyncAt ? new Date(stats.lastSyncAt).toLocaleString("ko-KR") : "-"}</div>
        <div className="failure-list">
          {failures.map((failure) => (
            <div key={`${failure.seqHistory}-${failure.message}`} className="failure-item">
              <strong>{failure.regulationName}</strong>
              <span>[{failure.errorCode}] {failure.message}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
