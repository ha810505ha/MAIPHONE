import React, { useEffect, useState } from "react";
import { REALMS } from "../data/realms";
import { realmOf, isMaxRealm, settleExp, canBreakthrough, attemptBreakthrough } from "../systems/cultivation";
import { useYunyinLocale } from "../i18n/YunyinLocale.jsx";

const unlockLabel = (key, yt) => {
  const plot = /^plot_(\d+)$/.exec(key);
  const depth = /^dungeon_depth_(\d+)$/.exec(key);
  if (plot) return yt("cultivation.unlockPlot", { number: plot[1] });
  if (depth) return yt("cultivation.unlockDepth", { number: depth[1] });
  if (key === "recipe_ningshen") return yt("cultivation.unlockRecipe");
  if (key === "furnace_2") return yt("cultivation.unlockFurnace");
  return key;
};

export default function CultivationPanel({ save, onDirty, onCompanion, onClose }) {
  const { yt, yv } = useYunyinLocale();
  const [, setTick] = useState(0);
  const [result, setResult] = useState(null); // 突破結果訊息
  const [companionLine, setCompanionLine] = useState(null); // 入駐角色的一句話

  // 面板開著時每秒回算一次修為，讓數字會動
  useEffect(() => {
    settleExp(save.cultivation);
    const timer = setInterval(() => { settleExp(save.cultivation); setTick((t) => t + 1); }, 1000);
    return () => clearInterval(timer);
  }, [save]);

  const c = save.cultivation;
  const realm = realmOf(c);
  const now = Date.now();
  const pct = Math.min(100, (c.exp / realm.expMax) * 100);
  const cdLeftMin = Math.max(0, Math.ceil(((c.breakthroughCdUntil || 0) - now) / 60000));
  const nextRealm = isMaxRealm(c) ? null : REALMS[c.realmIdx + 1];

  const doBreakthrough = () => {
    const r = attemptBreakthrough(c);
    if (!r) return;
    setResult(r.ok
      ? { ok: true, text: yt("cultivation.breakthroughSuccess", { realm: yv(r.realmName) }) }
      : { ok: false, text: yt("cultivation.breakthroughFailed") });
    onDirty();
    setTick((t) => t + 1);
    // 入駐角色的反應（AI 或句庫，取不到就安靜）
    setCompanionLine(null);
    onCompanion?.({
      poolKey: r.ok ? "breakthrough_ok" : "breakthrough_fail",
      prompt: r.ok
        ? `玩家剛剛突破成功，晉入「${r.realmName}」境界。`
        : "玩家嘗試突破境界失敗，修為折損了一成，需要調息一個時辰。",
    }).then((line) => line && setCompanionLine(line));
  };

  return (
    <div style={{ textAlign: "left" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{yv(realm.name)}</div>
        <div style={{ fontSize: 12, color: "#8a7a6a" }}>{yt("cultivation.rate", { rate: realm.ratePerMin })}</div>
      </div>
      {/* 修為條 */}
      <div style={{ marginTop: 12, height: 14, borderRadius: 7, background: "#e8ddd0", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 7, background: "linear-gradient(90deg,#8fb7a2,#5f9c82)", transition: "width .5s" }} />
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: "#8a7a6a", display: "flex", justifyContent: "space-between" }}>
        <span>{Math.floor(c.exp)} / {realm.expMax}</span>
        <span>{pct.toFixed(1)}%</span>
      </div>

      {nextRealm && (
        <div style={{ marginTop: 12, fontSize: 12, color: "#6b5d4f", background: "#f3ece2", borderRadius: 10, padding: "8px 10px", lineHeight: 1.7 }}>
          <b>{yt("cultivation.nextUnlocks", { realm: yv(nextRealm.name) })}</b><br />
          {nextRealm.unlocks.length ? nextRealm.unlocks.map((key) => unlockLabel(key, yt)).join(" · ") : "—"}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: result.ok ? "#3d7a5c" : "#a05656", background: result.ok ? "#e4f2ea" : "#f7e6e6", borderRadius: 10, padding: "9px 11px" }}>
          {result.text}
        </div>
      )}
      {companionLine && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#6d5a7d", background: "#ece4f3", borderRadius: 10, padding: "8px 11px", lineHeight: 1.6 }}>
          💬 <b>{companionLine.name}</b>：{companionLine.text}
        </div>
      )}

      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
        {!isMaxRealm(c) && (
          <button
            onClick={doBreakthrough}
            disabled={!canBreakthrough(c)}
            style={{
              flex: 1, border: 0, borderRadius: 12, padding: "10px 0", fontSize: 14, fontWeight: 700, cursor: canBreakthrough(c) ? "pointer" : "default",
              background: canBreakthrough(c) ? "linear-gradient(135deg,#7d5a6e,#9c7089)" : "#d8cfc4", color: "#fff",
            }}
          >
            {cdLeftMin > 0 ? yt("cultivation.recovering", { minutes: cdLeftMin }) : pct >= 100 ? yt("cultivation.attempt") : yt("cultivation.notFull")}
          </button>
        )}
        <button onClick={onClose} style={{ flex: 1, border: 0, borderRadius: 12, padding: "10px 0", fontSize: 14, background: "#e8ddd0", color: "#6b5d4f", cursor: "pointer" }}>{yt("common.leave")}</button>
      </div>
    </div>
  );
}
