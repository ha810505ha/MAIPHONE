import React, { useEffect, useMemo, useRef, useState } from "react";

const FIELDS = [
  ["relationship", "當前關係", "例如：曖昧中、冷戰、剛交往"],
  ["scene", "場景", "例如：雨夜的咖啡廳"],
  ["mood", "情緒", "例如：嘴硬、心動"],
  ["current", "進行中", "例如：等待電影邀約的回覆"],
  ["thread", "未解伏筆", "例如：那封還沒公開的信"],
  ["playerNote", "玩家備註", "例如：他不能知道我看過信"],
];

export default function ChatStoryStatus({ storyStatus, onUpdate, memoryAction, tr }) {
  const status = storyStatus && typeof storyStatus === "object" ? storyStatus : {};
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(status);
  const summaryScrollRef = useRef(null);
  const summaryDragRef = useRef({ active: false, moved: false, startX: 0, scrollLeft: 0 });
  useEffect(() => { setDraft(status); }, [storyStatus]);
  const summaryItems = useMemo(() => [
    { key: "relationship", label: tr("關係", "Relationship", "関係", "관계"), value: status.relationship },
    { key: "scene", label: tr("場景", "Scene", "場面", "장면"), value: status.scene },
    { key: "mood", label: tr("情緒", "Mood", "感情", "감정"), value: status.mood },
    { key: "current", label: tr("進行中", "Now", "進行中", "진행 중"), value: status.current },
    { key: "thread", label: tr("未解伏筆", "Open thread", "未解決", "미해결 복선"), value: status.thread },
    { key: "playerNote", label: tr("玩家備註", "Player note", "プレイヤーメモ", "플레이어 메모"), value: status.playerNote },
  ].map((item) => ({ ...item, value: item.value || tr("未設定", "Not set", "未設定", "미설정") })), [status.relationship, status.scene, status.mood, status.current, status.thread, status.playerNote, tr]);
  const save = () => {
    onUpdate?.({ ...draft, locked: status.locked || {} });
    setEditing(false);
  };
  const toggleLocked = (key) => onUpdate?.({ ...status, locked: { ...(status.locked || {}), [key]: !status?.locked?.[key] } });
  const startSummaryDrag = (event) => {
    const element = summaryScrollRef.current;
    if (!element || event.pointerType === "touch") return;
    summaryDragRef.current = { active: true, moved: false, startX: event.clientX, scrollLeft: element.scrollLeft };
    element.setPointerCapture?.(event.pointerId);
  };
  const moveSummaryDrag = (event) => {
    const element = summaryScrollRef.current;
    const drag = summaryDragRef.current;
    if (!element || !drag.active || event.pointerType === "touch") return;
    const distance = event.clientX - drag.startX;
    if (Math.abs(distance) > 4) drag.moved = true;
    if (drag.moved) element.scrollLeft = drag.scrollLeft - distance;
  };
  const endSummaryDrag = (event) => {
    if (event.pointerType === "touch") return;
    summaryDragRef.current.active = false;
    summaryScrollRef.current?.releasePointerCapture?.(event.pointerId);
  };
  const toggleOpen = () => {
    if (summaryDragRef.current.moved) {
      summaryDragRef.current.moved = false;
      return;
    }
    setOpen((value) => !value);
  };
  return (
    <section className={`mp-story-status ${open ? "is-open" : ""}`}>
      <div className="mp-story-status-summary">
        <button type="button" className="mp-story-status-toggle" onClick={toggleOpen} aria-expanded={open}>
          <span>✦ {tr("此刻", "Now", "いま", "지금")}</span>
        </button>
        <span ref={summaryScrollRef} className="mp-story-status-summary-scroll" onPointerDown={startSummaryDrag} onPointerMove={moveSummaryDrag} onPointerUp={endSummaryDrag} onPointerCancel={endSummaryDrag}>{summaryItems.map((item) => <span key={item.key} className={`mp-story-status-summary-chip ${status[item.key] ? "" : "is-empty"}`}><small>{item.label}</small><b>{item.value}</b></span>)}</span>
      </div>
      {open && <div className="mp-story-status-body">
        <p className="mp-story-status-scope">{tr("只影響目前聊天室與分支，不會修改角色設定中的基礎關係。", "Only affects this chat route and does not change the character's base relationship.", "現在のチャットルートだけに影響し、キャラクター設定の基本関係は変更しません。", "현재 채팅 경로에만 적용되며 캐릭터 설정의 기본 관계는 바뀌지 않습니다.")}</p>
        {!editing ? <>
          <div className="mp-story-status-grid">
            {FIELDS.map(([key, label]) => status[key] ? <div key={key}><small>{tr(label, label, label, label)}{status?.locked?.[key] ? " · 🔒" : ""}</small><span>{status[key]}</span></div> : null)}
          </div>
          <div className="mp-story-status-actions"><button type="button" className="mp-ibtn" style={{ flex: 1 }} onClick={() => setEditing(true)}>✎ {tr("編輯此刻", "Edit now", "編集", "편집")}</button>{memoryAction}</div>
        </> : <>
          <div className="mp-story-status-edit">
            {FIELDS.map(([key, label, placeholder]) => <label key={key}><span>{tr(label, label, label, label)}</span><div><input value={draft[key] || ""} placeholder={tr(placeholder, placeholder, placeholder, placeholder)} maxLength={240} onChange={(event) => setDraft((previous) => ({ ...previous, [key]: event.target.value }))} /><button type="button" onClick={() => toggleLocked(key)} title={tr("鎖定此欄位，不讓 AI 更新覆蓋", "Lock this field", "この項目を固定", "이 항목 잠금")}>{status?.locked?.[key] ? "🔒" : "🔓"}</button></div></label>)}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}><button type="button" className="mp-ibtn" style={{ flex: 1 }} onClick={() => { setDraft(status); setEditing(false); }}>{tr("取消", "Cancel", "キャンセル", "취소")}</button><button type="button" className="mp-save" style={{ flex: 1, margin: 0 }} onClick={save}>{tr("儲存", "Save", "保存", "저장")}</button></div>
        </>}
      </div>}
    </section>
  );
}
