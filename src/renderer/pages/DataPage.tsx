import { Database, KeyRound, Trash2, UserX } from "lucide-react";
import { useEffect, useState } from "react";
import type { DbStats } from "../../shared/types";
import { WarningBox } from "../components/WarningBox";
import { getErrorMessage, unwrap } from "../lib/api";

export function DataPage() {
  const [stats, setStats] = useState<DbStats | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setStats(unwrap(await window.kuRegulation.db.stats()));
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

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <h1>데이터 관리</h1>
        </div>
        <div className="stats-grid">
          <div className="stat"><span>규정</span><strong>{stats?.regulationCount ?? 0}</strong></div>
          <div className="stat"><span>조문</span><strong>{stats?.articleCount ?? 0}</strong></div>
        </div>
        <div className="button-column">
          <button type="button" className="secondary danger" onClick={() => run(async () => {
            unwrap(await window.kuRegulation.db.clear());
            setMessage("로컬 DB를 초기화했습니다.");
          })}>
            <Database size={17} />
            로컬 DB 초기화
          </button>
          <button type="button" className="secondary danger" onClick={() => run(async () => {
            unwrap(await window.kuRegulation.data.clearSession());
            setMessage("세션을 삭제했습니다.");
          })}>
            <UserX size={17} />
            세션 삭제
          </button>
          <button type="button" className="secondary danger" onClick={() => run(async () => {
            unwrap(await window.kuRegulation.settings.deleteApiKey());
            setMessage("API Key를 삭제했습니다.");
          })}>
            <KeyRound size={17} />
            API Key 삭제
          </button>
          <button type="button" className="danger" onClick={() => run(async () => {
            unwrap(await window.kuRegulation.data.clearAll());
            setMessage("전체 로컬 데이터를 삭제했습니다.");
          })}>
            <Trash2 size={17} />
            전체 로컬 데이터 삭제
          </button>
        </div>
        {message && <WarningBox>{message}</WarningBox>}
      </section>
      <section className="panel">
        <WarningBox tone="info">
          규정 해석의 최종 판단은 학과사무실 또는 담당 부서 확인이 필요합니다.
        </WarningBox>
      </section>
    </div>
  );
}
