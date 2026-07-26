import React, { useState } from "react";
import { MODIFIERS } from "../data/events";
import { itemMeta } from "../systems/shop";
import {
  eventById, startRun, chooseOption, proceed, finishRun, maxRunsOf, runModEffects,
  DIFFICULTIES, difficultyUnlocked,
} from "../systems/dungeon";

const btn = (primary, enabled = true) => ({
  border: 0, borderRadius: 12, padding: "10px 14px", fontSize: 14, fontWeight: 700,
  cursor: enabled ? "pointer" : "default", opacity: enabled ? 1 : 0.55,
  background: primary ? "linear-gradient(135deg,#5a6b8c,#7d8fb3)" : "#e8ddd0",
  color: primary ? "#fff" : "#6b5d4f",
});

const fxText = (fx) => {
  const parts = [];
  if (fx.exp) parts.push(`修為+${fx.exp}`);
  if (fx.coins) parts.push(`🪙${fx.coins > 0 ? "+" : ""}${fx.coins}`);
  if (fx.hp) parts.push(`🩸${fx.hp > 0 ? "+" : ""}${fx.hp}`);
  if (fx.item) parts.push(`${itemMeta(fx.item.id).icon}${itemMeta(fx.item.id).name} ×${fx.itemN || fx.item.n}`);
  return parts.join("・");
};

