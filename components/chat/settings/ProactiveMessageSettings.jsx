import React from "react";

const OPTIONS = [
  ["off", "關閉", "0 次"],
  ["occasional", "偶爾", "1～3 次"],
  ["normal", "一般", "3～6 次"],
  ["active", "活躍", "6～10 次"],
  ["always", "常駐", "10～15 次"],
];

export default function ProactiveMessageSettings({ enabled, frequency, onToggle, onFrequencyChange, tr }) {
  const legacy = { low: "occasional", high: "active" };
  const current = legacy[frequency] || frequency || "normal";
  const index = Math.max(0, OPTIONS.findIndex(([value]) => value === current));
  const selected = OPTIONS[index] || OPTIONS[2];
  return <div className="mp-cc">
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{tr("角色自動回覆", "Proactive messages", "自動メッセージ", "자동 메시지")}</div>
        <div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginTop: 3, lineHeight: 1.5 }}>{tr("角色可能會主動傳訊息給你。", "The character may message you first.", "キャラクターから先にメッセージが届くことがあります。", "캐릭터가 먼저 메시지를 보낼 수 있습니다.")}</div>
      </div>
      <button type="button" role="switch" aria-checked={enabled} className={`mp-switch ${enabled ? "active" : ""}`} onClick={onToggle}><span /></button>
    </div>
    {enabled && <div style={{ marginTop: 12 }}>
      <input aria-label="自動回覆頻率" type="range" min="0" max="4" step="1" value={index} onChange={(e) => onFrequencyChange(OPTIONS[Number(e.target.value)]?.[0] || "normal")} style={{ width: "100%", accentColor: "var(--mp-pink-dk)" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--mp-txt-l)" }}>{OPTIONS.map(([value, label]) => <span key={value} style={{ color: value === current ? "var(--mp-pink-dk)" : undefined, fontWeight: value === current ? 700 : 400 }}>{label}</span>)}</div>
      <div style={{ textAlign: "center", marginTop: 8, fontSize: 12, fontWeight: 700 }}>{selected[1]}：每天最多 {selected[2]}</div>
      <div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginTop: 5, lineHeight: 1.5 }}>{tr("兩則自動訊息通常至少間隔 30～60 分鐘；角色自動回覆仍會消耗 AI Token。", "Automatic messages usually have a 30–60 minute cooldown; they still consume AI tokens.", "自動メッセージは通常30～60分の間隔があり、AIトークンを消費します。", "자동 메시지는 보통 30~60분 간격이며 AI 토큰을 사용합니다.")}</div>
    </div>}
  </div>;
}
