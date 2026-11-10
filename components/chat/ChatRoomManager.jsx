import React, { useEffect, useMemo, useRef, useState } from "react";
import MotionPresence from "../motion/MotionPresence.jsx";
import { OnlineChatMessage, RealityChatMessage } from "./DirectMessageTypes.jsx";

const byOrder = (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);

function getChildrenMap(rooms) {
  return rooms.reduce((map, room) => {
    if (!room?.parentRoomId) return map;
    const children = map.get(room.parentRoomId) || [];
    children.push(room);
    map.set(room.parentRoomId, children);
    return map;
  }, new Map());
}

function collectTree(root, childrenMap) {
  const result = [];
  const visit = (room) => {
    result.push(room);
    (childrenMap.get(room.id) || []).forEach(visit);
  };
  visit(root);
  return result;
}

function ReadonlyMessages({ room, tr }) {
  const messages = Array.isArray(room?.messages) ? room.messages : [];
  if (!messages.length) return <div className="mp-room-manager-empty">{tr("這個聊天室還沒有訊息", "This chat has no messages", "このチャットにはまだメッセージがありません", "이 채팅에는 아직 메시지가 없어요")}</div>;
  return <div className="mp-archive-messages">{messages.map((message) => {
    if (message.role === "mode_transition") return <div key={message.id} className="mp-mode-sep"><span>{message.toMode === "reality" ? tr("現實模式", "Reality", "現実モード", "현실 모드") : tr("線上聊天", "Online", "オンライン", "온라인")}</span></div>;
    if (message.role === "system_notice" || message.role === "transfer") return <div key={message.id} className="mp-msg-note-wrap"><div className="mp-msg-note">{message.content || tr("系統紀錄", "System record", "システム記録", "시스템 기록")}</div></div>;
    const isUser = message.role === "user";
    const displayContent = String(message.content || "");
    const innerThought = !isUser && message.innerThought?.content
      ? <div className="mp-thought-content">{message.innerThought.content}</div>
      : null;
    const shared = { message, tr, isUser, active: false, highlighted: false, displayContent, innerThought, voiceAction: null, onToggle: () => {}, onEdit: () => {} };
    return message.mode === "reality"
      ? <RealityChatMessage key={message.id} {...shared} renderedContent={<div style={{ whiteSpace: "pre-wrap" }}>{displayContent}</div>} />
      : <OnlineChatMessage key={message.id} {...shared} voicePlayback={null} />;
  })}</div>;
}

