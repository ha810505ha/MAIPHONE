import React, { useState } from "react";
import { ensureNpcSeeds } from "../systems/npc";
import { packOf, setActivePackVersion, MAX_PACK_VERSIONS } from "../systems/ai";

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

const POOL_LABELS = {
  breakthrough_ok: "突破成功", breakthrough_fail: "突破失敗",
  dungeon: "秘境同行", dungeonBoss: "秘境 Boss",
  harvest: "收成", rareHarvest: "稀有收成", chat: "閒聊",
};

export default function GameSettingsPanel({ save, characters, onDirty, onEditAppearance, onGenerateLines, onClose }) {
  const [, setTick] = useState(0);
  const [genBusy, setGenBusy] = useState(null); // 正在生成句庫的角色 id
  const [genError, setGenError] = useState(null);
  const [expandedChar, setExpandedChar] = useState(null); // 展開查看台詞的角色 id
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
            <button
              onClick={() => onEditAppearance(save.npcs.indexOf(def))}
              title="編輯外觀"
              style={{ border: "1px solid #d9cdbc", borderRadius: 8, background: "#fff", fontSize: 13, padding: "3px 7px", cursor: "pointer", marginLeft: "auto", marginRight: 6, flexShrink: 0 }}
            >🎨</button>
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

      {/* 角色句庫：key 是角色不是 NPC——解綁/換綁都留著，永不浪費 */}
      {(() => {
        const boundIds = [...new Set(Object.values(bindings).filter(Boolean))];
        const packIds = Object.keys(save.linePacks || {});
        const charIds = [...new Set([...boundIds, ...packIds])].filter((id) => characters.some((c) => c.id === id));
        if (!charIds.length) return null;
        return (
          <>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#4a4038", marginTop: 16 }}>角色句庫</div>
            <div style={{ fontSize: 11, color: "#8a7a6a", margin: "2px 0 4px", lineHeight: 1.6 }}>
              用角色的設定生成一批專屬台詞，之後所有搭話都從這裡抽、不再花費。句庫跟著角色，換綁或解綁都會保留。
            </div>
            {charIds.map((charId) => {
              const char = characters.find((c) => c.id === charId);
              const pack = packOf(save, charId);
              const busy = genBusy === charId;
              return (
                <div key={charId} style={{ ...row, flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#4a4038", flex: 1 }}>{char.name}</span>
                    <button
                      disabled={busy || !onGenerateLines}
                      onClick={async () => {
                        setGenError(null);
                        setGenBusy(charId);
                        try {
                          const err = await onGenerateLines(charId);
                          if (err) setGenError(`${char.name}：${err}`);
                        } catch { setGenError(`${char.name}：生成失敗`); }
                        setGenBusy(null);
                        rerender();
                      }}
                      style={{
                        border: 0, borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 700,
                        cursor: busy || !onGenerateLines ? "default" : "pointer", opacity: busy || !onGenerateLines ? 0.55 : 1,
                        background: "linear-gradient(135deg,#7d5a6e,#9c7089)", color: "#fff",
                      }}
                    >{busy ? "生成中…" : "🔄 生成句庫"}</button>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {Array.from({ length: MAX_PACK_VERSIONS }, (_, i) => {
                      const v = pack?.versions[i];
                      const isActive = pack && pack.active === i;
                      return (
                        <button
                          key={i}
                          disabled={!v}
                          onClick={() => { setActivePackVersion(save, charId, i); onDirty(); rerender(); }}
                          style={{
                            flex: 1, border: isActive ? "2px solid #7d5a6e" : "1px solid #d9cdbc", borderRadius: 10,
                            padding: "5px 0", fontSize: 11, fontWeight: isActive ? 800 : 400,
                            background: isActive ? "#f3ecf1" : "#fff", color: v ? "#4a4038" : "#c4b8a8",
                            cursor: v ? "pointer" : "default",
                          }}
                        >
                          {v ? `版本${i + 1}${isActive ? " ✓" : ""}` : "—"}
                        </button>
                      );
                    })}
                    {pack?.versions.length > 0 && (
                      <button
                        onClick={() => setExpandedChar(expandedChar === charId ? null : charId)}
                        style={{ border: "1px solid #d9cdbc", borderRadius: 10, padding: "5px 10px", fontSize: 11, background: "#fff", color: "#6b5d4f", cursor: "pointer", flexShrink: 0 }}
                      >{expandedChar === charId ? "收合 ▴" : "查看台詞 ▾"}</button>
                    )}
                  </div>
                  {expandedChar === charId && pack?.versions.length > 0 && (() => {
                    const lines = pack.versions[Math.min(pack.active, pack.versions.length - 1)].lines;
                    return (
                      <div style={{ background: "#f7f2ea", borderRadius: 10, padding: "8px 10px", maxHeight: 180, overflowY: "auto" }}>
                        {Object.entries(lines).map(([pool, arr]) => (
                          <div key={pool} style={{ marginBottom: 6 }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: "#7d5a6e", marginBottom: 2 }}>{POOL_LABELS[pool] || pool}</div>
                            {arr.map((line, li) => (
                              <div key={li} style={{ fontSize: 11, color: "#4a4038", lineHeight: 1.6 }}>・{line}</div>
                            ))}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
            {genError && <div style={{ fontSize: 11, color: "#a05656", padding: "4px 0" }}>{genError}</div>}
            {!onGenerateLines && <div style={{ fontSize: 11, color: "#b0a494", padding: "4px 0" }}>（需要先在 MaliPhone 設定好 API 才能生成）</div>}
          </>
        );
      })()}

      {/* 觸發點開關：控制「想不想被搭話」；台詞來源全自動（有句庫用角色的，沒有用通用的） */}
      <div style={{ fontSize: 13, fontWeight: 800, color: "#4a4038", marginTop: 16 }}>角色回覆</div>
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
