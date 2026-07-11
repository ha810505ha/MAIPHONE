import React, { useEffect, useRef, useState } from "react";
import { DEFAULT_APPEARANCE, sanitizeAppearance, randomAppearance, drawActor } from "../engine/sprite";
import { CHAR_MANIFEST } from "../data/charManifest";

const FACINGS = ["down", "left", "up", "right"];
const cycleIn = (arr, cur, dir) => arr[(arr.indexOf(cur) + dir + arr.length) % arr.length];
// 配飾 style 形如 "03_Backpack" → 顯示 "Backpack"
const accName = (style) => style.replace(/^\d+_/, "").replace(/_/g, " ");

// 泛用外觀編輯器：value 是目前外觀（玩家或 NPC），onSave 拿到編輯結果——由呼叫端決定存到哪
export default function CharacterPanel({ value, onSave, onClose }) {
  const [draft, setDraft] = useState(() => sanitizeAppearance(value));
  const [facing, setFacing] = useState("down");
  const canvasRef = useRef(null);
  const m = CHAR_MANIFEST;

  // 預覽：同一顆 drawActor，帶走路動畫
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    let raf = 0;
    const loop = (now) => {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#e9e1d3";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawActor(ctx, draft, { sx: 30, sy: 92, ts: 80, facing, moving: true, now });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draft, facing]);

  // ---- 各部位的「目前值 / 選項數 / 加減」統一定義，UI 一個迴圈生成 ----
  const hairStyles = [null, ...m.hair.map((h) => h.style)]; // null = 光頭
  const hairDef = draft.hair && m.hair.find((h) => h.style === draft.hair.style);
  const outfitDef = m.outfits.find((o) => o.style === draft.outfit.style) || m.outfits[0];
  const accStyles = [null, ...m.accessories.map((a) => a.style)];
  const accDef = draft.accessory && m.accessories.find((a) => a.style === draft.accessory.style);

  const rows = [
    {
      label: "膚色", value: `${draft.body}/${m.bodies.length}`,
      cycle: (dir) => setDraft((d) => ({ ...d, body: cycleIn(m.bodies, d.body, dir) })),
    },
    {
      label: "眼睛", value: `${draft.eyes}/${m.eyes.length}`,
      cycle: (dir) => setDraft((d) => ({ ...d, eyes: cycleIn(m.eyes, d.eyes, dir) })),
    },
    {
      label: "髮型", value: draft.hair ? `${draft.hair.style}/${m.hair.length}` : "光頭",
      cycle: (dir) => setDraft((d) => {
        const next = cycleIn(hairStyles, d.hair?.style ?? null, dir);
        if (next === null) return { ...d, hair: null };
        const def = m.hair.find((h) => h.style === next);
        return { ...d, hair: { style: next, color: def.colors.includes(d.hair?.color) ? d.hair.color : def.colors[0] } };
      }),
    },
    hairDef && {
      label: "髮色", value: `${draft.hair.color}/${hairDef.colors.length}`,
      cycle: (dir) => setDraft((d) => ({ ...d, hair: { ...d.hair, color: cycleIn(hairDef.colors, d.hair.color, dir) } })),
    },
    {
      label: "服裝", value: `${draft.outfit.style}/${m.outfits.length}`,
      cycle: (dir) => setDraft((d) => {
        const next = cycleIn(m.outfits.map((o) => o.style), d.outfit.style, dir);
        const def = m.outfits.find((o) => o.style === next);
        return { ...d, outfit: { style: next, color: def.colors.includes(d.outfit.color) ? d.outfit.color : def.colors[0] } };
      }),
    },
    {
      label: "衣色", value: `${draft.outfit.color}/${outfitDef.colors.length}`,
      cycle: (dir) => setDraft((d) => ({ ...d, outfit: { ...d.outfit, color: cycleIn(outfitDef.colors, d.outfit.color, dir) } })),
    },
    {
      label: "配飾", value: draft.accessory ? accName(draft.accessory.style) : "無",
      cycle: (dir) => setDraft((d) => {
        const next = cycleIn(accStyles, d.accessory?.style ?? null, dir);
        if (next === null) return { ...d, accessory: null };
        const def = m.accessories.find((a) => a.style === next);
        return { ...d, accessory: { style: next, color: def.colors.includes(d.accessory?.color) ? d.accessory.color : def.colors[0] } };
      }),
    },
    accDef && accDef.colors.length > 1 && {
      label: "飾色", value: `${draft.accessory.color}/${accDef.colors.length}`,
      cycle: (dir) => setDraft((d) => ({ ...d, accessory: { ...d.accessory, color: cycleIn(accDef.colors, d.accessory.color, dir) } })),
    },
  ].filter(Boolean);

  const arrowBtn = { border: 0, borderRadius: 8, width: 24, height: 28, padding: 0, fontSize: 14, fontWeight: 700, cursor: "pointer", background: "#e8ddd0", color: "#6b5d4f", flexShrink: 0 };

  return (
    <div style={{ textAlign: "left" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        {/* 預覽 */}
        <div style={{ textAlign: "center", width: 120, flex: "0 0 120px" }}>
          <canvas ref={canvasRef} width={140} height={190} style={{ width: 120, height: 163, borderRadius: 12, display: "block", imageRendering: "pixelated" }} />
          <button onClick={() => setFacing(FACINGS[(FACINGS.indexOf(facing) + 1) % 4])} style={{ ...arrowBtn, width: "100%", marginTop: 6, fontSize: 12 }}>
            轉身 ↻
          </button>
        </div>
        {/* 部位調整 */}
        <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 6, maxHeight: 264, overflowY: "auto", overflowX: "hidden", paddingRight: 4, boxSizing: "border-box" }}>
          {rows.map((r) => (
            <div key={r.label} style={{ display: "grid", gridTemplateColumns: "30px 24px minmax(38px,1fr) 24px", alignItems: "center", gap: 3, width: "100%", minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#6b5d4f", width: 30 }}>{r.label}</span>
              <button style={arrowBtn} onClick={() => r.cycle(-1)}>‹</button>
              <span style={{ minWidth: 38, maxWidth: "100%", textAlign: "center", fontSize: 10.5, color: "#4a4038", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.value}</span>
              <button style={arrowBtn} onClick={() => r.cycle(1)}>›</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button style={{ ...arrowBtn, width: "auto", padding: "0 14px", height: 38 }} onClick={() => setDraft(randomAppearance(`${Date.now()}-${Math.random()}`))}>🎲 隨機</button>
        <button style={{ ...arrowBtn, width: "auto", padding: "0 14px", height: 38 }} onClick={() => setDraft({ ...DEFAULT_APPEARANCE })}>還原</button>
        <button
          onClick={() => { onSave(draft); onClose(); }}
          style={{ flex: 1, border: 0, borderRadius: 12, height: 38, fontSize: 14, fontWeight: 700, cursor: "pointer", background: "linear-gradient(135deg,#7d5a6e,#9c7089)", color: "#fff" }}
        >完成</button>
      </div>
    </div>
  );
}
