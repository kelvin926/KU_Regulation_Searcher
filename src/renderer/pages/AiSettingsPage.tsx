import { KeyRound, PlugZap, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { AiModelId, AiSettings } from "../../shared/types";
import { DEFAULT_MODEL_ID } from "../../shared/constants";
import { ModelSelector } from "../components/ModelSelector";
import { WarningBox } from "../components/WarningBox";
import { getErrorMessage, unwrap } from "../lib/api";

export function AiSettingsPage() {
  const [settings, setSettings] = useState<AiSettings>({
    modelId: DEFAULT_MODEL_ID,
    hasApiKey: false,
    usage: {
      requestCount: 0,
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      thoughtsTokenCount: 0,
      totalTokenCount: 0,
      lastUsedAt: null,
    },
  });
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
            {settings.hasApiKey ? "API 키 저장됨" : "API 키 없음"}
          </span>
        </div>
        <label className="field">
          <span>Gemini API 키</span>
          <input
            value={apiKey}
            onChange={(event) => setApiKey(event.currentTarget.value)}
            type="password"
            spellCheck={false}
            disabled={settings.hasApiKey}
            placeholder={settings.hasApiKey ? "저장된 키가 있습니다. 새로 입력하려면 먼저 삭제하세요." : "예: Google AI Studio에서 발급한 Gemini API 키"}
          />
        </label>
        <div className="button-row">
          <button disabled={busy || settings.hasApiKey || apiKey.trim().length === 0} type="button" onClick={() => run(async () => {
            setSettings(unwrap(await window.kuRegulation.settings.saveApiKey(apiKey)));
            setApiKey("");
            setMessage("Gemini API 키를 저장했습니다.");
          })}>
            <KeyRound size={17} />
            Gemini API 키 저장
          </button>
          <button disabled={busy} type="button" className="secondary" onClick={() => run(async () => {
            unwrap(await window.kuRegulation.settings.testConnection(apiKey || undefined));
            setSettings(unwrap(await window.kuRegulation.settings.get()));
            setMessage("연결 테스트가 성공했습니다.");
          })}>
            <PlugZap size={17} />
            연결 테스트
          </button>
          <button disabled={busy} type="button" className="secondary danger" onClick={() => run(async () => {
            setSettings(unwrap(await window.kuRegulation.settings.deleteApiKey()));
            setApiKey("");
            setMessage("Gemini API 키를 삭제했습니다.");
          })}>
            <Trash2 size={17} />
            Gemini API 키 삭제
          </button>
          <button disabled={busy} type="button" className="secondary" onClick={() => run(async () => {
            setSettings(unwrap(await window.kuRegulation.settings.resetUsage()));
            setMessage("AI 사용량을 초기화했습니다.");
          })}>
            <RotateCcw size={17} />
            AI 사용량 초기화
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
        <div className="section-heading sub-heading">
          <h2>AI 사용량</h2>
        </div>
        <div className="stats-grid">
          <Stat label="AI 호출" value={`${settings.usage.requestCount.toLocaleString("ko-KR")}회`} />
          <Stat label="전체 토큰" value={`${settings.usage.totalTokenCount.toLocaleString("ko-KR")}개`} />
          <Stat label="입력 토큰" value={`${settings.usage.promptTokenCount.toLocaleString("ko-KR")}개`} />
          <Stat label="출력 토큰" value={`${settings.usage.candidatesTokenCount.toLocaleString("ko-KR")}개`} />
        </div>
        <div className="meta-line">
          마지막 AI 사용: {settings.usage.lastUsedAt ? new Date(settings.usage.lastUsedAt).toLocaleString("ko-KR") : "없음"}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