export default function ChatRoomManager({ open, initialTab = "active", onClose, rooms = [], activeRoomId, busy, onSwitchRoom, onRenameRoom, onDeleteRoom, onArchiveRoom, onRestoreRoom, onMoveRoom, tr }) {
  const [tab, setTab] = useState(initialTab);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [viewingArchiveId, setViewingArchiveId] = useState(null);
  const [viewingRoomId, setViewingRoomId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  const dragRef = useRef(null);
  const childrenMap = useMemo(() => getChildrenMap(rooms), [rooms]);
  const activeRoots = useMemo(() => rooms.filter((room) => !room.parentRoomId && !room.archivedAt).sort(byOrder), [rooms]);
  const archivedRoots = useMemo(() => rooms.filter((room) => !room.parentRoomId && room.archivedAt).sort((a, b) => Number(b.archivedAt) - Number(a.archivedAt)), [rooms]);
  const viewingRoot = archivedRoots.find((room) => room.id === viewingArchiveId) || null;
  const archiveTree = viewingRoot ? collectTree(viewingRoot, childrenMap) : [];
  const viewingRoom = archiveTree.find((room) => room.id === viewingRoomId) || viewingRoot;

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setViewingArchiveId(null);
    setViewingRoomId(null);
  }, [open, initialTab]);

  useEffect(() => {
    if (!viewingRoot) return;
    setViewingRoomId((current) => archiveTree.some((room) => room.id === current) ? current : viewingRoot.id);
  }, [viewingRoot?.id, rooms]);

  const toggleExpanded = (roomId) => setExpandedIds((previous) => {
    const next = new Set(previous);
    if (next.has(roomId)) next.delete(roomId);
    else next.add(roomId);
    return next;
  });
  const beginDrag = (event, roomId) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, roomId, startY: event.clientY };
    setDraggingId(roomId);
    setDragOffset(0);
  };
  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const offset = event.clientY - drag.startY;
    setDragOffset(Math.max(-34, Math.min(34, offset)));
    if (Math.abs(offset) < 38) return;
    const moved = onMoveRoom?.(drag.roomId, offset < 0 ? "up" : "down");
    if (moved?.ok) globalThis.navigator?.vibrate?.(8);
    drag.startY = event.clientY;
    setDragOffset(0);
  };
  const endDrag = () => {
    dragRef.current = null;
    setDraggingId(null);
    setDragOffset(0);
  };
  const openArchive = (root) => {
    setViewingArchiveId(root.id);
    setViewingRoomId(root.id);
  };
  const restoreAndOpen = () => {
    if (!viewingRoot) return;
    const result = onRestoreRoom?.(viewingRoot.id);
    if (result?.ok) {
      setViewingArchiveId(null);
      onClose?.();
    }
  };

  return <MotionPresence show={open} exitMs={160}>
    {open && <div className="mp-room-manager" role="dialog" aria-modal="true" aria-label={tr("對話整理", "Organize chats", "チャット整理", "채팅 정리")}>
      <header className="mp-room-manager-header">
        <button type="button" className="mp-room-manager-back" onClick={viewingRoot ? () => setViewingArchiveId(null) : onClose}>‹</button>
        <div><b>{viewingRoot ? viewingRoot.title : tab === "archive" ? tr("時光抽屜", "Time Drawer", "時の引き出し", "시간 서랍") : tr("對話整理", "Organize chats", "チャット整理", "채팅 정리")}</b>{viewingRoot && <small>{tr("僅供閱讀，不會更新狀態", "Read-only; status will not update", "閲覧専用・状態は更新されません", "읽기 전용 · 상태가 업데이트되지 않아요")}</small>}</div>
        <button type="button" className="mp-ibtn" onClick={onClose}>×</button>
      </header>

      {viewingRoot ? <>
        <div className="mp-archive-route-tabs">
          {archiveTree.map((room, index) => <button key={room.id} type="button" className={room.id === viewingRoom?.id ? "active" : ""} onClick={() => setViewingRoomId(room.id)}>{index === 0 ? tr("主聊天室", "Main chat", "メインチャット", "메인 채팅") : tr(`${index} 分支`, `Branch ${index}`, `分岐 ${index}`, `분기 ${index}`)}</button>)}
        </div>
        <div className="mp-archive-readonly-banner">◇ {tr("這段對話正安靜地收在時光抽屜裡", "This conversation is resting in the Time Drawer", "この会話は時の引き出しに保管されています", "이 대화는 시간 서랍에 조용히 보관되어 있어요")}</div>
        <ReadonlyMessages room={viewingRoom} tr={tr} />
        <div className="mp-room-manager-footer"><button type="button" className="mp-save" onClick={restoreAndOpen}>{tr("移回聊天室並打開", "Restore and open", "チャットに戻して開く", "채팅으로 복원하고 열기")}</button></div>
      </> : <>
        <div className="mp-room-manager-tabs">
          <button type="button" className={tab === "active" ? "active" : ""} onClick={() => setTab("active")}>{tr("對話整理", "Organize", "整理", "정리")}</button>
          <button type="button" className={tab === "archive" ? "active" : ""} onClick={() => setTab("archive")}>{tr("時光抽屜", "Time Drawer", "時の引き出し", "시간 서랍")} {archivedRoots.length ? `· ${archivedRoots.length}` : ""}</button>
        </div>
        <main className="mp-room-manager-body">
          {tab === "active" ? <>
            <p className="mp-room-manager-hint">{tr("拖曳把手或使用箭頭調整主聊天室順序；分支會一起移動。", "Drag the handle or use arrows to reorder main chats. Branches move with them.", "ハンドルまたは矢印で並べ替えできます。分岐も一緒に移動します。", "핸들이나 화살표로 순서를 바꿀 수 있어요. 분기도 함께 이동해요.")}</p>
            <div className="mp-room-organizer-list">{activeRoots.map((root, index) => {
              const branches = collectTree(root, childrenMap).slice(1);
              const expanded = expandedIds.has(root.id);
              return <div key={root.id} className={`mp-room-organizer-card ${root.id === activeRoomId ? "is-active" : ""} ${draggingId === root.id ? "is-dragging" : ""}`} style={draggingId === root.id ? { transform: `translateY(${dragOffset}px)` } : undefined}>
                <div className="mp-room-organizer-main">
                  <button type="button" className="mp-room-drag-handle" aria-label={tr("拖曳排序", "Drag to reorder", "ドラッグして並べ替え", "드래그하여 정렬")} onPointerDown={(event) => beginDrag(event, root.id)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>☷</button>
                  <button type="button" className="mp-room-organizer-open" onClick={() => { onSwitchRoom?.(root.id); onClose?.(); }}><b>{root.title}</b><small>{(root.messages || []).length} {tr("則訊息", "messages", "件", "개 메시지")} · {branches.length} {tr("個分支", "branches", "分岐", "개 분기")}</small></button>
                  {branches.length > 0 && <button type="button" className="mp-room-organizer-expand" onClick={() => toggleExpanded(root.id)}>{expanded ? "⌄" : "›"}</button>}
                </div>
                {expanded && branches.length > 0 && <div className="mp-room-organizer-branches">{branches.map((branch, branchIndex) => <button key={branch.id} type="button" onClick={() => { onSwitchRoom?.(branch.id); onClose?.(); }}>↳ {tr(`${branchIndex + 1} 分支`, `Branch ${branchIndex + 1}`, `分岐 ${branchIndex + 1}`, `분기 ${branchIndex + 1}`)}<small>{branch.title}</small></button>)}</div>}
                <div className="mp-room-organizer-actions">
                  <button type="button" disabled={index === 0} onClick={() => onMoveRoom?.(root.id, "up")}>↑ {tr("上移", "Up", "上へ", "위로")}</button>
                  <button type="button" disabled={index === activeRoots.length - 1} onClick={() => onMoveRoom?.(root.id, "down")}>↓ {tr("下移", "Down", "下へ", "아래로")}</button>
                  <button type="button" onClick={() => onRenameRoom?.(root.id)}>✎ {tr("改名", "Rename", "名前変更", "이름 변경")}</button>
                  <button type="button" disabled={busy || activeRoots.length <= 1} onClick={() => onArchiveRoom?.(root.id)}>◇ {tr("收進時光抽屜", "Move to Time Drawer", "時の引き出しへ", "시간 서랍에 넣기")}</button>
                  <button type="button" className="is-danger" disabled={busy || activeRoots.length <= 1} onClick={() => onDeleteRoom?.(root.id)}>⌫ {tr("刪除", "Delete", "削除", "삭제")}</button>
                </div>
              </div>;
            })}</div>
            {activeRoots.length <= 1 && <div className="mp-room-manager-note">{tr("至少保留一個可聊天的主聊天室。", "Keep at least one active main chat.", "チャット可能なメインチャットを1つ残してください。", "대화 가능한 메인 채팅을 하나 이상 남겨주세요.")}</div>}
          </> : archivedRoots.length ? <div className="mp-time-drawer-list">{archivedRoots.map((root) => {
            const branches = collectTree(root, childrenMap).length - 1;
            return <button key={root.id} type="button" onClick={() => openArchive(root)}><span>◇</span><span><b>{root.title}</b><small>{(root.messages || []).length} {tr("則訊息", "messages", "件", "개 메시지")} · {branches} {tr("個分支", "branches", "分岐", "개 분기")}</small></span><span>›</span></button>;
          })}</div> : <div className="mp-room-manager-empty">◇<br/>{tr("時光抽屜目前是空的", "The Time Drawer is empty", "時の引き出しは空です", "시간 서랍이 비어 있어요")}</div>}
        </main>
      </>}
    </div>}
  </MotionPresence>;
}
