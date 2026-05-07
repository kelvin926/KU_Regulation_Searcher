import { Database, FolderOpen, KeyRound, Pencil, Plus, Save, Trash2, UserX, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { CustomRegulationInput, CustomRegulationRecord, DbStats, QueryCampusOption, QueryGroupOption } from "../../shared/types";
import { WarningBox } from "../components/WarningBox";
import { getErrorMessage, unwrap } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";
import { StatusMessage } from "../components/StatusMessage";
import {
  QUERY_CAMPUS_SELECT_OPTIONS,
  QUERY_GROUP_SELECT_OPTIONS,
  formatQueryCampusOption,
  formatQueryGroupOption,
} from "../lib/queryScopeOptions";

const DEFAULT_CUSTOM_FORM: CustomRegulationInput = {
  regulationName: "",
  customCampus: "auto",
  customScope: "undergraduate",
  customNote: "",
  body: "",
};

export function DataPage() {
  const [stats, setStats] = useState<DbStats | null>(null);
  const [customRegulations, setCustomRegulations] = useState<CustomRegulationRecord[]>([]);
  const [customForm, setCustomForm] = useState<CustomRegulationInput>(DEFAULT_CUSTOM_FORM);
  const [editingCustomId, setEditingCustomId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setStats(unwrap(await window.kuRegulation.db.stats()));
    setCustomRegulations(unwrap(await window.kuRegulation.customRegulations.list()));
  }

  async function run(action: () => Promise<void>) {
    setMessage(null);
    try {
      await action();
      await refresh();
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function saveCustomRegulation() {
    await run(async () => {
      if (editingCustomId) {
        unwrap(await window.kuRegulation.customRegulations.update(editingCustomId, customForm));
        setMessage("커스텀 규정을 수정했습니다.");
      } else {
        unwrap(await window.kuRegulation.customRegulations.create(customForm));
        setMessage("커스텀 규정을 등록했습니다.");
      }
      clearCustomForm();
    });
  }

  async function deleteCustomRegulation(id: number) {
    if (!window.confirm("이 커스텀 규정을 삭제할까요?")) return;
    await run(async () => {
      unwrap(await window.kuRegulation.customRegulations.delete(id));
      if (editingCustomId === id) clearCustomForm();
      setMessage("커스텀 규정을 삭제했습니다.");
    });
  }

  function startEditCustomRegulation(regulation: CustomRegulationRecord) {
    setEditingCustomId(regulation.id);
    setCustomForm({
      regulationName: regulation.regulation_name,
      customCampus: regulation.custom_campus ?? "auto",
      customScope: regulation.custom_scope,
      customNote: regulation.custom_note ?? "",
      body: regulation.body ?? "",
    });
    setMessage("커스텀 규정을 수정하는 중입니다. 저장하면 기존 조항과 검색 인덱스가 새 본문 기준으로 갱신됩니다.");
  }

  function clearCustomForm() {
    setEditingCustomId(null);
    setCustomForm(DEFAULT_CUSTOM_FORM);
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <PageHeader title="데이터 관리" />
        <div className="stats-grid">
          <StatCard label="규정" value={stats?.regulationCount ?? 0} />
          <StatCard label="조문" value={stats?.articleCount ?? 0} />
          <StatCard label="규정 저장 용량" value={formatBytes(stats?.storageBytes ?? 0)} />
        </div>
        <div className="button-column">
          <button
            type="button"
            className="secondary"
            onClick={() =>
              run(async () => {
                unwrap(await window.kuRegulation.data.openFolder());
                setMessage("저장 데이터 폴더를 열었습니다.");
              })
            }
          >
            <FolderOpen size={17} />
            저장 데이터 폴더 열기
          </button>
          <button
            type="button"
            className="secondary danger"
            onClick={() =>
              run(async () => {
                unwrap(await window.kuRegulation.db.clear());
                setMessage("저장된 규정을 초기화했습니다.");
              })
            }
          >
            <Database size={17} />
            저장된 규정 초기화
          </button>
          <button
            type="button"
            className="secondary danger"
            onClick={() =>
              run(async () => {
                unwrap(await window.kuRegulation.data.clearSession());
                setMessage("로그인 상태를 삭제했습니다.");
              })
            }
          >
            <UserX size={17} />
            로그인 상태 삭제
          </button>
          <button
            type="button"
            className="secondary danger"
            onClick={() =>
              run(async () => {
                unwrap(await window.kuRegulation.settings.deleteApiKey());
                setMessage("Gemini API 키를 삭제했습니다.");
              })
            }
          >
            <KeyRound size={17} />
            Gemini API 키 삭제
          </button>
          <button
            type="button"
            className="danger"
            onClick={() =>
              run(async () => {
                unwrap(await window.kuRegulation.data.clearAll());
                setMessage("전체 로컬 데이터를 삭제했습니다.");
              })
            }
          >
            <Trash2 size={17} />
            로그인/규정/API 키 모두 삭제
          </button>
        </div>
        <StatusMessage message={message} />
      </section>
      <section className="panel">
        <WarningBox tone="info">규정 해석의 최종 판단은 학과사무실 또는 담당 부서 확인이 필요합니다.</WarningBox>
        <div className="section-heading">
          <h2>커스텀 규정</h2>
          <span className="status-pill">{customRegulations.length}개</span>
        </div>
        <div className="custom-rule-form">
          <label className="field-label">
            규정명
            <input
              value={customForm.regulationName}
              onChange={(event) => setCustomForm({ ...customForm, regulationName: event.currentTarget.value })}
              placeholder="예: 미래모빌리티학과 운영 내규"
            />
          </label>
          <label className="field-label">
            적용 캠퍼스
            <select
              value={customForm.customCampus ?? "auto"}
              onChange={(event) => setCustomForm({ ...customForm, customCampus: event.currentTarget.value as QueryCampusOption })}
            >
              {QUERY_CAMPUS_SELECT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            적용 그룹
            <select
              value={customForm.customScope}
              onChange={(event) => setCustomForm({ ...customForm, customScope: event.currentTarget.value as QueryGroupOption })}
            >
              {QUERY_GROUP_SELECT_OPTIONS.filter((option) => option.value !== "auto").map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            출처/메모
            <input
              value={customForm.customNote ?? ""}
              onChange={(event) => setCustomForm({ ...customForm, customNote: event.currentTarget.value })}
              placeholder="예: 학과 공지, 2026-1 적용"
            />
          </label>
          <label className="field-label full-span">
            본문
            <textarea
              className="custom-rule-textarea"
              value={customForm.body}
              onChange={(event) => setCustomForm({ ...customForm, body: event.currentTarget.value })}
              placeholder={"제1조(목적) ...\n제2조(휴학) ..."}
            />
          </label>
          <div className="button-row full-span">
            <button
              type="button"
              disabled={customForm.regulationName.trim().length < 2 || customForm.body.trim().length < 10}
              onClick={saveCustomRegulation}
            >
              {editingCustomId ? <Save size={17} /> : <Plus size={17} />}
              {editingCustomId ? "커스텀 규정 수정" : "커스텀 규정 등록"}
            </button>
            {editingCustomId && (
              <button type="button" className="secondary" onClick={clearCustomForm}>
                <X size={17} />
                수정 취소
              </button>
            )}
          </div>
        </div>
        <div className="custom-rule-list">
          {customRegulations.map((regulation) => (
            <article key={regulation.id} className="custom-rule-item">
              <div>
                <strong>{regulation.regulation_name}</strong>
                <div className="meta-line">
                  {formatQueryCampusOption(regulation.custom_campus)} / {formatQueryGroupOption(regulation.custom_scope)} · 조항{" "}
                  {regulation.article_count}개 · 수정{" "}
                  {formatDate(regulation.updated_at)}
                </div>
                {regulation.custom_note && <div className="meta-line">{regulation.custom_note}</div>}
              </div>
              <div className="button-row custom-rule-actions">
                <button type="button" className="secondary" onClick={() => startEditCustomRegulation(regulation)}>
                  <Pencil size={15} />
                  수정
                </button>
                <button type="button" className="secondary danger" onClick={() => deleteCustomRegulation(regulation.id)}>
                  <Trash2 size={15} />
                  삭제
                </button>
              </div>
            </article>
          ))}
          {customRegulations.length === 0 && <div className="empty-panel">등록된 커스텀 규정이 없습니다.</div>}
        </div>
      </section>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR");
}
