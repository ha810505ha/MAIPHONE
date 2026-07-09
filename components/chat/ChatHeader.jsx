import React from "react";

export default function ChatHeader({ item, modelShort, modelFull, modelBadgeOpen, setModelBadgeOpen, onBack, onTogglePinned, onOpenSettings, tr }) {
  return (
    <>
      <div className="mp-hdr">
        <div className="mp-back" onClick={onBack}>←</div>
        <button type="button" className={`mp-chat-pin ${item.pinned ? "active" : ""}`} onClick={(event) => { event.stopPropagation(); event.preventDefault(); onTogglePinned(); }} title={item.pinned ? tr("取消釘選", "Unpin", "固定を解除", "고정 해제") : tr("釘選聊天室", "Pin chatroom", "チャットルームを固定", "채팅방 고정")}>
          {item.pinned ? "♥" : "♡"}
        </button>
        <div className="mp-htitle" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
        <button type="button" className="mp-ibtn" style={{ marginLeft: "auto" }} title={modelFull} onClick={(event) => { event.stopPropagation(); setModelBadgeOpen((value) => !value); }}>{modelShort}</button>
        <button type="button" className="mp-ibtn" onClick={onOpenSettings}>{tr("設定", "Settings", "設定", "설정")}</button>
      </div>
      {modelBadgeOpen && (
        <div style={{ position: "absolute", top: 56, right: 74, zIndex: 40, background: "#fff", border: "1px solid rgba(244,143,177,.35)", borderRadius: 12, padding: "8px 10px", boxShadow: "0 8px 24px rgba(0,0,0,.12)", maxWidth: 220 }} onClick={(event) => event.stopPropagation()}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#666", marginBottom: 2 }}>{tr("目前模型", "Current model", "現在のモデル", "현재 모델")}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#222" }}>{modelFull}</div>
        </div>
      )}
    </>
  );
}
