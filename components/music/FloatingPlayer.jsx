import React, { useRef, useState } from "react";
import { useMusicPlayer } from "../../contexts/MusicPlayerContext";

const BALL = 44;
const EDGE_PAD = 8;
const Y_MIN = 60;
const Y_MAX_PAD = 120;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function FloatingPlayer() {
  const mp = useMusicPlayer();
  const layerRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [snapping, setSnapping] = useState(false);
  const [snapOffset, setSnapOffset] = useState(null);
  const [overStop, setOverStop] = useState(false);
  const movedRef = useRef(false);
  const overStopRef = useRef(false);
  const motionRef = useRef({ x: 0, y: 0, time: 0, vx: 0, vy: 0 });

  if (!mp.track) return null;

  const { side, y, mode } = mp.floatState;
  const inner = side === "left";
  const pct = Math.round(mp.progress * 100);
  const stopZoneVisible = Boolean(drag && movedRef.current);

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

  const resetDrag = () => {
    setDrag(null);
    setOverStop(false);
    overStopRef.current = false;
  };

  const onPointerDown = (event) => {
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch (_) {
      // Pointer capture is optional on older embedded browsers.
    }

    setSnapping(false);
    setSnapOffset(null);
    movedRef.current = false;

    const rect = event.currentTarget.getBoundingClientRect();
    const metrics = shellMetrics();
    if (!metrics) return;

    const { rect: shell, scaleX, scaleY } = metrics;
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
    const isOverStop =
      pointerY > localHeight - 105 &&
      pointerX > localWidth / 2 - 82 &&
      pointerX < localWidth / 2 + 82;

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
      resetDrag();
      return;
    }

    if (!movedRef.current) {
      mp.saveFloat({ ...mp.floatState, mode: mode === "ball" ? "card" : "ball" });
      resetDrag();
      return;
    }

    const metrics = shellMetrics();
    const sampleAge = Math.max(0, event.timeStamp - motionRef.current.time);
    const velocityWeight = clamp(1 - sampleAge / 100, 0, 1);
    const projectedX = drag.x + motionRef.current.vx * velocityWeight * 180;
    const projectedY = drag.y + motionRef.current.vy * velocityWeight * 140;
    const newSide =
      metrics && projectedX + BALL / 2 < metrics.localWidth / 2 ? "left" : "right";
    const snappedY = metrics
      ? clamp(projectedY, Y_MIN, metrics.localHeight - Y_MAX_PAD)
      : drag.y;
    const targetX = metrics
      ? newSide === "left"
        ? EDGE_PAD
        : metrics.localWidth - EDGE_PAD - BALL
      : drag.x;

    setSnapping(true);
    setSnapOffset({ x: drag.x - targetX, y: drag.y - snappedY });
    window.setTimeout(() => setSnapping(false), 260);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setSnapOffset({ x: 0, y: 0 })),
    );
    mp.saveFloat({ mode: "ball", side: newSide, y: snappedY });
    resetDrag();
  };

  const anchorStyle = side === "left" ? { left: EDGE_PAD } : { right: EDGE_PAD };
  const dragOffset = drag
    ? { x: drag.x - drag.startX, y: drag.y - drag.startY }
    : null;
  const visualOffset = dragOffset || snapOffset;

  return (
    <div
      ref={layerRef}
      className="music-floating-player"
      style={{ position: "absolute", inset: 0, zIndex: 300, pointerEvents: "none" }}
    >
      <style>{`
        .fp-marquee-clip{display:block;max-width:110px;overflow:hidden}
        .fp-marquee{display:inline-block;white-space:nowrap;animation:fpScroll 8s linear infinite}
        @keyframes fpScroll{0%,15%{transform:none}85%,100%{transform:translateX(min(0px,calc(110px - 100%)))}}

        .fp-stage{position:relative;display:grid;width:200px;min-height:108px;align-items:start}
        .fp-ball-view,.fp-card-view{
          grid-area:1/1;
          transition:opacity 180ms cubic-bezier(.22,1,.36,1),
            transform 220ms cubic-bezier(.22,1,.36,1),
            filter 180ms cubic-bezier(.22,1,.36,1)
        }
        .fp-stage.is-left .fp-ball-view,.fp-stage.is-left .fp-card-view{transform-origin:left top}
        .fp-stage.is-right .fp-ball-view,.fp-stage.is-right .fp-card-view{transform-origin:right top}
        .fp-ball-view{z-index:2;opacity:1;transform:scale(1);filter:blur(0);pointer-events:auto}
        .fp-card-view{z-index:1;opacity:0;transform:scale(.92);filter:blur(2px);pointer-events:none}
        .fp-stage.is-expanded .fp-ball-view{opacity:0;transform:scale(.88);filter:blur(2px);pointer-events:none}
        .fp-stage.is-expanded .fp-card-view{z-index:3;opacity:1;transform:scale(1);filter:blur(0);pointer-events:auto}
        .fp-stage:not(.is-expanded) .fp-card-view{transition-duration:150ms,180ms,150ms}

        .fp-orb{
          transition:transform 160ms cubic-bezier(.22,1,.36,1),
            box-shadow 180ms ease
        }

        .fp-stop-zone{
          position:absolute;left:50%;bottom:20px;width:116px;height:72px;border-radius:24px;
          display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;
          z-index:40;pointer-events:none;color:#fff;opacity:0;
          transform:translateX(-50%) translateY(12px) scale(.94);
          background:rgba(30,24,38,.7);border:1.5px dashed rgba(255,255,255,.26);
          box-shadow:0 8px 24px rgba(0,0,0,.2);backdrop-filter:blur(12px);
          -webkit-backdrop-filter:blur(12px);
          transition:opacity 140ms ease-in,transform 140ms cubic-bezier(.4,0,1,1),
            background 160ms ease,border-color 160ms ease,box-shadow 160ms ease
        }
        .fp-stop-zone.is-visible{
          opacity:1;transform:translateX(-50%) translateY(0) scale(1);
          transition:opacity 180ms ease-out,transform 220ms cubic-bezier(.22,1,.36,1),
            background 160ms ease,border-color 160ms ease,box-shadow 160ms ease
        }
        .fp-stop-zone.is-over{
          transform:translateX(-50%) translateY(0) scale(1.06);
          background:rgba(108,35,52,.9);border-style:solid;border-color:rgba(255,174,194,.78);
          box-shadow:0 10px 30px rgba(111,25,47,.38)
        }

        .fp-play-toggle{
          width:28px;height:28px;padding:0;border:0;border-radius:50%;display:grid;place-items:center;
          color:#29485d;background:rgba(255,255,255,.94);cursor:pointer;
          transition:transform 140ms cubic-bezier(.22,1,.36,1),background 160ms ease
        }
        .fp-play-toggle:active{transform:scale(.92)}
        .fp-play-icon{
          grid-area:1/1;line-height:1;
          transition:opacity 140ms ease,transform 180ms cubic-bezier(.22,1,.36,1),filter 140ms ease
        }
        .fp-play-icon-play{opacity:1;transform:scale(1) rotate(0);filter:blur(0)}
        .fp-play-icon-pause{opacity:0;transform:scale(.72) rotate(16deg);filter:blur(2px)}
        .fp-play-toggle.is-playing .fp-play-icon-play{opacity:0;transform:scale(.72) rotate(-16deg);filter:blur(2px)}
        .fp-play-toggle.is-playing .fp-play-icon-pause{opacity:1;transform:scale(1) rotate(0);filter:blur(0)}

        @media (prefers-reduced-motion:reduce){
          .fp-marquee{animation:none}
          .fp-ball-view,.fp-card-view,.fp-play-icon{transform:none!important;filter:none!important}
          .fp-stop-zone,.fp-stop-zone.is-visible,.fp-stop-zone.is-over{transform:translateX(-50%)!important}
          .fp-ball-view,.fp-card-view,.fp-stop-zone,.fp-play-icon{transition-duration:1ms!important}
        }
      `}</style>

      <div
        style={{
          position: "absolute",
          top: y,
          ...anchorStyle,
          pointerEvents: "none",
          transform: visualOffset
            ? `translate3d(${visualOffset.x}px,${visualOffset.y}px,0)`
            : "none",
          transition: snapping
            ? "transform .25s cubic-bezier(.23,1,.32,1)"
            : "none",
          willChange: drag || snapping ? "transform" : "auto",
        }}
      >
        <div
          className={`fp-stage ${mode === "card" && !drag ? "is-expanded" : ""} ${
            inner ? "is-left" : "is-right"
          }`}
        >
          <div
            className="fp-ball-view"
            style={{
              display: "flex",
              alignItems: "center",
              flexDirection: inner ? "row" : "row-reverse",
              justifySelf: inner ? "start" : "end",
              cursor: drag ? "grabbing" : "pointer",
              touchAction: "none",
              userSelect: "none",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={resetDrag}
          >
            <div
              className="fp-orb"
              style={{
                width: BALL,
                height: BALL,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                flex: "0 0 auto",
                background: `conic-gradient(#e91e63 ${pct}%, rgba(255,255,255,.25) 0)`,
                transform: drag ? "scale(1.08)" : "none",
                boxShadow: drag
                  ? "0 8px 24px rgba(0,0,0,.35)"
                  : "0 4px 14px rgba(0,0,0,.25)",
              }}
            >
              <div
                style={{
                  width: BALL - 5,
                  height: BALL - 5,
                  borderRadius: "50%",
                  background: "rgba(41,72,93,.88)",
                  display: "grid",
                  placeItems: "center",
                  color: "#fff",
                  fontSize: 16,
                }}
              >
                ♫
              </div>
            </div>
            {!drag && (
              <div
                style={{
                  background: "rgba(41,72,93,.88)",
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "5px 12px",
                  maxWidth: 110,
                  borderRadius: inner ? "0 99px 99px 0" : "99px 0 0 99px",
                  [inner ? "marginLeft" : "marginRight"]: -6,
                }}
              >
                <span className="fp-marquee-clip">
                  <span className="fp-marquee">
                    {mp.track.title}
                    {mp.track.artist ? ` · ${mp.track.artist}` : ""}
                  </span>
                </span>
              </div>
            )}
          </div>

          <ExpandedCard mp={mp} inner={inner} />
        </div>
      </div>

      <div
        className={`fp-stop-zone ${stopZoneVisible ? "is-visible" : ""} ${
          overStop ? "is-over" : ""
        }`}
        aria-hidden={!stopZoneVisible}
      >
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: overStop
              ? "rgba(255,136,166,.24)"
              : "rgba(255,255,255,.1)",
            fontSize: 15,
            lineHeight: 1,
            transition: "background .16s",
          }}
        >
          ■
        </span>
        <b style={{ fontSize: 9.5, letterSpacing: ".04em", opacity: overStop ? 1 : 0.82 }}>
          {overStop ? "放開停止播放" : "拖到這裡停止"}
        </b>
      </div>
    </div>
  );
}

