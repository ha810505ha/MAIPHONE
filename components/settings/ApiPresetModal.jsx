import React from "react";

export default function ApiPresetModal({ tr, t, onClose, onSave }) {
  return <div className="mp-overlay" style={{ zIndex: 120 }} onClick={onClose}>
    <div className="mp-modal" onClick={(event) => event.stopPropagation()}>
      <div className="mp-modal-t">{tr("儲存 API 預設", "Save API preset", "API プリセットを保存", "API 프리셋 저장")}</div>
      <div style={{ display: "grid", gap: 8 }}>
        {[0, 1, 2].map((index) => <button type="button" key={index} className="mp-ibtn-chat" onClick={() => {
          const accepted = window.confirm(tr(`確定要覆寫 P${index + 1} 嗎？`, `Overwrite P${index + 1}?`, `P${index + 1} を上書きしますか？`, `P${index + 1}을(를) 덮어쓸까요?`));
          if (accepted) onSave(index);
        }}>{tr(`儲存至 P${index + 1}`, `Save to P${index + 1}`, `P${index + 1} に保存`, `P${index + 1}에 저장`)}</button>)}
      </div>
      <div style={{ marginTop: 10 }}><button type="button" className="mp-save" style={{ background: "linear-gradient(135deg,#b0bec5,#90a4ae)" }} onClick={onClose}>{t("cancel")}</button></div>
    </div>
  </div>;
}
