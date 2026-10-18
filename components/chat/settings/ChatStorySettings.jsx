import React, { useEffect, useState } from "react";
import Icon from "../../common/Icon";

export default function ChatStorySettings({ route, onUpdate, tr, showNote = true, showQuickActions = true }) {
  const [note, setNote] = useState(route?.storyNote || "");
  // 名稱與內容填完後，在卡片內選「直接送出／先填入輸入框／取消」；取消時真的不儲存。
  const [pendingAction, setPendingAction] = useState(null);
  useEffect(() => { setNote(route?.storyNote || ""); }, [route?.id, route?.storyNote]);
  useEffect(() => { setPendingAction(null); }, [route?.id]);
  const actions = Array.isArray(route?.quickActions) ? route.quickActions : [];
  const quickActionsEnabled = route?.quickActionsEnabled !== false;
  const updateActions = (next) => onUpdate?.({ quickActions: next.slice(0, 8) });
  const askLabelAndPrompt = (action = {}) => {
    const label = window.prompt(tr("快捷名稱", "Shortcut name", "ショートカット名", "바로가기 이름"), action.label || "");
    if (label === null || !label.trim()) return null;
    const prompt = window.prompt(tr("送出或填入的內容", "Text to send or fill", "送信・入力する内容", "보내거나 채울 내용"), action.prompt || "");
    if (prompt === null || !prompt.trim()) return null;
    return { label: label.trim().slice(0, 16), prompt: prompt.trim().slice(0, 500) };
  };
  const editAction = (action) => {
    const values = askLabelAndPrompt(action);
    if (values) setPendingAction({ mode: "edit", id: action.id, ...values });
  };
  const addAction = () => {
    const values = askLabelAndPrompt();
    if (values) setPendingAction({ mode: "add", id: `quick_${Date.now()}`, ...values });
  };
  const commitPending = (behavior) => {
    if (!pendingAction) return;
    const { mode, id, label, prompt } = pendingAction;
    if (mode === "edit") updateActions(actions.map((item) => item.id === id ? { ...item, label: label || item.label, prompt, behavior } : item));
    else updateActions([...actions, { id, label, prompt, behavior }]);
    setPendingAction(null);
  };
  return <div className="mp-cc" style={{ marginTop: 10 }}>
    {showNote && <>
    <div style={{ fontSize: 13, fontWeight: 800 }}>{tr("劇情便條", "Story note", "ストーリーメモ", "스토리 메모")}</div>
    <p style={{ margin: "4px 0 8px", color: "var(--mp-txt-l)", fontSize: "var(--mp-fs-caption)", lineHeight: 1.45 }}>{tr("只影響目前這條路線；建立分支時會一併帶過去。", "Only affects this route. It is copied when you branch.", "このルートだけに適用され、分岐時に引き継がれます。", "현재 경로에만 적용되며 분기할 때 함께 복사됩니다.")}</p>
    <textarea className="mp-story-note-input" value={note} maxLength={900} placeholder={tr("例如：目前曖昧但尚未告白；回覆自然、帶一點嘴硬。", "Example: They are flirty but have not confessed; keep replies natural and a little guarded.", "例：曖昧だがまだ告白していない。自然で少し素直じゃない返答に。", "예: 썸을 타지만 아직 고백하지 않음. 자연스럽고 조금 새침하게.")} onChange={(event) => setNote(event.target.value)} />
    <div style={{ display: "flex", gap: 8, marginTop: 7 }}><button type="button" className="mp-ibtn" style={{ flex: 1 }} onClick={() => onUpdate?.({ storyNoteEnabled: route?.storyNoteEnabled === false })}>{route?.storyNoteEnabled === false ? tr("已停用", "Disabled", "無効", "사용 안 함") : tr("啟用中", "Enabled", "有効", "사용 중")}</button><button type="button" className="mp-save" style={{ flex: 1, margin: 0 }} onClick={() => onUpdate?.({ storyNote: note })}>{tr("儲存便條", "Save note", "メモを保存", "메모 저장")}</button></div>
    </>}
    {showQuickActions && <>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: showNote ? 16 : 0 }}><div style={{ minWidth: 0 }}><b style={{ fontSize: 13 }}>{tr("劇情快捷抽屜", "Story shortcuts", "ストーリーショートカット", "스토리 바로가기")}</b><small style={{ display: "block", marginTop: 2, color: "var(--mp-txt-l)", fontSize: "var(--mp-fs-caption)" }}>{tr("從輸入框旁自由打開；設定只套用目前聊天室與分支。", "Open it beside the input. Settings apply only to this chat route.", "入力欄の横から開けます。設定は現在のルートだけに適用されます。", "입력창 옆에서 열 수 있으며 현재 채팅 경로에만 적용됩니다.")}</small></div><button type="button" role="switch" aria-checked={quickActionsEnabled} aria-label={tr("開啟劇情快捷抽屜", "Enable story shortcuts", "ストーリーショートカットを有効にする", "스토리 바로가기 켜기")} className={`mp-switch ${quickActionsEnabled ? "active" : ""}`} onClick={() => onUpdate?.({ quickActionsEnabled: !quickActionsEnabled })}><span /></button></div>
    {quickActionsEnabled && <>
      <div className="mp-story-quick-settings">{actions.map((action) => <div key={action.id}><span><b>{action.label}</b><small>{action.behavior === "send" ? tr("直接送出", "Send now", "即時送信", "바로 전송") : tr("填入輸入框", "Fill input", "入力欄に入れる", "입력창 채우기")}</small></span><button type="button" className="mp-ibtn" aria-label={tr("編輯快捷", "Edit shortcut", "ショートカットを編集", "바로가기 편집")} title={tr("編輯快捷", "Edit shortcut", "ショートカットを編集", "바로가기 편집")} onClick={() => editAction(action)}><Icon name="edit" size={16} /></button><button type="button" className="mp-ibtn-r" aria-label={tr("刪除快捷", "Delete shortcut", "ショートカットを削除", "바로가기 삭제")} title={tr("刪除快捷", "Delete shortcut", "ショートカットを削除", "바로가기 삭제")} onClick={() => updateActions(actions.filter((item) => item.id !== action.id))}><Icon name="close" size={16} /></button></div>)}</div>
      {pendingAction && <div className="mp-story-quick-choice" role="group" aria-label={tr("點這個快捷時要怎麼做？", "What should this shortcut do?", "このショートカットを押したときの動作", "이 바로가기를 누르면 어떻게 할까요?")} style={{ marginTop: 8, padding: 10, borderRadius: "var(--mp-rx)", border: "1px solid var(--mp-card-border)", display: "grid", gap: 7 }}>
        <div style={{ fontSize: 12, fontWeight: 800 }}>{tr(`「${pendingAction.label}」點下去時要怎麼做？`, `What should “${pendingAction.label}” do when tapped?`, `「${pendingAction.label}」を押したときの動作`, `'${pendingAction.label}'을(를) 누르면 어떻게 할까요?`)}</div>
        <div style={{ display: "flex", gap: 7 }}>
          <button type="button" className="mp-save" style={{ flex: 1, margin: 0 }} onClick={() => commitPending("send")}>{tr("直接送出", "Send now", "すぐ送信", "바로 전송")}</button>
          <button type="button" className="mp-save mp-save--secondary" style={{ flex: 1, margin: 0 }} onClick={() => commitPending("fill")}>{tr("先填入輸入框", "Fill the input first", "入力欄に入れる", "입력창에 먼저 채우기")}</button>
        </div>
        <button type="button" className="mp-save mp-save--ghost" style={{ margin: 0 }} onClick={() => setPendingAction(null)}>{tr("取消，不儲存", "Cancel without saving", "保存せずにキャンセル", "저장하지 않고 취소")}</button>
      </div>}
      <button type="button" className="mp-ibtn" style={{ width: "100%", marginTop: 8 }} disabled={actions.length >= 8 || Boolean(pendingAction)} onClick={addAction}>＋ {tr("新增快捷", "Add shortcut", "ショートカットを追加", "바로가기 추가")}</button>
    </>}
    </>}
  </div>;
}
