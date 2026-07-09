import React, { useState } from "react";
import { ensureNpcSeeds } from "../systems/npc";

const Toggle = ({ on, onChange }) => (
  <button onClick={() => onChange(!on)} style={{
    width: 44, height: 24, borderRadius: 12, border: 0, cursor: "pointer", position: "relative",
    background: on ? "#7d5a6e" : "#d8cfc4", transition: "background .2s",
  }}>
    <span style={{
      position: "absolute", top: 3, left: on ? 23 : 3, width: 18, height: 18,
      borderRadius: "50%", background: "#fff", transition: "left .2s",
    }} />
  </button>
);

const row = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #efe6da" };

export default function GameSettingsPanel({ save, characters, onDirty, onClose }) {
  const [, setTick] = useState(0);
  const rerender = () => setTick((t) => t + 1);
  const ai = save.settings.ai;
  const bindings = save.settings.bindings;
  const npcDefs = ensureNpcSeeds(save);

  const setAi = (key, value) => { ai[key] = value; onDirty(); rerender(); };

  const aiToggles = [
    ["breakthrough", "突破時"],
    ["dungeon", "秘境同行"],
    ["farm", "靈田收成"],
  ];

  return (
    <div style={{ textAlign: "left" }}>
      {/* 角色入駐 */}
      <div style={{ fontSize: 13, fontWeight: 800, color: "#4a4038" }}>角色入駐</div>
      <div style={{ fontSize: 11, color: "#8a7a6a", margin: "2px 0 4px", lineHeight: 1.6 }}>
        把你的角色綁到山莊的居民身上，他們會在你修行時搭話。取消綁定就回歸原本的居民。
      </div>
      {characters.length === 0 && (
        <div style={{ fontSize: 12, color: "#b0a494", padding: "8px 0" }}>（還沒有任何角色，先去聯絡人建立吧）</div>
      )}
      {npcDefs.map((def) => {
        const boundId = bindings[def.seed] || "";
        return (
          <div key={def.seed} style={row}>
            <span style={{ fontSize: 13, color: "#4a4038" }}>
              {def.name}
              {boundId && <span style={{ fontSize: 11, color: "#7d5a6e", fontWeight: 700 }}>（{characters.find((c) => c.id === boundId)?.name || "?"} 入駐中）</span>}
            </span>
            <select
              value={boundId}
              onChange={(e) => {
                if (e.target.value) bindings[def.seed] = e.target.value;
                else delete bindings[def.seed];
                onDirty(); rerender();
              }}
              style={{ fontSize: 12, padding: "4px 6px", borderRadius: 8, border: "1px solid #d9cdbc", background: "#fff", color: "#4a4038", maxWidth: 130 }}
            >
              <option value="">－ 無 －</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        );
      })}

      {/* 角色回覆 */}
      <div style={{ fontSize: 13, fontWeight: 800, color: "#4a4038", marginTop: 16 }}>角色回覆</div>
      <div style={row}>
        <span style={{ fontSize: 13, color: "#4a4038" }}>
          AI 生成回覆
          <span style={{ display: "block", fontSize: 10, color: "#8a7a6a" }}>開＝用你的 API 生成台詞；關＝內建句庫（不耗 token）</span>
        </span>
        <Toggle on={ai.master} onChange={(v) => setAi("master", v)} />
      </div>
      {aiToggles.map(([key, label]) => (
        <div key={key} style={row}>
          <span style={{ fontSize: 13, color: "#4a4038" }}>{label}</span>
          <Toggle on={ai[key]} onChange={(v) => setAi(key, v)} />
        </div>
      ))}

      <button onClick={onClose} style={{ width: "100%", marginTop: 14, border: 0, borderRadius: 12, padding: "9px 0", fontSize: 14, background: "#e8ddd0", color: "#6b5d4f", cursor: "pointer" }}>關閉</button>
    </div>
  );
}
