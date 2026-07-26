import React, { useRef, useState } from "react";
import { useMusicPlayer } from "../../contexts/MusicPlayerContext";

const BALL = 44, EDGE_PAD = 8, Y_MIN = 60, Y_MAX_PAD = 120; // 避開狀態列與 dock
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// 全域懸浮播放器：吸附左右邊緣的球（含進度環＋歌名膠囊），點一下展開成迷你卡。
// 由 MusicShellLayer 掛在手機殼層，music 頁開啟時整層隱藏。
export default function FloatingPlayer() {
  const mp = useMusicPlayer();
  const layerRef = useRef(null); // absolute inset:0 的圖層，rect 即手機畫布
  const [drag, setDrag] = useState(null); // {dx,dy,x,y}
  const [snapping, setSnapping] = useState(false);
  const [snapOffset, setSnapOffset] = useState(null);
  const [overStop, setOverStop] = useState(false);
  const movedRef = useRef(false);
  const overStopRef = useRef(false);
  const motionRef = useRef({ x: 0, y: 0, time: 0, vx: 0, vy: 0 });

  if (!mp.track) return null;
  const { side, y, mode } = mp.floatState;

  const shellMetrics = () => {
    const element = layerRef.current;
    const rect = element?.getBoundingClientRect();
    if (!element || !rect) return null;
    const localWidth = element.clientWidth || rect.width;
    const localHeight = element.clientHeight || rect.height;
    return {
      rect,
      localWidth,
      localHeight,
      scaleX: rect.width / localWidth || 1,
      scaleY: rect.height / localHeight || 1,
    };
  };

  const onPointerDown = (event) => {
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch (_) {}
    setSnapping(false);
    setSnapOffset(null);
    movedRef.current = false;
    const rect = event.currentTarget.getBoundingClientRect();
    const metrics = shellMetrics();
    if (!metrics) return;
    const { rect: shell, scaleX, scaleY } = metrics;
    // The right-side idle player includes a title pill to the left of the
    // ball. That pill disappears while dragging, so anchor the gesture to the
    // ball itself instead of the variable-width outer container.
    const ballLeft = side === "right" ? rect.right - BALL * scaleX : rect.left;
    const startX = (ballLeft - shell.left) / scaleX;
    const startY = (rect.top - shell.top) / scaleY;
    motionRef.current = { x: startX, y: startY, time: event.timeStamp, vx: 0, vy: 0 };
    setDrag({
      dx: clamp((event.clientX - ballLeft) / scaleX, 0, BALL),
      dy: clamp((event.clientY - rect.top) / scaleY, 0, BALL),
      x: startX,
      y: startY,
      startX,
      startY,
    });
  };
  const onPointerMove = (event) => {
    if (!drag) return;
    const metrics = shellMetrics();
    if (!metrics) return;
    const { rect: shell, localWidth, localHeight, scaleX, scaleY } = metrics;
    const nx = (event.clientX - shell.left) / scaleX - drag.dx;
    const ny = (event.clientY - shell.top) / scaleY - drag.dy;
    const pointerX = (event.clientX - shell.left) / scaleX;
    const pointerY = (event.clientY - shell.top) / scaleY;
    const isOverStop = pointerY > localHeight - 105
      && pointerX > localWidth / 2 - 82
      && pointerX < localWidth / 2 + 82;
    overStopRef.current = isOverStop;
    setOverStop(isOverStop);
    if (Math.hypot(nx - drag.x, ny - drag.y) > 4) movedRef.current = true;
    const nextX = clamp(nx, 0, localWidth - BALL);
    const nextY = clamp(ny, Y_MIN, localHeight - Y_MAX_PAD);
    const previous = motionRef.current;
    const elapsed = Math.max(8, event.timeStamp - previous.time);
    motionRef.current = {
      x: nextX,
      y: nextY,
      time: event.timeStamp,
      vx: (nextX - previous.x) / elapsed,
      vy: (nextY - previous.y) / elapsed,
    };
    setDrag((current) => ({ ...current, x: nextX, y: nextY }));
  };
  const onPointerUp = (event) => {
    if (!drag) return;
    if (movedRef.current && overStopRef.current) {
      mp.stop();
      setDrag(null);
      setOverStop(false);
      overStopRef.current = false;
      return;
    }
    if (!movedRef.current) {
      mp.saveFloat({ ...mp.floatState, mode: mode === "ball" ? "card" : "ball" });
      setDrag(null);
      setOverStop(false);
      overStopRef.current = false;
      return;
    }
    const metrics = shellMetrics();
    const sampleAge = Math.max(0, event.timeStamp - motionRef.current.time);
    const velocityWeight = clamp(1 - sampleAge / 100, 0, 1);
    const projectedX = drag.x + motionRef.current.vx * velocityWeight * 180;
    const projectedY = drag.y + motionRef.current.vy * velocityWeight * 140;
    const newSide = metrics && projectedX + BALL / 2 < metrics.localWidth / 2 ? "left" : "right";
    const snappedY = metrics
      ? clamp(projectedY, Y_MIN, metrics.localHeight - Y_MAX_PAD)
      : drag.y;
    const targetX = metrics
      ? (newSide === "left" ? EDGE_PAD : metrics.localWidth - EDGE_PAD - BALL)
      : drag.x;
    setSnapping(true);
    setSnapOffset({ x: drag.x - targetX, y: drag.y - snappedY });
    setTimeout(() => setSnapping(false), 260);
    requestAnimationFrame(() => requestAnimationFrame(() => setSnapOffset({ x: 0, y: 0 })));
    mp.saveFloat({ mode: "ball", side: newSide, y: snappedY });
    setDrag(null);
    setOverStop(false);
    overStopRef.current = false;
  };

  const x = drag ? drag.x : null; // 非拖曳時用 left/right 定位，避免依賴 rect 量測
  const top = y;
  const inner = side === "left"; // 膠囊／卡朝螢幕內側長
  const pct = Math.round(mp.progress * 100);
  const anchorStyle = side === "left" ? { left: EDGE_PAD } : { right: EDGE_PAD };
  const dragOffset = drag
    ? { x: drag.x - drag.startX, y: drag.y - drag.startY }
    : null;
  const visualOffset = dragOffset || snapOffset;

  return (
    <div ref={layerRef} className="music-floating-player" style={{ position: "absolute", inset: 0, zIndex: 300, pointerEvents: "none" }}>
      <style>{`
        .fp-marquee-clip{display:block;max-width:110px;overflow:hidden}
        .fp-marquee{display:inline-block;white-space:nowrap;animation:fpScroll 8s linear infinite}
        @keyframes fpScroll{0%,15%{transform:none}85%,100%{transform:translateX(min(0px,calc(110px - 100%)))}}
        @keyframes fpPop{from{transform:scale(.9);opacity:0}to{transform:scale(1);opacity:1}}
        @keyframes fpDropIn{from{opacity:0;transform:translateX(-50%) translateY(12px) scale(.94)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
      `}</style>
      <div
        style={{ position: "absolute", top, ...anchorStyle, pointerEvents: "auto", touchAction: "none",
          transform: visualOffset ? `translate3d(${visualOffset.x}px,${visualOffset.y}px,0)` : "none",
          transition: snapping ? "transform .25s cubic-bezier(.23,1,.32,1)" : "none",
          willChange: drag || snapping ? "transform" : "auto" }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { setDrag(null); setOverStop(false); overStopRef.current = false; }}>
        {mode === "card" && !drag ? (
          <ExpandedCard mp={mp} inner={inner} />
        ) : (
          <div style={{ display: "flex", alignItems: "center", flexDirection: inner ? "row" : "row-reverse" }}>
            <div style={{ width: BALL, height: BALL, borderRadius: "50%", display: "grid", placeItems: "center", flex: "0 0 auto",
                background: `conic-gradient(#e91e63 ${pct}%, rgba(255,255,255,.25) 0)`,
                transform: drag ? "scale(1.08)" : "none",
                boxShadow: drag ? "0 8px 24px rgba(0,0,0,.35)" : "0 4px 14px rgba(0,0,0,.25)" }}>
              <div style={{ width: BALL - 5, height: BALL - 5, borderRadius: "50%", background: "rgba(41,72,93,.88)", display: "grid", placeItems: "center", color: "#fff", fontSize: 16 }}>🎵</div>
            </div>
            {!drag && (
              <div style={{ background: "rgba(41,72,93,.88)", color: "#fff", fontSize: 9, fontWeight: 700,
                  padding: "5px 12px", maxWidth: 110,
                  borderRadius: inner ? "0 99px 99px 0" : "99px 0 0 99px",
                  [inner ? "marginLeft" : "marginRight"]: -6 }}>
                <span className="fp-marquee-clip"><span className="fp-marquee">{mp.track.title}{mp.track.artist ? ` — ${mp.track.artist}` : ""}</span></span>
              </div>
            )}
          </div>
        )}
      </div>
      {drag && movedRef.current && (
        <div style={{ position: "absolute", left: "50%", bottom: 20, transform: `translateX(-50%) scale(${overStop ? 1.06 : 1})`, width: 116, height: 72, borderRadius: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, background: overStop ? "rgba(108,35,52,.9)" : "rgba(30,24,38,.7)", color: "#fff", border: `1.5px ${overStop ? "solid" : "dashed"} ${overStop ? "rgba(255,174,194,.78)" : "rgba(255,255,255,.26)"}`, boxShadow: overStop ? "0 10px 30px rgba(111,25,47,.38)" : "0 8px 24px rgba(0,0,0,.2)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", transition: "transform .16s,background .16s,border-color .16s,box-shadow .16s", animation: "fpDropIn .18s ease-out", pointerEvents: "none" }}>
          <span style={{ width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", background: overStop ? "rgba(255,136,166,.24)" : "rgba(255,255,255,.1)", fontSize: 15, lineHeight: 1, transition: "background .16s" }}>♫</span>
          <b style={{ fontSize: 9.5, letterSpacing: ".04em", opacity: overStop ? 1 : .82 }}>{overStop ? "放開停止播放" : "拖曳至此關閉"}</b>
        </div>
      )}
    </div>
  );
}

function ExpandedCard({ mp, inner }) {
  return (
    <div style={{ width: 200, background: "rgba(255,255,255,.9)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,.8)", borderRadius: 16, padding: "10px 12px",
        boxShadow: "0 12px 32px rgba(0,0,0,.22)", animation: "fpPop .15s ease-out",
        transformOrigin: inner ? "left center" : "right center" }}
      onPointerDown={(event) => event.stopPropagation()}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div onClick={() => mp.saveFloat({ ...mp.floatState, mode: "ball" })}
          style={{ width: 40, height: 40, flex: "none", borderRadius: 8, overflow: "hidden",
            background: "linear-gradient(150deg,#e91e6344,#e91e6311)", display: "grid", placeItems: "center", cursor: "pointer" }}>
          {mp.track.artworkUrl ? <img src={mp.track.artworkUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🎵"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#29485d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mp.track.title}</div>
          <div style={{ fontSize: 9, color: "#5f7f93", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mp.track.artist}</div>
        </div>
      </div>
      <div style={{ height: 3, borderRadius: 99, background: "#e6e0d4", marginTop: 10, cursor: "pointer" }}
        onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); mp.seek((event.clientX - rect.left) / rect.width); }}>
        <div style={{ width: `${mp.progress * 100}%`, height: "100%", borderRadius: 99, background: "#e91e63" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 20, fontSize: 16, color: "#29485d", marginTop: 8 }}>
        <span style={{ cursor: "pointer", fontSize: 13, color: mp.loopMode === "off" ? "#29485d" : "#e91e63", opacity: mp.loopMode === "off" ? .35 : 1 }} onClick={mp.cycleLoop}>{mp.loopMode === "single" ? "🔂" : "🔁"}</span>
        <span style={{ cursor: "pointer", opacity: mp.queue.length || mp.track?.playlistId ? 1 : .35 }} onClick={mp.next}>⏭</span>
        <span style={{ cursor: "pointer" }} onClick={mp.toggle}>{mp.isPlaying ? "⏸" : "▶"}</span>
        <span style={{ cursor: "pointer" }} onClick={mp.stop}>⏹</span>
      </div>
    </div>
  );
}
