import { PauseCircle, RefreshCw, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    void refresh();
    return window.kuRegulation.sync.onProgress((next) => setProgress(next));
  }, []);

  async function refresh() {
    const loadedTargets = unwrap(await window.kuRegulation.sync.targets());
    setTargets(loadedTargets);
    setSelected(new Set(loadedTargets.map((target) => target.seqHistory)));
    setStats(unwrap(await window.kuRegulation.db.stats()));
    setFailures(unwrap(await window.kuRegulation.db.failures()));
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
          <button type="button" onClick={() => start()}>
            <RotateCw size={17} />
            전체 규정 동기화
          </button>
          <button type="button" onClick={() => start(Array.from(selected))}>
            <RefreshCw size={17} />
            선택 규정 동기화
          </button>
          <button type="button" className="secondary" onClick={() => window.kuRegulation.sync.stop()}>
            <PauseCircle size={17} />
            동기화 중지
          </button>
        </div>
        <div className="target-list">
          {targets.map((target) => (
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
              <code>SEQ_HISTORY {target.seqHistory}</code>
            </label>
          ))}
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
