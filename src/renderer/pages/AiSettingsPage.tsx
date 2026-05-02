import { KeyRound, PlugZap, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { AiModelId, AiSettings } from "../../shared/types";
import { DEFAULT_MODEL_ID } from "../../shared/constants";
import { ModelSelector } from "../components/ModelSelector";
import { WarningBox } from "../components/WarningBox";
import { getErrorMessage, unwrap } from "../lib/api";

export function AiSettingsPage() {
  const [settings, setSettings] = useState<AiSettings>({ modelId: DEFAULT_MODEL_ID, hasApiKey: false });
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void window.kuRegulation.settings.get().then((result) => setSettings(unwrap(result)));
  }, []);

  async function updateModel(modelId: AiModelId) {
    setSettings(unwrap(await window.kuRegulation.settings.setModel(modelId)));
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
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
          <h1>AI 설정</h1>
          <span className={`status-pill ${settings.hasApiKey ? "ok" : "warn"}`}>
            {settings.hasApiKey ? "API Key 저장됨" : "API Key 없음"}
          </span>
        </div>
        <label className="field">
          <span>Gemini API Key</span>
          <input value={apiKey} onChange={(event) => setApiKey(event.currentTarget.value)} type="password" spellCheck={false} />
        </label>
        <div className="button-row">
          <button disabled={busy} type="button" onClick={() => run(async () => {
            setSettings(unwrap(await window.kuRegulation.settings.saveApiKey(apiKey)));
            setApiKey("");
            setMessage("API Key를 저장했습니다.");
          })}>
            <KeyRound size={17} />
            API Key 저장
          </button>
          <button disabled={busy} type="button" className="secondary" onClick={() => run(async () => {
            unwrap(await window.kuRegulation.settings.testConnection(apiKey || undefined));
            setMessage("연결 테스트가 성공했습니다.");
          })}>
            <PlugZap size={17} />
            연결 테스트
          </button>
          <button disabled={busy} type="button" className="secondary danger" onClick={() => run(async () => {
            setSettings(unwrap(await window.kuRegulation.settings.deleteApiKey()));
            setMessage("API Key를 삭제했습니다.");
          })}>
            <Trash2 size={17} />
            API Key 삭제
          </button>
        </div>
        <WarningBox tone="info">
          Gemini API 호출 시 사용자 질문과 선택된 관련 조항 일부가 Google API로 전송됩니다. 개인정보, 학생정보, 민감한 내부 문서는 질문에 입력하지 마세요.
        </WarningBox>
        {message && <WarningBox>{message}</WarningBox>}
      </section>
      <section className="panel">
        <div className="section-heading">
          <h2>모델 선택</h2>
        </div>
        <ModelSelector value={settings.modelId} onChange={updateModel} />
      </section>
    </div>
  );
}
