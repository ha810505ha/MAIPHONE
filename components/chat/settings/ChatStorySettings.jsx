import React, { useEffect, useState } from "react";

export default function ChatStorySettings({ route, onUpdate, tr, showNote = true, showQuickActions = true }) {
  const [note, setNote] = useState(route?.storyNote || "");
  useEffect(() => { setNote(route?.storyNote || ""); }, [route?.id, route?.storyNote]);
  const actions = Array.isArray(route?.quickActions) ? route.quickActions : [];
  const quickActionsEnabled = route?.quickActionsEnabled !== false;
  const updateActions = (next) => onUpdate?.({ quickActions: next.slice(0, 8) });
  const editAction = (action) => {
    const label = window.prompt(tr("快捷名稱", "Shortcut name", "ショートカット名", "바로가기 이름"), action.label || "");
    if (label === null) return;
    const prompt = window.prompt(tr("送出或填入的內容", "Text to send or fill", "送信・入力する内容", "보내거나 채울 내용"), action.prompt || "");
    if (prompt === null) return;
    const direct = window.confirm(tr("確定後要直接送出嗎？選『取消』則先填入輸入框。", "Send immediately after tapping? Choose Cancel to fill the input first.", "すぐ送信しますか？キャンセルで入力欄に入れます。", "누르면 바로 보낼까요? 취소하면 입력창에 채웁니다."));
    updateActions(actions.map((item) => item.id === action.id ? { ...item, label: label.trim().slice(0, 16) || item.label, prompt: prompt.trim().slice(0, 500), behavior: direct ? "send" : "fill" } : item));
  };
  const addAction = () => {
    const label = window.prompt(tr("快捷名稱", "Shortcut name", "ショートカット名", "바로가기 이름"));
    if (!label?.trim()) return;
    const prompt = window.prompt(tr("送出或填入的內容", "Text to send or fill", "送信・入力する内容", "보내거나 채울内容"));
    if (!prompt?.trim()) return;
    updateActions([...actions, { id: `quick_${Date.now()}`, label: label.trim().slice(0, 16), prompt: prompt.trim().slice(0, 500), behavior: "fill" }]);
  };
  return <div className="mp-cc" style={{ marginTop: 10 }}>
    {showNote && <>
    <div style={{ fontSize: 13, fontWeight: 800 }}>{tr("劇情便條", "Story note", "ストーリーメモ", "스토리 메모")}</div>
    <p style={{ margin: "4px 0 8px", color: "var(--mp-txt-l)", fontSize: 11, lineHeight: 1.45 }}>{tr("只影響目前這條路線；建立分支時會一併帶過去。", "Only affects this route. It is copied when you branch.", "このルートだけに適用され、分岐時に引き継がれます。", "현재 경로에만 적용되며 분기할 때 함께 복사됩니다。")}</p>
    <textarea className="mp-story-note-input" value={note} maxLength={900} placeholder={tr("例如：目前曖昧但尚未告白；回覆自然、帶一點嘴硬。", "Example: They are flirty but have not confessed; keep replies natural and a little guarded.", "例：曖昧だがまだ告白していない。自然で少し素直じゃない返答に。", "예: 썸을 타지만 아직 고백하지 않음. 자연스럽고 조금 새침하게.")} onChange={(event) => setNote(event.target.value)} />
    <div style={{ display: "flex", gap: 8, marginTop: 7 }}><button type="button" className="mp-ibtn" style={{ flex: 1 }} onClick={() => onUpdate?.({ storyNoteEnabled: route?.storyNoteEnabled === false })}>{route?.storyNoteEnabled === false ? tr("已停用", "Disabled", "無効", "사용 안 함") : tr("啟用中", "Enabled", "有効", "사용 중")}</button><button type="button" className="mp-save" style={{ flex: 1, margin: 0 }} onClick={() => onUpdate?.({ storyNote: note })}>{tr("儲存便條", "Save note", "メモを保存", "메모 저장")}</button></div>
    </>}
    {showQuickActions && <>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: showNote ? 16 : 0 }}><div style={{ minWidth: 0 }}><b style={{ fontSize: 13 }}>{tr("劇情快捷抽屜", "Story shortcuts", "ストーリーショートカット", "스토리 바로가기")}</b><small style={{ display: "block", marginTop: 2, color: "var(--mp-txt-l)", fontSize: 10 }}>{tr("從輸入框旁自由打開；設定只套用目前聊天室與分支。", "Open it beside the input. Settings apply only to this chat route.", "入力欄の横から開けます。設定は現在のルートだけに適用されます。", "입력창 옆에서 열 수 있으며 현재 채팅 경로에만 적용됩니다.")}</small></div><button type="button" role="switch" aria-checked={quickActionsEnabled} aria-label={tr("開啟劇情快捷抽屜", "Enable story shortcuts", "ストーリーショートカットを有効にする", "스토리 바로가기 켜기")} className={`mp-switch ${quickActionsEnabled ? "active" : ""}`} onClick={() => onUpdate?.({ quickActionsEnabled: !quickActionsEnabled })}><span /></button></div>
    {quickActionsEnabled && <>
      <div className="mp-story-quick-settings">{actions.map((action) => <div key={action.id}><span><b>{action.label}</b><small>{action.behavior === "send" ? tr("直接送出", "Send now", "即時送信", "바로 전송") : tr("填入輸入框", "Fill input", "入力欄に入れる", "입력창 채우기")}</small></span><button type="button" className="mp-ibtn" onClick={() => editAction(action)}>✎</button><button type="button" className="mp-ibtn-r" onClick={() => updateActions(actions.filter((item) => item.id !== action.id))}>×</button></div>)}</div>
      <button type="button" className="mp-ibtn" style={{ width: "100%", marginTop: 8 }} disabled={actions.length >= 8} onClick={addAction}>＋ {tr("新增快捷", "Add shortcut", "ショートカットを追加", "바로가기 추가")}</button>
    </>}
    </>}
  </div>;
}
