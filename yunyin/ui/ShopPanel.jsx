import React, { useEffect, useState } from "react";
import { RECIPES } from "../data/recipes";
import {
  itemMeta, recipeById, recipeUnlocked, maxBatch,
  startCraft, furnaceDone, collectFurnace,
  stockShelf, unstockShelf, settleShelves, SELL_INTERVAL_SEC,
  deliverOrder,
} from "../systems/shop";

const btnStyle = (primary, enabled = true) => ({
  border: 0, borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 700,
  cursor: enabled ? "pointer" : "default", opacity: enabled ? 1 : 0.55,
  background: primary ? "linear-gradient(135deg,#7d5a6e,#9c7089)" : "#e8ddd0",
  color: primary ? "#fff" : "#6b5d4f",
});

const rowStyle = { display: "flex", alignItems: "center", gap: 8, border: "1px solid #e2d6c6", borderRadius: 12, padding: "9px 10px", marginBottom: 8, background: "#fff" };

export default function ShopPanel({ save, onDirty, onToast, onCrystals, onClose }) {
  const [tab, setTab] = useState("furnace");
  const [, setTick] = useState(0);

  // 面板開著時每秒回算：貨架賣出即時進帳、丹爐進度會動
  useEffect(() => {
    const timer = setInterval(() => {
      const r = settleShelves(save);
      if (r.sold > 0) onDirty();
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [save, onDirty]);

  const now = Date.now();
  const inv = save.inventory;
  const invEntries = Object.entries(inv).filter(([, n]) => n > 0);
  const f = save.shop.furnace;

  const renderFurnace = () => {
    if (f.recipeId) {
      const r = recipeById(f.recipeId);
      const done = furnaceDone(f, now);
      const nextMin = done >= f.batch ? 0 : Math.ceil((f.startedAt + (done + 1) * r.craftMin * 60000 - now) / 60000);
      return (
        <div>
          <div style={rowStyle}>
            <span style={{ fontSize: 22 }}>{r.icon}</span>
            <span style={{ flex: 1 }}>
              <b style={{ fontSize: 14 }}>{r.name}</b>
              <span style={{ display: "block", fontSize: 11, color: "#8a7a6a" }}>
                已煉好 {done} / {f.batch} 爐{done < f.batch && `・下一爐約 ${nextMin} 分`}
              </span>
            </span>
            <button
              style={btnStyle(true, done > 0)}
              disabled={done < 1}
              onClick={() => {
                const r2 = collectFurnace(save);
                if (r2) { onToast(`${r2.recipe.icon} ${r2.recipe.name} ×${r2.count} 入袋`); onDirty(); setTick((t) => t + 1); }
              }}
            >收取</button>
          </div>
          <div style={{ fontSize: 11, color: "#8a7a6a" }}>丹爐運轉中，煉好的可以先收，剩下的繼續煉。</div>
        </div>
      );
    }
    return (
      <div>
        {RECIPES.map((r) => {
          const unlocked = recipeUnlocked(r, save.cultivation);
          const max = unlocked ? maxBatch(save, r) : 0;
          const inText = Object.entries(r.in).map(([k, n]) => `${itemMeta(k).icon}${itemMeta(k).name} ×${n}`).join(" + ");
          return (
            <div key={r.id} style={{ ...rowStyle, opacity: unlocked ? 1 : 0.55 }}>
              <span style={{ fontSize: 22 }}>{r.icon}</span>
              <span style={{ flex: 1 }}>
                <b style={{ fontSize: 14 }}>{r.name}{!unlocked && " 🔒"}</b>
                <span style={{ display: "block", fontSize: 11, color: "#8a7a6a" }}>
                  {inText} → 賣 🪙{r.sellPrice}・每爐 {r.craftMin} 分
                </span>
              </span>
              {unlocked && (
                <span style={{ display: "flex", gap: 6 }}>
                  <button style={btnStyle(true, max >= 1)} disabled={max < 1} onClick={() => {
                    const err = startCraft(save, r.id, 1);
                    if (err) onToast(err); else { onToast(`${r.icon} 開始煉製`); onDirty(); }
                    setTick((t) => t + 1);
                  }}>煉 1</button>
                  <button style={btnStyle(false, max >= 2)} disabled={max < 2} onClick={() => {
                    const err = startCraft(save, r.id, max);
                    if (err) onToast(err); else { onToast(`${r.icon} 開始煉製 ×${max}`); onDirty(); }
                    setTick((t) => t + 1);
                  }}>煉 {Math.max(max, 2)}</button>
                </span>
              )}
            </div>
          );
        })}
        <div style={{ fontSize: 11, color: "#8a7a6a" }}>材料不夠就去靈田種，凝神丹需要更高境界解鎖。</div>
      </div>
    );
  };

  const renderShelves = () => (
    <div>
      {save.shop.shelves.map((sh, idx) => {
        if (sh.itemId) {
          const m = itemMeta(sh.itemId);
          const nextSec = Math.max(0, Math.ceil((sh.soldUpdatedAt + SELL_INTERVAL_SEC * 1000 - now) / 1000));
          return (
            <div key={sh.id} style={rowStyle}>
              <span style={{ fontSize: 22 }}>{m.icon}</span>
              <span style={{ flex: 1 }}>
                <b style={{ fontSize: 14 }}>{m.name} ×{sh.stock}</b>
                <span style={{ display: "block", fontSize: 11, color: "#8a7a6a" }}>
                  🪙{m.sellPrice}/件・下一件約 {nextSec >= 60 ? `${Math.ceil(nextSec / 60)} 分鐘` : `${nextSec} 秒`}
                </span>
              </span>
              <button style={btnStyle(false)} onClick={() => { unstockShelf(save, idx); onDirty(); setTick((t) => t + 1); }}>收回</button>
            </div>
          );
        }
        return (
          <div key={sh.id} style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch" }}>
            <div style={{ fontSize: 12, color: "#8a7a6a", marginBottom: invEntries.length ? 6 : 0 }}>空貨架 {sh.id + 1} — 選擇上架物品：</div>
            {invEntries.length === 0 ? (
              <div style={{ fontSize: 11, color: "#b0a494" }}>（背包沒有可賣的東西）</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {invEntries.map(([id, n]) => {
                  const m = itemMeta(id);
                  return (
                    <button key={id} style={btnStyle(false)} onClick={() => {
                      const err = stockShelf(save, idx, id);
                      if (err) onToast(err); else { onToast(`${m.icon} ${m.name} ×${n} 已上架`); onDirty(); }
                      setTick((t) => t + 1);
                    }}>{m.icon}{m.name} ×{n}</button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <div style={{ fontSize: 11, color: "#8a7a6a" }}>貨架每 {Math.round(SELL_INTERVAL_SEC / 60)} 分鐘自動賣出 1 件，離線也照賣；貨架不產出結晶。</div>
    </div>
  );

  const renderOrders = () => (
    <div>
      {save.shop.orders.length === 0 && <div style={{ fontSize: 12, color: "#8a7a6a" }}>今日沒有行商到訪。</div>}
      {save.shop.orders.map((o) => {
        const m = itemMeta(o.itemId);
        const enough = (inv[o.itemId] || 0) >= o.count;
        return (
          <div key={o.id} style={{ ...rowStyle, opacity: o.done ? 0.5 : 1 }}>
            <span style={{ fontSize: 22 }}>{m.icon}</span>
            <span style={{ flex: 1 }}>
              <b style={{ fontSize: 14 }}>{o.tier ? `【${o.tier}】` : ""}{m.name} ×{o.count}</b>
              <span style={{ display: "block", fontSize: 11, color: "#8a7a6a" }}>
                報酬 🪙{o.rewardCoins} + 💎{o.rewardCrystals}（持有 {inv[o.itemId] || 0}）
              </span>
            </span>
            {o.done ? (
              <span style={{ fontSize: 12, fontWeight: 700, color: "#3d7a5c" }}>已交付</span>
            ) : (
              <button style={btnStyle(true, enough)} disabled={!enough} onClick={() => {
                const r = deliverOrder(save, o.id);
                if (typeof r === "string") { onToast(r); return; }
                onCrystals(r.rewardCrystals);
                onToast(`交付完成！🪙+${r.rewardCoins} 💎+${r.rewardCrystals}`);
                onDirty();
                setTick((t) => t + 1);
              }}>交付</button>
            )}
          </div>
        );
      })}
      <div style={{ fontSize: 11, color: "#8a7a6a" }}>訂單每日刷新，💎 與遊戲中心的抽卡水晶共用。</div>
    </div>
  );

  const renderBag = () => (
    <div>
      {invEntries.length === 0 && <div style={{ fontSize: 12, color: "#8a7a6a" }}>背包空空如也。</div>}
      {invEntries.map(([id, n]) => {
        const m = itemMeta(id);
        return (
          <div key={id} style={rowStyle}>
            <span style={{ fontSize: 20 }}>{m.icon}</span>
            <span style={{ flex: 1, fontSize: 13 }}><b>{m.name}</b> ×{n}</span>
            <span style={{ fontSize: 11, color: "#8a7a6a" }}>參考價 🪙{m.sellPrice}</span>
          </div>
        );
      })}
    </div>
  );

  const tabs = [["furnace", "丹爐"], ["shelf", "貨架"], ["order", "訂單"], ["bag", "背包"]];
  return (
    <div style={{ textAlign: "left" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, border: 0, borderRadius: 10, padding: "7px 0", fontSize: 13, fontWeight: 700, cursor: "pointer",
            background: tab === id ? "#7d5a6e" : "#efe6da", color: tab === id ? "#fff" : "#6b5d4f",
          }}>{label}</button>
        ))}
      </div>
      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        {tab === "furnace" ? renderFurnace() : tab === "shelf" ? renderShelves() : tab === "order" ? renderOrders() : renderBag()}
      </div>
      <button onClick={onClose} style={{ width: "100%", marginTop: 12, border: 0, borderRadius: 12, padding: "9px 0", fontSize: 14, background: "#e8ddd0", color: "#6b5d4f", cursor: "pointer" }}>離開</button>
    </div>
  );
}
