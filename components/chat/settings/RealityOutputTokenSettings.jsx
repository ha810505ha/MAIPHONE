import React, { useEffect, useState } from "react";
import {
  REALITY_OUTPUT_TOKENS_DEFAULT,
  REALITY_OUTPUT_TOKENS_MAX,
  REALITY_OUTPUT_TOKENS_MIN,
  REALITY_OUTPUT_TOKENS_STEP,
  normalizeRealityOutputTokens,
} from "../../../utils/realityOutputSettings";

export default function RealityOutputTokenSettings({ value, onChange, tr }) {
  const normalized = normalizeRealityOutputTokens(value);
  const [draft, setDraft] = useState(String(normalized));

  useEffect(() => setDraft(String(normalized)), [normalized]);

  const commit = (nextValue) => {
    const next = normalizeRealityOutputTokens(nextValue);
    setDraft(String(next));
    onChange?.(next);
  };

  return (
    <div className="mp-cc">
      <div className="mp-lbl">{tr("現實模式最大輸出 Token", "Reality mode max output tokens", "現実モードの最大出力トークン", "현실 모드 최대 출력 토큰")}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <input
          type="range"
          min={REALITY_OUTPUT_TOKENS_MIN}
          max={REALITY_OUTPUT_TOKENS_MAX}
          step={REALITY_OUTPUT_TOKENS_STEP}
          value={normalized}
          onChange={(event) => commit(event.target.value)}
          aria-label={tr("現實模式最大輸出 Token", "Reality mode max output tokens", "現実モードの最大出力トークン", "현실 모드 최대 출력 토큰")}
          style={{ flex: 1 }}
        />
        <input
          className="mp-sinp"
          type="number"
          min={REALITY_OUTPUT_TOKENS_MIN}
          max={REALITY_OUTPUT_TOKENS_MAX}
          step="1"
          inputMode="numeric"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
          aria-label={tr("輸入最大輸出 Token", "Enter max output tokens", "最大出力トークンを入力", "최대 출력 토큰 입력")}
          style={{ width: 88 }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 10, color: "var(--mp-txt-l)" }}><span>{REALITY_OUTPUT_TOKENS_MIN}</span><span>{REALITY_OUTPUT_TOKENS_MAX}</span></div>
      <p style={{ margin: "8px 0 0", fontSize: 11, lineHeight: 1.5, color: "var(--mp-txt-l)" }}>{tr("只控制目前聊天室的現實模式回覆上限。數值越高，可能增加等待時間與 API 費用；推理模型會使用部分額度思考。", "Only controls the reality-mode reply limit in this chat. Higher values may increase wait time and API cost; reasoning models use part of the budget for thinking.", "このチャットの現実モード返信上限だけを調整します。値を上げると待ち時間や API 料金が増える場合があり、推論モデルは一部を思考に使用します。", "현재 채팅의 현실 모드 답변 한도만 조절합니다. 값이 높을수록 대기 시간과 API 비용이 늘 수 있으며, 추론 모델은 일부를 사고에 사용합니다.")}</p>
      {normalized !== REALITY_OUTPUT_TOKENS_DEFAULT && <button type="button" className="mp-reality-token-reset" onClick={() => commit(REALITY_OUTPUT_TOKENS_DEFAULT)}><span>{tr("恢復預設", "Restore default", "既定値に戻す", "기본값 복원")}</span><strong>{REALITY_OUTPUT_TOKENS_DEFAULT}</strong></button>}
    </div>
  );
}
