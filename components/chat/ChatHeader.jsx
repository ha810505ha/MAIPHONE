import React, { useEffect, useState } from "react";
import ChatRoomSwitcher from "./ChatRoomSwitcher";
import MotionPresence from "../motion/MotionPresence.jsx";
import MaliTestQuotaBar from "./MaliTestQuotaBar";

export default function ChatHeader({ item, modelShort, modelFull, modelBadgeOpen, setModelBadgeOpen, onBack, onTogglePinned, onOpenSettings, rooms, activeRoomId, roomBusy, onSwitchRoom, onCreateRoom, onCreateBranch, onRenameRoom, onDeleteRoom, onArchiveRoom, onRestoreRoom, onMoveRoom, testQuotaEnabled, tr }) {
  const [roomPickerOpen, setRoomPickerOpen] = useState(false);
  const hasRooms = Array.isArray(rooms) && rooms.length > 0;
  const activeRoom = (rooms || []).find((room) => room.id === activeRoomId);
  useEffect(() => {
    setModelBadgeOpen(false);
    return () => setModelBadgeOpen(false);
  }, [item?.id, setModelBadgeOpen]);
  return (
    <>
      <div className="mp-hdr">
        <div className="mp-back" onClick={onBack}>‹</div>
        <button type="button" className={`mp-chat-pin ${item.pinned ? "active" : ""}`} onClick={(event) => { event.stopPropagation(); event.preventDefault(); onTogglePinned(); }} title={item.pinned ? tr("取消置頂", "Unpin", "固定を解除", "고정 해제") : tr("置頂聊天室", "Pin chatroom", "チャットを固定", "채팅 고정")}>
          {item.pinned ? "★" : "☆"}
        </button>
        {hasRooms ? <button type="button" className="mp-htitle" onClick={() => setRoomPickerOpen(true)} style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", border: 0, background: "transparent", color: "inherit", padding: 0, textAlign: "left", cursor: "pointer" }}>{item.name}{activeRoom?.title ? <span style={{ fontSize: 10, color: "var(--mp-txt-l)" }}> · {activeRoom.title}</span> : null} <span style={{ fontSize: 10, color: "var(--mp-txt-l)" }}>⌄</span></button> : <div className="mp-htitle" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>}
        <button type="button" className="mp-ibtn" style={{ marginLeft: "auto" }} title={modelFull} onClick={(event) => { event.stopPropagation(); setModelBadgeOpen((value) => !value); }}>{modelShort}</button>
        <button type="button" className="mp-ibtn" onClick={onOpenSettings}>{tr("設定", "Settings", "設定", "설정")}</button>
      </div>
      <ChatRoomSwitcher open={roomPickerOpen} onClose={() => setRoomPickerOpen(false)} rooms={rooms} activeRoomId={activeRoomId} roomBusy={roomBusy} onSwitchRoom={onSwitchRoom} onCreateRoom={onCreateRoom} onCreateBranch={onCreateBranch} onRenameRoom={onRenameRoom} onDeleteRoom={onDeleteRoom} onArchiveRoom={onArchiveRoom} onRestoreRoom={onRestoreRoom} onMoveRoom={onMoveRoom} onOpenSettings={onOpenSettings} tr={tr} />
      <MotionPresence show={modelBadgeOpen} exitMs={140}>
        {modelBadgeOpen && (
          <div className="mp-model-popover mp-popover" onClick={(event) => event.stopPropagation()}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--mp-txt-l)", marginBottom: 2 }}>{tr("目前模型", "Current model", "現在のモデル", "현재 모델")}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--mp-txt)" }}>{modelFull}</div>
            {testQuotaEnabled && <MaliTestQuotaBar enabled tr={tr} />}
          </div>
        )}
      </MotionPresence>
    </>
  );
}