export default function DungeonPanel({ save, onDirty, onToast, onCompanion, onCrystals, onClose }) {
  const [, setTick] = useState(0);
  const [summary, setSummary] = useState(null);
  const [companionLine, setCompanionLine] = useState(null);
  const [difficulty, setDifficulty] = useState(1);
  const rerender = () => setTick((t) => t + 1);
  const run = save.dungeon.activeRun;

  // 同行搭話：Boss 層/通關必觸發，一般層 15% 機率、每輪至多 2 次（次數記在 run 裡，關 app 續闖也算數）
  const tryCompanion = (r) => {
    setCompanionLine(null);
    if (!onCompanion || !r) return;
    const isBoss = r.eventId === "boss" || r.state === "cleared";
    if (!isBoss) {
      if ((r.companionShots || 0) >= 2 || Math.random() > 0.15) return;
      r.companionShots = (r.companionShots || 0) + 1;
    }
    const ev = eventById(r.eventId);
    onCompanion({
      poolKey: isBoss ? "dungeonBoss" : "dungeon",
      force: true, // 頻控在上面自己管，不吃全域冷卻
      prompt: `你正陪玩家在秘境探索（第 ${r.floor}/${r.totalFloors} 層，體力 ${r.hp}/${r.hpMax}）。剛發生：${ev?.text || ""}結果：${r.outcome?.text || ""}`,
    }).then((line) => line && setCompanionLine(line));
  };

  const doFinish = (mode) => {
    const s = finishRun(save, mode);
    if (s?.crystals) onCrystals?.(s.crystals, {
      note: `雲隱山莊・秘境${s.mode === "cleared" ? "通關" : s.mode === "retreat" ? "撤退結算" : "探索結算"}`,
    });
    setSummary(s);
    onDirty();
  };

  // ---- 結算畫面 ----
  if (summary) {
    const title = summary.mode === "cleared" ? "🎉 通關！" : summary.mode === "retreat" ? "🏃 見好就收" : "💀 力竭出局";
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>
        <div style={{ fontSize: 12, color: "#8a7a6a", marginTop: 4 }}>
          {summary.difficultyName}・抵達第 {summary.floor} / {summary.totalFloors} 層
          {summary.mode === "dead" && "・戰利品折損一半"}
        </div>
        <div style={{ margin: "14px 0", padding: "12px 14px", background: "#f3ece2", borderRadius: 12, fontSize: 13, lineHeight: 2, textAlign: "left" }}>
          <div>修為 <b style={{ color: "#3d7a5c" }}>+{summary.exp}</b></div>
          <div>靈石 <b style={{ color: "#b8860b" }}>🪙+{summary.coins}</b></div>
          <div>靈魂結晶 <b style={{ color: "#b05f88" }}>💎 +{summary.crystals}</b></div>
          {summary.blueprint && <div>📜 {summary.blueprint.name}圖紙 <b style={{ color: "#8a5c9e" }}>（丹房可解鎖購買）</b></div>}
          {summary.items.map((it) => (
            <div key={it.id}>{itemMeta(it.id).icon} {itemMeta(it.id).name} <b>×{it.n}</b></div>
          ))}
          {summary.items.length === 0 && summary.exp === 0 && summary.coins === 0 && <div>兩手空空⋯⋯</div>}
        </div>
        <button style={btn(true)} onClick={onClose}>離開秘境</button>
      </div>
    );
  }

  // ---- 入口大廳 ----
  if (!run) {
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 32 }}>🌫️</div>
        <div style={{ fontSize: 13, color: "#6b5d4f", lineHeight: 1.8, margin: "10px 0" }}>
          迷霧深處藏著稀有藥草、建材與星露籽。<br />
          每層一個際遇，體力歸零出局掉一半戰利品，<br />
          隨時撤退可全數帶走。
        </div>
        <div style={{ display: "grid", gap: 6, margin: "0 0 12px", textAlign: "left" }}>
          {DIFFICULTIES.map((d) => {
            const unlocked = difficultyUnlocked(d, save.cultivation);
            const active = difficulty === d.id;
            return (
              <button key={d.id} disabled={!unlocked} onClick={() => setDifficulty(d.id)} style={{
                display: "flex", alignItems: "center", gap: 8, border: active ? "2px solid #5a6b8c" : "1px solid #e2d6c6",
                borderRadius: 12, padding: "8px 10px", background: active ? "#eef1f7" : "#fff",
                opacity: unlocked ? 1 : 0.5, cursor: unlocked ? "pointer" : "default", textAlign: "left",
              }}>
                <span style={{ fontSize: 20 }}>{d.icon}</span>
                <span style={{ flex: 1 }}>
                  <b style={{ fontSize: 13, color: "#4e4438" }}>{d.name}{!unlocked && " 🔒"}</b>
                  <span style={{ display: "block", fontSize: 11, color: "#8a7a6a" }}>
                    {unlocked ? d.desc : "境界不足（突破後解鎖）"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: "#8a7a6a", marginBottom: 14 }}>
          今日剩餘次數：<b>{save.dungeon.runsToday}</b> / {maxRunsOf(save.cultivation)}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button style={btn(true, save.dungeon.runsToday > 0)} disabled={save.dungeon.runsToday < 1} onClick={() => {
            const err = startRun(save, difficulty);
            if (err) { onToast(err); return; }
            onDirty(); rerender();
          }}>踏入迷霧</button>
          <button style={btn(false)} onClick={onClose}>離開</button>
        </div>
      </div>
    );
  }

  // ---- 進行中：共用抬頭 ----
  const header = (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "#6b5d4f" }}>
        <span>第 {run.floor} / {run.totalFloors} 層</span>
        <span>🩸 {run.hp} / {run.hpMax}</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: "#e8ddd0", margin: "6px 0 8px", overflow: "hidden" }}>
        <div style={{ width: `${(run.hp / run.hpMax) * 100}%`, height: "100%", background: run.hp <= 3 ? "#c0605c" : "#5a8c6b", borderRadius: 4, transition: "width .3s" }} />
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
        {run.modifiers.map((mid) => {
          const m = MODIFIERS.find((m) => m.id === mid);
          return m && <span key={mid} title={m.desc} style={{ fontSize: 10, fontWeight: 700, background: "#ece4f3", color: "#6d5a7d", borderRadius: 8, padding: "3px 8px" }}>{m.label}｜{m.desc}</span>;
        })}
        <span style={{ fontSize: 10, fontWeight: 700, background: "#f3ece2", color: "#8a7a6a", borderRadius: 8, padding: "3px 8px" }}>
          袋中：修為{run.exp}・🪙{run.coins}・物品{Object.values(run.loot).reduce((s, n) => s + n, 0)}
        </span>
      </div>
    </>
  );

  // ---- 出局 ----
  if (run.state === "dead") {
    return (
      <div style={{ textAlign: "left" }}>
        {header}
        <div style={{ padding: "14px", background: "#f7e6e6", borderRadius: 12, fontSize: 13, color: "#a05656", lineHeight: 1.7 }}>
          {run.outcome?.text}<br /><b>你力竭倒地，被迷霧送出了秘境⋯⋯</b>
        </div>
        <button style={{ ...btn(true), width: "100%", marginTop: 12 }} onClick={() => doFinish("dead")}>拾起殘餘的戰利品</button>
      </div>
    );
  }

  // ---- 選擇後的結果（含 Boss 層通關）----
  if (run.state === "outcome" || run.state === "cleared") {
    const o = run.outcome;
    return (
      <div style={{ textAlign: "left" }}>
        {header}
        <div style={{ padding: "12px 14px", background: o.ok ? "#e4f2ea" : "#f7e6e6", borderRadius: 12, fontSize: 13, color: o.ok ? "#3d5c4c" : "#a05656", lineHeight: 1.7 }}>
          {o.text}
          {fxText(o.fx) && <div style={{ marginTop: 6, fontWeight: 700 }}>{fxText(o.fx)}</div>}
        </div>
        {companionLine && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#6d5a7d", background: "#ece4f3", borderRadius: 10, padding: "8px 11px", lineHeight: 1.6 }}>
            💬 <b>{companionLine.name}</b>：{companionLine.text}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {run.state === "cleared" ? (
            <button style={{ ...btn(true), flex: 1 }} onClick={() => doFinish("cleared")}>收取全部戰利品</button>
          ) : (
            <>
              <button style={{ ...btn(true), flex: 1 }} onClick={() => { proceed(save); onDirty(); rerender(); }}>繼續深入</button>
              <button style={{ ...btn(false), flex: 1 }} onClick={() => doFinish("retreat")}>撤退帶走</button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ---- 事件卡 ----
  const ev = eventById(run.eventId);
  return (
    <div style={{ textAlign: "left" }}>
      {header}
      <div style={{ textAlign: "center", fontSize: 34, margin: "4px 0 8px" }}>{ev.icon}</div>
      <div style={{ fontSize: 13, color: "#4a4038", lineHeight: 1.8, padding: "0 2px", marginBottom: 12 }}>{ev.text}</div>
      {ev.choices.map((ch, i) => (
        <button key={i} onClick={() => { chooseOption(save, i); tryCompanion(save.dungeon.activeRun); onDirty(); rerender(); }} style={{
          display: "block", width: "100%", textAlign: "left", marginBottom: 8,
          border: "1px solid #d9cdbc", borderRadius: 12, padding: "10px 12px",
          background: "#fff", cursor: "pointer",
        }}>
          <b style={{ fontSize: 13 }}>{ch.label}</b>
          <span style={{ display: "block", fontSize: 11, color: "#8a7a6a", marginTop: 2 }}>{ch.hint}</span>
        </button>
      ))}
    </div>
  );
}
