import { LogIn, LogOut, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import type { AuthStatus } from "../../shared/types";
import { getErrorMessage, unwrap } from "../lib/api";
import { WarningBox } from "../components/WarningBox";
import { PageHeader } from "../components/PageHeader";
import { StatusMessage } from "../components/StatusMessage";

export function LoginPage() {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function openLogin() {
    setBusy(true);
    setMessage("고려대 공식 로그인 창에서 로그인한 뒤, 로그인 창을 닫으면 이 화면에서 로그인 상태를 확인합니다.");
    try {
      const next = unwrap(await window.kuRegulation.auth.openLogin());
      setStatus(next);
      setMessage(next.message);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function run(action: () => Promise<AuthStatus>) {
    setBusy(true);
    setMessage(null);
    try {
      const next = await action();
      setStatus(next);
      setMessage(next.message);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <PageHeader title="로그인">
          <span className={`status-pill ${status?.status === "AUTHENTICATED" ? "ok" : "warn"}`}>
            {formatAuthStatus(status?.status)}
          </span>
        </PageHeader>
        <div className="button-row">
          <button type="button" disabled={busy} onClick={openLogin}>
            <LogIn size={17} />
            로그인 열기
          </button>
          <button type="button" disabled={busy} onClick={() => run(async () => unwrap(await window.kuRegulation.auth.status()))}>
            <RefreshCw size={17} />
            로그인 상태 확인
          </button>
          <button type="button" disabled={busy} onClick={() => run(async () => unwrap(await window.kuRegulation.auth.logout()))}>
            <LogOut size={17} />
            로그아웃
          </button>
          <button type="button" className="secondary danger" disabled={busy} onClick={() => run(async () => {
            unwrap(await window.kuRegulation.data.clearSession());
            return { status: "AUTH_REQUIRED", message: "[AUTH_REQUIRED] 로컬 세션을 삭제했습니다." };
          })}>
            <Trash2 size={17} />
            로컬 세션 삭제
          </button>
        </div>
        <WarningBox tone="info">
          로그인 열기를 누르면 고려대학교 규정관리시스템 공식 로그인 창이 열립니다. 그 창에서 직접 로그인한 뒤 로그인 창을 닫아야 이 화면의 로그인 상태가 갱신됩니다.
        </WarningBox>
        <StatusMessage message={message} tone={status?.status === "AUTHENTICATED" ? "info" : "warning"} />
      </section>
    </div>
  );
}

function formatAuthStatus(status?: AuthStatus["status"]): string {
  if (status === "AUTHENTICATED") return "로그인됨";
  if (status === "AUTH_EXPIRED") return "세션 만료";
  if (status === "AUTH_REQUIRED") return "로그인 필요";
  return "확인 전";
}
