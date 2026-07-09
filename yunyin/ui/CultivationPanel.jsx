import React, { useEffect, useState } from "react";
import { REALMS } from "../data/realms";
import { realmOf, isMaxRealm, settleExp, canBreakthrough, attemptBreakthrough } from "../systems/cultivation";

const UNLOCK_LABELS = {
  plot_4: "靈田第 4 格", plot_5: "靈田第 5 格", plot_6: "靈田第 6 格", plot_7: "靈田第 7 格", plot_8: "靈田第 8 格",
  recipe_ningshen: "丹方：凝神丹", furnace_2: "第 2 座丹爐", dungeon_depth_2: "秘境深度 2", dungeon_depth_3: "秘境深度 3",
};

export default function CultivationPanel({ save, onDirty, onCompanion, onClose }) {
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
      ? { ok: true, text: `突破成功！晉入「${r.realmName}」` }
      : { ok: false, text: "心魔來襲，突破失敗⋯⋯修為折損一成，需調息一個時辰。" });
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
        <div style={{ fontSize: 22, fontWeight: 800 }}>{realm.name}</div>
        <div style={{ fontSize: 12, color: "#8a7a6a" }}>修為 +{realm.ratePerMin}/分</div>
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
          <b>下一境「{nextRealm.name}」解鎖：</b><br />
          {nextRealm.unlocks.length ? nextRealm.unlocks.map((k) => UNLOCK_LABELS[k] || k).join("、") : "—"}
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
            {cdLeftMin > 0 ? `調息中（${cdLeftMin} 分）` : pct >= 100 ? "嘗試突破" : "修為未滿"}
          </button>
        )}
        <button onClick={onClose} style={{ flex: 1, border: 0, borderRadius: 12, padding: "10px 0", fontSize: 14, background: "#e8ddd0", color: "#6b5d4f", cursor: "pointer" }}>離開</button>
      </div>
    </div>
  );
}
