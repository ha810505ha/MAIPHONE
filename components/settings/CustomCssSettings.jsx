import React from "react";

export default function CustomCssSettings({
  tr,
  enabled,
  setEnabled,
  draft,
  setDraft,
  notice,
  setNotice,
  sanitize,
  onApply,
  onReset,
  onOpenGuide,
}) {
  return (
    <div className="mp-sg" style={{ padding: 12, margin: "10px 0", order: 3 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div className="mp-sg-t" style={{ marginBottom: 2 }}>{tr("自訂 CSS", "Custom CSS", "カスタム CSS", "사용자 CSS")}</div>
          <div style={{ fontSize: 10, color: "var(--mp-txt-l)", lineHeight: 1.5 }}>{tr("只套用於手機介面，最多 30,000 字", "Applied only inside the phone, up to 30,000 characters", "スマホ画面内のみに適用・最大30,000文字", "휴대폰 화면에만 적용・최대 30,000자")}</div>
        </div>
        <button type="button" role="switch" aria-checked={enabled} className={`mp-switch ${enabled ? "active" : ""}`} onClick={() => setEnabled((value) => !value)}><span /></button>
      </div>
      <textarea
        value={draft}
        maxLength={30000}
        spellCheck={false}
        placeholder={"例如：\n.mp-dock { border-radius: 28px; }\n.mp-icon-c { box-shadow: 0 4px 12px #f3a8bd66; }"}
        onChange={(event) => { setDraft(event.target.value); setNotice(""); }}
        style={{ width: "100%", height: 150, boxSizing: "border-box", resize: "vertical", marginTop: 10, padding: 10, border: "1px solid var(--mp-border)", borderRadius: 12, background: "rgba(255,255,255,.72)", color: "var(--mp-txt)", font: "11px/1.55 ui-monospace,monospace" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--mp-txt-l)", marginTop: 4 }}><span>{notice}</span><span>{draft.length.toLocaleString()} / 30,000</span></div>
      <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
        <button className="mp-ibtn" onClick={onOpenGuide}>{tr("選擇器清單", "Selector guide", "セレクター一覧", "선택자 목록")}</button>
        <button className="mp-ibtn-r" onClick={onReset}>{tr("重設", "Reset", "リセット", "초기화")}</button>
        <button className="mp-save" style={{ flex: 1, padding: 8 }} onClick={() => onApply(sanitize(draft))}>{tr("儲存並套用", "Save and apply", "保存して適用", "저장 및 적용")}</button>
      </div>
      <div style={{ fontSize: 9, color: "var(--mp-txt-l)", lineHeight: 1.5, marginTop: 8 }}>{tr("安全限制：會移除 @import、外部網址、expression 與 javascript。若畫面異常，可重新進入設定關閉此功能。", "Safety: imports, external URLs, expression, and javascript are removed. Disable this option if the layout breaks.", "安全のため外部読込などを削除します。表示が崩れた場合は無効にしてください。", "안전을 위해 외부 불러오기 등을 제거합니다. 화면 이상 시 기능을 꺼주세요.")}</div>
    </div>
  );
}
