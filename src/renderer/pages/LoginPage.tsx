import { LogIn, LogOut, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import type { AuthStatus } from "../../shared/types";
import { getErrorMessage, unwrap } from "../lib/api";
import { WarningBox } from "../components/WarningBox";

export function LoginPage() {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
        <div className="section-heading">
          <h1>로그인</h1>
          <span className={`status-pill ${status?.status === "AUTHENTICATED" ? "ok" : "warn"}`}>
            {formatAuthStatus(status?.status)}
          </span>
        </div>
        <div className="button-row">
          <button type="button" disabled={busy} onClick={() => run(async () => unwrap(await window.kuRegulation.auth.openLogin()))}>
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
        {message && <WarningBox tone={status?.status === "AUTHENTICATED" ? "info" : "warning"}>{message}</WarningBox>}
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
