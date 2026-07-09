import React, { useEffect, useRef, useState } from "react";
import { PART_COUNTS, SKIN_TONES, DEFAULT_APPEARANCE, sanitizeAppearance, randomAppearance, drawActor } from "../engine/sprite";

const PART_LABELS = {
  skin: "膚色", hair: "髮型", outfit: "服裝", accessory: "配飾",
};
const HAIR_NAMES = ["光頭", "短髮", "長髮", "丸子頭", "馬尾", "道髻"];
const OUTFIT_NAMES = ["短打", "長袍", "披風", "勁裝"];
const ACC_NAMES = ["無", "額帶", "金簪"];
const partName = (part, idx) =>
  part === "hair" ? HAIR_NAMES[idx] : part === "outfit" ? OUTFIT_NAMES[idx] : part === "accessory" ? ACC_NAMES[idx] : `${idx + 1}`;

const HUE_SWATCHES = [0, 25, 45, 90, 150, 200, 240, 280, 320];
const FACINGS = ["down", "left", "up", "right"];

export default function CharacterPanel({ save, onDirty, onClose }) {
  const [draft, setDraft] = useState(() => sanitizeAppearance(save.player.appearance));
  const [facing, setFacing] = useState("down");
  const canvasRef = useRef(null);

  // 預覽：同一顆 drawActor，畫大一點並帶走路動畫
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf = 0;
    const loop = (now) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#e9e1d3";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawActor(ctx, draft, { sx: 20, sy: 14, ts: 100, facing, moving: true, now });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draft, facing]);

  const cycle = (part, dir) => {
    setDraft((d) => ({ ...d, [part]: (d[part] + dir + PART_COUNTS[part]) % PART_COUNTS[part] }));
  };

  const arrowBtn = { border: 0, borderRadius: 8, width: 30, height: 30, fontSize: 14, fontWeight: 700, cursor: "pointer", background: "#e8ddd0", color: "#6b5d4f" };

  const hueRow = (key) => (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
      {HUE_SWATCHES.map((h) => (
        <button key={h} onClick={() => setDraft((d) => ({ ...d, [key]: h }))} style={{
          width: 22, height: 22, borderRadius: "50%", cursor: "pointer",
          border: draft[key] === h ? "2px solid #4a4038" : "2px solid transparent",
          background: `hsl(${h}, 45%, ${key === "hairHue" ? 32 : 52}%)`,
        }} />
      ))}
    </div>
  );

  return (
    <div style={{ textAlign: "left" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {/* 預覽 */}
        <div style={{ textAlign: "center" }}>
          <canvas ref={canvasRef} width={140} height={130} style={{ borderRadius: 12, display: "block" }} />
          <button onClick={() => setFacing(FACINGS[(FACINGS.indexOf(facing) + 1) % 4])} style={{ ...arrowBtn, width: "100%", marginTop: 6, fontSize: 12 }}>
            轉身 ↻
          </button>
        </div>
        {/* 部位調整 */}
        <div style={{ flex: 1, display: "grid", gap: 8 }}>
          {Object.keys(PART_COUNTS).map((part) => (
            <div key={part} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#6b5d4f", width: 34 }}>{PART_LABELS[part]}</span>
              <button style={arrowBtn} onClick={() => cycle(part, -1)}>‹</button>
              <span style={{ flex: 1, textAlign: "center", fontSize: 12, color: "#4a4038" }}>
                {part === "skin"
                  ? <span style={{ display: "inline-block", width: 16, height: 16, borderRadius: "50%", background: SKIN_TONES[draft.skin], verticalAlign: "middle" }} />
                  : partName(part, draft[part])}
              </span>
              <button style={arrowBtn} onClick={() => cycle(part, 1)}>›</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#6b5d4f", width: 34 }}>髮色</span>{hueRow("hairHue")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#6b5d4f", width: 34 }}>衣色</span>{hueRow("outfitHue")}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button style={{ ...arrowBtn, width: "auto", padding: "0 14px", height: 38 }} onClick={() => setDraft(randomAppearance(`${Date.now()}-${Math.random()}`))}>🎲 隨機</button>
        <button style={{ ...arrowBtn, width: "auto", padding: "0 14px", height: 38 }} onClick={() => setDraft({ ...DEFAULT_APPEARANCE })}>還原</button>
        <button
          onClick={() => { save.player.appearance = draft; onDirty(); onClose(); }}
          style={{ flex: 1, border: 0, borderRadius: 12, height: 38, fontSize: 14, fontWeight: 700, cursor: "pointer", background: "linear-gradient(135deg,#7d5a6e,#9c7089)", color: "#fff" }}
        >完成</button>
      </div>
    </div>
  );
}
