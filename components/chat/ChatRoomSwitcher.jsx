import React, { useEffect, useMemo, useState } from "react";
import MotionPresence from "../motion/MotionPresence.jsx";
import ChatRoomManager from "./ChatRoomManager.jsx";

export default function ChatRoomSwitcher({ open, onClose, rooms, activeRoomId, roomBusy, onSwitchRoom, onCreateRoom, onCreateBranch, onRenameRoom, onDeleteRoom, onArchiveRoom, onRestoreRoom, onMoveRoom, onOpenSettings, tr }) {
  const hasRooms = Array.isArray(rooms) && rooms.length > 0;
  const roots = useMemo(() => (rooms || []).filter((room) => !room.parentRoomId && !room.archivedAt).sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)), [rooms]);
  const activeRoom = (rooms || []).find((room) => room.id === activeRoomId);
  const [expandedRootIds, setExpandedRootIds] = useState(() => new Set());
  const [managerOpen, setManagerOpen] = useState(false);
  const [managerTab, setManagerTab] = useState("active");
  const canDelete = Boolean(activeRoom?.parentRoomId) || roots.length > 1;
  const formatUpdatedAt = (value) => {
    const time = Number(value) || 0;
    if (!time) return "";
    const date = new Date(time);
    return `${date.toLocaleDateString(undefined, { month: "numeric", day: "numeric" })} ${date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
  };
  const childrenByParent = useMemo(() => (rooms || []).reduce((result, room) => {
    if (!room?.parentRoomId) return result;
    const children = result.get(room.parentRoomId) || [];
    children.push(room);
    result.set(room.parentRoomId, children);
    return result;
  }, new Map()), [rooms]);
  const childrenOf = (roomId) => childrenByParent.get(roomId) || [];
  const rootFor = (roomId) => {
    const visited = new Set();
    let room = (rooms || []).find((item) => item.id === roomId) || null;
    while (room?.parentRoomId && !visited.has(room.id)) {
      visited.add(room.id);
      room = (rooms || []).find((item) => item.id === room.parentRoomId) || null;
    }
    return room?.id || roomId;
  };
  useEffect(() => {
    if (!open) setManagerOpen(false);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const activeRootId = rootFor(activeRoomId);
    setExpandedRootIds((previous) => {
      const next = new Set(previous);
      let changed = false;
      roots.forEach((room) => {
        if (childrenOf(room.id).length && !next.has(room.id)) {
          next.add(room.id);
          changed = true;
        }
      });
      if (activeRootId && !next.has(activeRootId)) {
        next.add(activeRootId);
        changed = true;
      }
      return changed ? next : previous;
    });
  }, [open, activeRoomId, roots, childrenByParent]);
  const toggleRoot = (roomId) => setExpandedRootIds((previous) => {
    const next = new Set(previous);
    if (next.has(roomId)) next.delete(roomId);
    else next.add(roomId);
    return next;
  });
  const renderRoom = (room, depth = 0, branchIndex = 0) => {
    const active = room.id === activeRoomId;
    const updatedAt = formatUpdatedAt(room.updatedAt);
    const children = childrenOf(room.id);
    const isRoot = depth === 0;
    const isExpanded = expandedRootIds.has(room.id);
    const autoBranchTitle = /^(?:分支|branch|分岐|분기)(?:\s*\d+)?(?:\s*·|$)/i.test(String(room.title || ""));
    const branchLabel = tr(`${branchIndex + 1} 分支`, `Branch ${branchIndex + 1}`, `分岐 ${branchIndex + 1}`, `분기 ${branchIndex + 1}`);
    const roomTitle = isRoot
      ? (room.title || tr("未命名對話", "Untitled chat", "無題のチャット", "이름 없는 채팅"))
      : branchLabel;
    const branchName = !isRoot && room.title && !autoBranchTitle ? room.title : "";
    return (
      <React.Fragment key={room.id}>
        <div style={{ display: "flex", alignItems: "stretch", gap: 5 }}>
          {isRoot && children.length > 0 && <button type="button" onClick={(event) => { event.stopPropagation(); toggleRoot(room.id); }} aria-label={isExpanded ? tr("收合分支", "Collapse branches", "分岐を閉じる", "분기 접기") : tr("展開分支", "Expand branches", "分岐を開く", "분기 펼치기")} title={isExpanded ? tr("收合分支", "Collapse branches", "分岐を閉じる", "분기 접기") : tr("展開分支", "Expand branches", "分岐を開く", "분기 펼치기")} style={{ flex: "0 0 28px", border: 0, borderRadius: 10, background: "color-mix(in srgb,var(--mp-txt-l) 10%,transparent)", color: "var(--mp-txt-l)", fontSize: 13, fontWeight: 900, cursor: "pointer" }}>{isExpanded ? "⌄" : "›"}</button>}
          <button type="button" onClick={() => { onSwitchRoom?.(room.id); onClose?.(); }} style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, width: "100%", border: active ? "1px solid var(--mp-pink)" : "1px solid color-mix(in srgb,var(--mp-txt-l) 18%,transparent)", borderRadius: 14, padding: `10px 12px 10px ${12 + depth * 16}px`, background: active ? "color-mix(in srgb,var(--mp-pink) 10%,var(--mp-surface))" : "color-mix(in srgb,var(--mp-surface) 92%,var(--mp-txt) 8%)", color: "var(--mp-txt)", textAlign: "left" }}>
          <span style={{ width: 16, color: active ? "var(--mp-pink-dk)" : "var(--mp-txt-l)", fontWeight: 900 }}>{active ? "✓" : depth ? "↳" : "●"}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <b style={{ display: "block", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{roomTitle}</b>
            <small style={{ display: "block", marginTop: 3, color: "var(--mp-txt-l)", fontSize: 9 }}>{branchName ? `${branchName} · ` : ""}{room.parentRoomId ? tr("分支", "Branch", "分岐", "분기") : tr("完整對話", "Full chat", "会話", "전체 대화")} · {(room.messages || []).length} {tr("則訊息", "messages", "件のメッセージ", "개의 메시지")}{updatedAt ? ` · ${updatedAt}` : ""}</small>
          </span>
          </button>
        </div>
        {(!isRoot || isExpanded) && children.map((child, index) => renderRoom(child, depth + 1, index))}
      </React.Fragment>
    );
  };

  return (
    <MotionPresence show={open && hasRooms}>
      {open && hasRooms && (
        <div className="mp-overlay" style={{ zIndex: 90, alignItems: "flex-end", padding: 0 }} onClick={onClose}>
          <div className="mp-sheet" style={{ width: "100%", maxHeight: "72vh", overflowY: "auto", background: "var(--mp-surface)", borderRadius: "22px 22px 0 0", padding: "10px 14px 18px", boxShadow: "0 -12px 36px rgba(0,0,0,.2)" }} onClick={(event) => event.stopPropagation()}>
            <div style={{ width: 38, height: 4, borderRadius: 99, background: "color-mix(in srgb,var(--mp-txt-l) 35%,transparent)", margin: "0 auto 12px" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: "var(--mp-txt)" }}>{tr("切換對話與分支", "Chats & branches", "会話と分岐", "채팅과 분기")}</div>
              <button type="button" className="mp-ibtn" onClick={onClose}>×</button>
            </div>
            <div style={{ display: "grid", gap: 7 }}>{roots.map((room) => renderRoom(room))}</div>
            <button type="button" className="mp-save" style={{ marginTop: 12 }} onClick={() => { onCreateRoom?.(); onClose?.(); }}>＋ {tr("完全新對話", "New standalone chat", "新しい独立チャット", "새 독립 채팅")}</button>
            <button type="button" className="mp-ibtn" style={{ width: "100%", marginTop: 8 }} onClick={() => { onCreateBranch?.(); onClose?.(); }}>⌁ {tr("從目前進度開分支", "Branch from here", "ここから分岐", "여기서 분기")}</button>
            <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
              <button type="button" className="mp-ibtn" style={{ flex: 1 }} onClick={() => { onRenameRoom?.(); onClose?.(); }}>✎ {tr("改名稱", "Rename", "名前を変更", "이름 변경")}</button>
              <button type="button" className="mp-ibtn-r" style={{ flex: 1 }} disabled={!canDelete} onClick={() => { onDeleteRoom?.(); onClose?.(); }}>⌫ {tr("刪除目前路線", "Delete current", "現在のルートを削除", "현재 경로 삭제")}</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginTop: 8 }}>
              <button type="button" className="mp-ibtn" onClick={() => { setManagerTab("active"); setManagerOpen(true); }}>⇅ {tr("對話整理", "Organize", "チャット整理", "채팅 정리")}</button>
              <button type="button" className="mp-ibtn" onClick={() => { setManagerTab("archive"); setManagerOpen(true); }}>◇ {tr("時光抽屜", "Time Drawer", "時の引き出し", "시간 서랍")}</button>
            </div>
            <button type="button" style={{ width: "100%", border: 0, background: "transparent", color: "var(--mp-txt-l)", padding: "12px 4px 2px", fontSize: 11, fontWeight: 700 }} onClick={() => { onClose?.(); onOpenSettings?.(); }}>{tr("聊天室設定", "Chat settings", "チャット設定", "채팅 설정")}</button>
          </div>
        </div>
      )}
      <ChatRoomManager
        open={managerOpen}
        initialTab={managerTab}
        onClose={() => setManagerOpen(false)}
        rooms={rooms}
        activeRoomId={activeRoomId}
        busy={roomBusy}
        onSwitchRoom={onSwitchRoom}
        onRenameRoom={onRenameRoom}
        onDeleteRoom={onDeleteRoom}
        onArchiveRoom={onArchiveRoom}
        onRestoreRoom={(roomId) => {
          const result = onRestoreRoom?.(roomId);
          if (result?.ok) onClose?.();
          return result;
        }}
        onMoveRoom={onMoveRoom}
        tr={tr}
      />
    </MotionPresence>
  );
}
