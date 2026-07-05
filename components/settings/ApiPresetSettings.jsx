import React from "react";

export default function ApiPresetSettings({ tr, activePresetIndex, config, onApplyPreset }) {
  return <div className="mp-sg">
    <div className="mp-sg-t">{tr("API 預設", "API presets", "API プリセット", "API 프리셋")}</div>
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      {[0, 1, 2].map((index) => <button key={index} className="mp-ibtn" style={{ minWidth: 44, padding: "4px 8px" }} onClick={() => onApplyPreset(index)}>{`P${index + 1}`}</button>)}
    </div>
    <div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginTop: 6 }}>
      {activePresetIndex >= 0
        ? `${tr("目前預設", "Current preset", "現在のプリセット", "현재 프리셋")}：P${activePresetIndex + 1} · ${config.provider || "-"} · ${config.model || "-"}`
        : `${tr("目前預設", "Current preset", "現在のプリセット", "현재 프리셋")}：${tr("自訂", "Custom", "カスタム", "사용자 지정")} · ${config.provider || "-"} · ${config.model || "-"}`}
    </div>
  </div>;
}
