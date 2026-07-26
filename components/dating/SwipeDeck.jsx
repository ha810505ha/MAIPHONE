import React, { useRef, useState } from "react";
import ProfileCard from "./ProfileCard";
import { CARD_MAX_ROTATION, SWIPE_THRESHOLD, SWIPE_UP_THRESHOLD } from "../../constants/dating";

const FLY_DISTANCE = 520;

export default function SwipeDeck({ deck, superLikes, canRewind, onSwipe, onRewind, onOpenDetail }) {
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [flying, setFlying] = useState(null);
  const startRef = useRef(null);
  // 位移同時存進 ref：快速一甩時 onPointerUp 可能早於重繪，讀 state 會拿到 0。
  const offsetRef = useRef({ x: 0, y: 0 });
  // pointermove 在觸控裝置上可能每秒觸發上百次；用 rAF 把同一幀內的多次事件收斂成一次
  // setState，做法跟桌面圖示拖曳（useHomeDragAndDrop）一致，避免舊手機拖曳時頓感。
  const moveRafRef = useRef(null);
  const top = deck[0];
  const next = deck[1];

  const commit = (action) => {
    if (!top || flying) return;
    const x = action === "pass" ? -FLY_DISTANCE : action === "like" ? FLY_DISTANCE : 0;
    const y = action === "super" ? -FLY_DISTANCE : 0;
    setFlying({ x, y });
    setDrag({ x: 0, y: 0, active: false });
    // 等飛出去的動畫跑完再換牌，不然下一張會瞬間跳出來。
    setTimeout(() => { setFlying(null); onSwipe(top.id, action); }, 260);
  };

  const onPointerDown = (event) => {
    if (!top || flying) return;
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* 合成事件沒有真實 pointerId */ }
    startRef.current = { x: event.clientX, y: event.clientY };
    offsetRef.current = { x: 0, y: 0 };
    setDrag({ x: 0, y: 0, active: true });
  };
  const onPointerMove = (event) => {
    if (!startRef.current) return;
    offsetRef.current = { x: event.clientX - startRef.current.x, y: event.clientY - startRef.current.y };
    // 同一幀內只排一次 setState；已經排了就等那一幀執行時讀最新的 offsetRef。
    if (moveRafRef.current) return;
    moveRafRef.current = requestAnimationFrame(() => {
      moveRafRef.current = null;
      if (!startRef.current) return;
      setDrag({ ...offsetRef.current, active: true });
    });
  };
  const onPointerUp = () => {
    if (!startRef.current) return;
    if (moveRafRef.current) { cancelAnimationFrame(moveRafRef.current); moveRafRef.current = null; }
    startRef.current = null;
    const { x, y } = offsetRef.current;
    offsetRef.current = { x: 0, y: 0 };
    setDrag({ x: 0, y: 0, active: false });
    if (Math.abs(x) >= SWIPE_THRESHOLD) commit(x > 0 ? "like" : "pass");
    // 上滑看資料是玩家指定的手勢；Super Like 只走按鈕。
    else if (-y >= SWIPE_UP_THRESHOLD && Math.abs(x) < SWIPE_THRESHOLD / 2) onOpenDetail(top);
  };

  if (!top) return null;
  const offset = flying || drag;
  const rotation = Math.max(-CARD_MAX_ROTATION, Math.min(CARD_MAX_ROTATION, offset.x * 0.08));
  return (
    <>
      <div className="dt-deck">
        {next && <div className="dt-card behind" key={`behind-${next.id}`}><ProfileCard entry={next} paused dragX={0} dragY={0} /></div>}
        <div
          key={top.id}
          className={`dt-card top ${drag.active ? "dragging" : ""}`}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg)`, opacity: flying ? 0 : 1 }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        >
          <ProfileCard entry={top} paused={drag.active || !!flying} dragX={offset.x} dragY={offset.y} onOpenDetail={() => onOpenDetail(top)} />
        </div>
      </div>
      <div className="dt-actions">
        <button type="button" className="dt-act rewind" disabled={!canRewind} onClick={onRewind} aria-label="回上一張">↺</button>
        <button type="button" className="dt-act pass" onClick={() => commit("pass")} aria-label="跳過">✕</button>
        <button type="button" className="dt-act super" disabled={superLikes <= 0} onClick={() => commit("super")} aria-label="Super Like">
          ★<span className="dt-act-count">{superLikes}</span>
        </button>
        <button type="button" className="dt-act like" onClick={() => commit("like")} aria-label="喜歡">♥</button>
      </div>
    </>
  );
}