function ExpandedCard({ mp, inner }) {
  return (
    <div
      className="fp-card-view"
      style={{
        width: 200,
        background: "rgba(255,255,255,.9)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,.8)",
        borderRadius: 16,
        padding: "10px 12px",
        boxShadow: "0 12px 32px rgba(0,0,0,.22)",
        justifySelf: inner ? "start" : "end",
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          aria-label="收合播放器"
          onClick={() => mp.saveFloat({ ...mp.floatState, mode: "ball" })}
          style={{
            width: 40,
            height: 40,
            padding: 0,
            border: 0,
            flex: "none",
            borderRadius: 8,
            overflow: "hidden",
            background: "linear-gradient(150deg,#e91e6344,#e91e6311)",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
          }}
        >
          {mp.track.artworkUrl ? (
            <img
              src={mp.track.artworkUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            "♫"
          )}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 900,
              color: "#29485d",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {mp.track.title}
          </div>
          <div
            style={{
              fontSize: 9,
              color: "#5f7f93",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {mp.track.artist}
          </div>
        </div>
      </div>

      <div
        style={{
          height: 3,
          borderRadius: 99,
          background: "#e6e0d4",
          marginTop: 10,
          cursor: "pointer",
        }}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          mp.seek((event.clientX - rect.left) / rect.width);
        }}
      >
        <div
          style={{
            width: `${mp.progress * 100}%`,
            height: "100%",
            borderRadius: 99,
            background: "#e91e63",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 16,
          fontSize: 16,
          color: "#29485d",
          marginTop: 8,
        }}
      >
        <button
          type="button"
          aria-label="切換循環模式"
          onClick={mp.cycleLoop}
          style={{
            border: 0,
            background: "transparent",
            padding: 3,
            cursor: "pointer",
            fontSize: 13,
            color: mp.loopMode === "off" ? "#29485d" : "#e91e63",
            opacity: mp.loopMode === "off" ? 0.35 : 1,
          }}
        >
          {mp.loopMode === "single" ? "ↂ" : "↻"}
        </button>
        <button
          type="button"
          aria-label="下一首"
          onClick={mp.next}
          style={{
            border: 0,
            background: "transparent",
            padding: 3,
            cursor: "pointer",
            color: "inherit",
            opacity: mp.queue.length || mp.track?.playlistId ? 1 : 0.35,
          }}
        >
          ⏭
        </button>
        <button
          type="button"
          className={`fp-play-toggle ${mp.isPlaying ? "is-playing" : ""}`}
          aria-label={mp.isPlaying ? "暫停" : "播放"}
          aria-pressed={mp.isPlaying}
          onClick={mp.toggle}
        >
          <span className="fp-play-icon fp-play-icon-play" aria-hidden="true">
            ▶
          </span>
          <span className="fp-play-icon fp-play-icon-pause" aria-hidden="true">
            Ⅱ
          </span>
        </button>
        <button
          type="button"
          aria-label="停止播放"
          onClick={mp.stop}
          style={{
            border: 0,
            background: "transparent",
            padding: 3,
            cursor: "pointer",
            color: "inherit",
          }}
        >
          ■
        </button>
      </div>
    </div>
  );
}
