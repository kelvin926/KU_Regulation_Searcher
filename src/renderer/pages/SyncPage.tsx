import { CheckSquare, PauseCircle, RefreshCw, RotateCw, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DbStats, RegulationTarget, RegulationTargetCacheInfo, SyncFailure, SyncProgress } from "../../shared/types";
import { getErrorMessage, unwrap } from "../lib/api";
import { extractSearchTerms, matchesSearchQuery } from "../lib/searchOperators";
import { HighlightedText } from "../components/HighlightedText";
import { SearchOperatorHint } from "../components/SearchOperatorHint";
import { WarningBox } from "../components/WarningBox";

interface TargetFolder {
  name: string;
  path: string[];
  folders: TargetFolder[];
  targets: RegulationTarget[];
}

export function SyncPage() {
  const [targets, setTargets] = useState<RegulationTarget[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [stats, setStats] = useState<DbStats | null>(null);
  const [targetCacheInfo, setTargetCacheInfo] = useState<RegulationTargetCacheInfo | null>(null);
  const [failures, setFailures] = useState<SyncFailure[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "warning" | "danger">("info");
  const [filter, setFilter] = useState("");
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [progressStartedAtMs, setProgressStartedAtMs] = useState<number | null>(null);
  const visibleTargets = useMemo(() => {
    const query = filter.trim();
    if (!query) return targets;
    return targets.filter((target) =>
      matchesSearchQuery(
        [target.regulationName, target.category, ...(target.categoryPath ?? []), String(target.seqHistory), String(target.seq ?? "")]
          .filter(Boolean)
          .join(" "),
        query,
      ),
    );
  }, [filter, targets]);
  const targetTree = useMemo(() => buildTargetTree(visibleTargets), [visibleTargets]);
  const visibleSeqHistories = useMemo(() => visibleTargets.map((target) => target.seqHistory), [visibleTargets]);
  const visibleSelectedCount = useMemo(
    () => visibleSeqHistories.filter((seqHistory) => selected.has(seqHistory)).length,
    [selected, visibleSeqHistories],
  );
  const allVisibleSelected = visibleSeqHistories.length > 0 && visibleSelectedCount === visibleSeqHistories.length;
  const syncStatus = progress?.status ?? "idle";
  const syncActive = syncStatus === "running" || syncStatus === "stopping";
  const displayedSuccessCount = progress ? progress.successCount : (stats?.lastSuccessCount ?? 0);
  const displayedFailedCount = progress ? progress.failedCount : (stats?.lastFailedCount ?? 0);
  const estimatedSyncTime = progress && syncActive ? formatEstimatedSyncTime(progress, progressStartedAtMs) : null;

  useEffect(() => {
    void refresh();
    return window.kuRegulation.sync.onProgress((next) => {
      setProgress(next);
      setProgressStartedAtMs((previous) => {
        if (next.status === "running" || next.status === "stopping") return previous ?? Date.now();
        if (next.status === "completed" || next.status === "failed" || next.status === "cancelled") return null;
        return previous;
      });
      void refreshSyncStatus();
    });
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
    setTargetCacheInfo(unwrap(await window.kuRegulation.sync.targetCacheInfo()));
  }

  async function refreshSyncStatus() {
    setStats(unwrap(await window.kuRegulation.db.stats()));
    setFailures(unwrap(await window.kuRegulation.db.failures()));
  }

  async function refreshTargetList() {
    setLoadingTargets(true);
    setMessageTone("info");
    setMessage(null);
    try {
      const loadedTargets = unwrap(await window.kuRegulation.sync.refreshTargets());
      setTargets(loadedTargets);
      setSelected((previous) => {
        const available = new Set(loadedTargets.map((target) => target.seqHistory));
        return new Set(Array.from(previous).filter((seqHistory) => available.has(seqHistory)));
      });
      setMessageTone("info");
      setMessage(`규정 목록 새로고침 완료: ${loadedTargets.length}개를 불러왔습니다. 필요한 규정만 선택해서 동기화하세요.`);
      setTargetCacheInfo(unwrap(await window.kuRegulation.sync.targetCacheInfo()));
    } catch (error) {
      setMessageTone("danger");
      setMessage(formatSyncActionError(error));
    } finally {
      setLoadingTargets(false);
    }
  }

  async function start(seqHistories?: number[]) {
    setMessage(null);
    setProgressStartedAtMs(Date.now());
    try {
      const result = unwrap(await window.kuRegulation.sync.start(seqHistories));
      setProgress(result);
      await refresh();
    } catch (error) {
      setMessageTone("danger");
      setMessage(formatSyncActionError(error));
    }
  }

  function setTargetChecked(seqHistory: number, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(seqHistory);
    else next.delete(seqHistory);
    setSelected(next);
  }

  function selectFolder(folder: TargetFolder) {
    const seqHistories = collectFolderSeqHistories(folder);
    const allSelected = seqHistories.length > 0 && seqHistories.every((seqHistory) => selected.has(seqHistory));
    const next = new Set(selected);
    for (const seqHistory of seqHistories) {
      if (allSelected) next.delete(seqHistory);
      else next.add(seqHistory);
    }
    setSelected(next);
  }

  function toggleVisibleTargets() {
    const next = new Set(selected);
    for (const seqHistory of visibleSeqHistories) {
      if (allVisibleSelected) next.delete(seqHistory);
      else next.add(seqHistory);
    }
    setSelected(next);
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <h1>동기화</h1>
          <span className={`status-pill ${getSyncStatusClass(syncStatus)}`}>{formatSyncStatus(syncStatus)}</span>
        </div>
        <div className="button-row">
          <button type="button" disabled={loadingTargets} onClick={refreshTargetList}>
            <RotateCw size={17} className={loadingTargets ? "icon-spin" : undefined} />
            {loadingTargets ? "규정 목록 새로고침 중" : "규정 목록 새로고침"}
          </button>
          <button type="button" disabled={selected.size === 0} onClick={() => start(Array.from(selected))}>
            <RefreshCw size={17} />
            선택 규정 동기화
          </button>
          <button
            type="button"
            className="secondary"
            disabled={visibleSeqHistories.length === 0}
            onClick={toggleVisibleTargets}
          >
            {allVisibleSelected ? <Square size={17} /> : <CheckSquare size={17} />}
            {allVisibleSelected ? "표시 목록 전체 해제" : "표시 목록 전체 선택"}
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
            placeholder='예: 학칙 OR 대학원 -세칙'
          />
          <span className="meta-line">
            전체 {targets.length}개 · 표시 {visibleTargets.length}개 · 선택 {selected.size}개
          </span>
        </div>
        <SearchOperatorHint />
        {loadingTargets && <WarningBox tone="info">규정 목록을 새로고침 중입니다. 완료될 때까지 잠시 기다려주세요.</WarningBox>}
        {!targetCacheInfo?.hasRefreshed ? (
          <WarningBox tone="warning">
            규정 목록을 아직 새로고침하지 않았습니다. 로그인이 필요하면 로그인 탭에서 로그인 열기를 누르고, 고려대 공식 로그인 창에서 로그인한 뒤 창을 닫고 다시 시도하세요.
          </WarningBox>
        ) : (
          <div className="meta-line">
            규정 목록 마지막 새로고침:{" "}
            {targetCacheInfo.refreshedAt ? new Date(targetCacheInfo.refreshedAt).toLocaleString("ko-KR") : "확인 불가"}
          </div>
        )}
        {progress && (
          <div className="progress-block">
            <progress max={progress.totalCount || 1} value={progress.successCount + progress.failedCount} />
            <div className="meta-line">
              성공 {progress.successCount} · 실패 {progress.failedCount} · 현재 {progress.currentName ?? "-"}
            </div>
            {estimatedSyncTime && <div className="meta-line">{estimatedSyncTime}</div>}
            <div>{progress.message}</div>
          </div>
        )}
        {message && <WarningBox tone={messageTone}>{message}</WarningBox>}
        <div className="target-tree">
          {targetTree.map((folder) => (
            <TargetFolderNode
              key={folder.path.join("/")}
              folder={folder}
              selected={selected}
              onSelectFolder={selectFolder}
              onTargetChecked={setTargetChecked}
              highlightTerms={extractSearchTerms(filter)}
            />
          ))}
          {visibleTargets.length === 0 && <div className="empty-panel">표시할 규정이 없습니다.</div>}
        </div>
      </section>
      <section className="panel">
        <div className="section-heading">
          <h2>동기화 상태</h2>
        </div>
        <div className="stats-grid">
          <Stat label="규정" value={stats?.regulationCount ?? 0} />
          <Stat label="조문" value={stats?.articleCount ?? 0} />
          <Stat label={syncActive ? "현재 성공" : "마지막 성공"} value={displayedSuccessCount} />
          <Stat label={syncActive ? "현재 실패" : "마지막 실패"} value={displayedFailedCount} />
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

function TargetFolderNode({
  folder,
  selected,
  onSelectFolder,
  onTargetChecked,
  highlightTerms,
}: {
  folder: TargetFolder;
  selected: Set<number>;
  onSelectFolder: (folder: TargetFolder) => void;
  onTargetChecked: (seqHistory: number, checked: boolean) => void;
  highlightTerms: string[];
}) {
  const totalCount = collectFolderSeqHistories(folder).length;
  const selectedCount = collectFolderSeqHistories(folder).filter((seqHistory) => selected.has(seqHistory)).length;
  const allSelected = totalCount > 0 && selectedCount === totalCount;

  return (
    <details className="target-folder" open>
      <summary>
        <span className="target-folder-name">{folder.name}</span>
        <span className="target-folder-count">
          {selectedCount}/{totalCount}
        </span>
        <button
          type="button"
          className="folder-action"
          disabled={totalCount === 0}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onSelectFolder(folder);
          }}
        >
          {allSelected ? "전체 해제" : "전체 선택"}
        </button>
      </summary>
      <div className="target-folder-body">
        {folder.folders.map((child) => (
          <TargetFolderNode
            key={child.path.join("/")}
            folder={child}
            selected={selected}
            onSelectFolder={onSelectFolder}
            onTargetChecked={onTargetChecked}
            highlightTerms={highlightTerms}
          />
        ))}
        {folder.targets.map((target) => (
          <label key={target.seqHistory} className="target-item">
            <input
              type="checkbox"
              checked={selected.has(target.seqHistory)}
              onChange={(event) => onTargetChecked(target.seqHistory, event.currentTarget.checked)}
            />
            <span>
              <HighlightedText text={target.regulationName} terms={highlightTerms} />
            </span>
            <span className="target-meta">
              {target.seq && <code>SEQ {target.seq}</code>}
              <code>SEQ_HISTORY {target.seqHistory}</code>
            </span>
          </label>
        ))}
      </div>
    </details>
  );
}

function buildTargetTree(targets: RegulationTarget[]): TargetFolder[] {
  const rootFolders: TargetFolder[] = [];

  for (const target of targets) {
    const path = normalizeCategoryPath(target);
    let folders = rootFolders;
    let current: TargetFolder | null = null;

    for (let index = 0; index < path.length; index += 1) {
      const name = path[index];
      let folder = folders.find((item) => item.name === name);
      if (!folder) {
        folder = {
          name,
          path: path.slice(0, index + 1),
          folders: [],
          targets: [],
        };
        folders.push(folder);
      }
      current = folder;
      folders = folder.folders;
    }

    if (current) current.targets.push(target);
  }

  return rootFolders;
}

function normalizeCategoryPath(target: RegulationTarget): string[] {
  if (target.categoryPath?.length) return [...target.categoryPath];
  if (target.category) {
    const parts = target.category
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts;
  }
  return ["미분류"];
}

function collectFolderSeqHistories(folder: TargetFolder): number[] {
  return [
    ...folder.targets.map((target) => target.seqHistory),
    ...folder.folders.flatMap((child) => collectFolderSeqHistories(child)),
  ];
}

function formatSyncStatus(status: SyncProgress["status"]): string {
  switch (status) {
    case "running":
      return "동기화 중";
    case "stopping":
      return "중지 중";
    case "completed":
      return "완료";
    case "failed":
      return "실패";
    case "cancelled":
      return "취소됨";
    default:
      return "대기 중";
  }
}

function getSyncStatusClass(status: SyncProgress["status"]): string {
  switch (status) {
    case "running":
      return "running";
    case "stopping":
      return "stopping";
    case "completed":
      return "ok";
    case "failed":
      return "danger";
    case "cancelled":
      return "cancelled";
    default:
      return "idle";
  }
}

function formatEstimatedSyncTime(progress: SyncProgress, startedAtMs: number | null): string {
  if (!startedAtMs || progress.totalCount <= 0) return "예상 소요 시간: 계산 중";

  const completedCount = progress.successCount + progress.failedCount;
  if (completedCount <= 0) return "예상 소요 시간: 계산 중";

  const elapsedMs = Math.max(Date.now() - startedAtMs, 1);
  const averageMs = elapsedMs / completedCount;
  const remainingCount = Math.max(progress.totalCount - completedCount, 0);
  const remainingMs = averageMs * remainingCount;
  const totalMs = averageMs * progress.totalCount;
  return `예상 남은 시간: ${formatDuration(remainingMs)} · 예상 총 소요 시간: ${formatDuration(totalMs)}`;
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "1초 미만";
  const totalSeconds = Math.max(1, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}시간 ${minutes}분`;
  if (minutes > 0) return `${minutes}분 ${seconds}초`;
  return `${seconds}초`;
}

function formatSyncActionError(error: unknown): string {
  const message = getErrorMessage(error);
  if (message.includes("[AUTH_REQUIRED]") || message.includes("[AUTH_EXPIRED]")) {
    return `${message} 로그인 탭에서 로그인 열기를 누르고, 고려대 공식 로그인 창에서 로그인한 뒤 창을 닫고 다시 시도하세요.`;
  }
  return message;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
