import React from "react";

export default function ChatRealTimeSettings({ enabled, onToggle, tr }) {
  return (
    <div className="mp-cc">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{tr("讀取現實時間", "Use real-world time", "現実時間を参照", "현실 시간 사용")}</div>
          <div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginTop: 3, lineHeight: 1.5 }}>
            {tr(
              "開啟時，角色會知道目前日期與時間；關閉後，AI 只依照對話與場景推進，適合長篇劇情或時間凍結的 RP。",
              "When on, characters know the current date and time. Turn it off for long-running stories or frozen-time roleplay.",
              "オンにするとキャラは現在の日付と時刻を把握します。長編シナリオや時間を固定したRPではオフがおすすめです。",
              "켜면 캐릭터가 현재 날짜와 시간을 인식합니다. 장기 스토리나 시간이 고정된 RP에는 끄는 것을 추천합니다."
            )}
          </div>
        </div>
        <button type="button" role="switch" aria-checked={enabled} className={`mp-switch ${enabled ? "active" : ""}`} onClick={onToggle}><span /></button>
      </div>
    </div>
  );
}
