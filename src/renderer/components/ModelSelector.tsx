import type { AiModelId } from "../../shared/types";
import { AI_MODELS, PREVIEW_MODEL_WARNING } from "../../shared/constants";
import { WarningBox } from "./WarningBox";

export function ModelSelector({
  value,
  onChange,
}: {
  value: AiModelId;
  onChange: (modelId: AiModelId) => void;
}) {
  const selected = AI_MODELS.find((model) => model.id === value);
  return (
    <div className="model-selector">
      <div className="segmented-control">
        {AI_MODELS.map((model) => (
          <button
            key={model.id}
            className={model.id === value ? "active" : ""}
            type="button"
            onClick={() => onChange(model.id)}
          >
            <strong>{model.label}</strong>
            <span>{model.description}</span>
            <span className="model-detail">
              <b>추천</b> {model.bestFor}
            </span>
            <span className="model-detail">
              <b>주의</b> {model.tradeoff}
            </span>
          </button>
        ))}
      </div>
      <div className="current-model">현재 선택 모델: {selected?.label ?? value}</div>
      {value.includes("preview") && <WarningBox>{PREVIEW_MODEL_WARNING}</WarningBox>}
    </div>
  );
}
