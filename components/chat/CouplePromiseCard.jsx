import React, { useEffect, useState } from "react";

// 聊天中角色說好的約定：只顯示提示，玩家按了才收進情侶空間的約定清單。
// 同一則訊息也帶有日曆提案時，合併成一張卡，可以順便加入日曆。
export default function CouplePromiseCard({ message, proposal, calendarProposal, onAdd, onDismiss, tr }) {
  const [text, setText] = useState(proposal?.text || "");
  const [alsoCalendar, setAlsoCalendar] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setText(proposal?.text || ""); }, [proposal?.text]);

  if (!proposal || proposal.status === "dismissed") return null;
  if (proposal.status === "added") {
    return (
      <div className="mp-calendar-proposal mp-calendar-proposal-added mp-couple-promise">
        <span>✓</span>
        <div><b>{tr("已收進約定", "Saved to promises", "約束に追加済み", "약속에 저장됨")}</b><small>{proposal.text}{proposal.date ? ` · ${proposal.date}` : ""}</small></div>
      </div>
    );
  }
  const canCalendar = !!calendarProposal && calendarProposal.status === "pending";
  return (
    <div className="mp-calendar-proposal mp-couple-promise">
      <div className="mp-calendar-proposal-heading">
        <span className="mp-calendar-proposal-icon">📌</span>
        <div>
          <b>{tr("要收進約定嗎？", "Save this as a promise?", "約束に追加しますか？", "약속으로 저장할까요?")}</b>
          <small>{tr("會放進情侶空間的約定清單，完成後可以打勾", "It goes to your Couple Space promise list. Check it off when it's done.", "カップルスペースの約束リストに入り、終わったらチェックできます", "커플 공간 약속 목록에 들어가며, 끝나면 체크할 수 있어요")}</small>
        </div>
      </div>
      <input className="mp-calendar-proposal-title" value={text} maxLength={60} onChange={(event) => setText(event.target.value)} aria-label={tr("約定內容", "Promise", "約束の内容", "약속 내용")} />
      {proposal.date && <div className="mp-calendar-proposal-hint">📅 {proposal.date}</div>}
      {canCalendar && (
        <label className="mp-couple-promise-calendar">
          <input type="checkbox" checked={alsoCalendar} onChange={(event) => setAlsoCalendar(event.target.checked)} />
          {tr(`同時加入日曆（${calendarProposal.date}${calendarProposal.time ? ` ${calendarProposal.time}` : ""}）`, `Also add to calendar (${calendarProposal.date}${calendarProposal.time ? ` ${calendarProposal.time}` : ""})`, `カレンダーにも追加（${calendarProposal.date}${calendarProposal.time ? ` ${calendarProposal.time}` : ""}）`, `캘린더에도 추가 (${calendarProposal.date}${calendarProposal.time ? ` ${calendarProposal.time}` : ""})`)}
        </label>
      )}
      <div className="mp-calendar-proposal-actions">
        <button type="button" onClick={() => onDismiss?.(message, { calendar: canCalendar })}>{tr("略過", "Skip", "スキップ", "건너뛰기")}</button>
        <button
          type="button"
          className="primary"
          disabled={!text.trim() || saving}
          onClick={async () => {
            setSaving(true);
            try { await onAdd?.(message, { ...proposal, text: text.trim() }, { calendar: canCalendar && alsoCalendar }); }
            finally { setSaving(false); }
          }}
        >
          {saving ? "…" : tr("收進約定", "Save promise", "約束に追加", "약속 저장")}
        </button>
      </div>
    </div>
  );
}
