import React, { useEffect, useState } from "react";
import { RECIPES } from "../data/recipes";
import {
  itemMeta, recipeById, recipeUnlocked, maxBatch,
  startCraft, furnaceDone, collectFurnace, furnaceCount,
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

// lockTab：true 時只顯示 initialTab 對應的功能（不給切到其他站），符合「丹爐/貨架/訂單是三個不同實體」的動線；
// 背包改成獨立小按鈕，任一站都能查（純參考資訊，不算跨站功能）。
export default function ShopPanel({ save, onDirty, onToast, onCrystals, onClose, initialTab = "furnace", lockTab = false }) {
  const [tab, setTab] = useState(initialTab);
  const [showBag, setShowBag] = useState(false);
  const [, setTick] = useState(0);
  // 每個丹方自己記一個「這次想煉幾爐」，玩家用 +/- 調好一次送出，不用反覆點按鈕
  const [batchByRecipe, setBatchByRecipe] = useState({});

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
  const unlockedFurnaces = furnaceCount(save.cultivation);
  const hasIdleFurnace = save.shop.furnaces.slice(0, unlockedFurnaces).some((f) => !f.recipeId);

  // 爐位狀態卡：運轉中顯示進度與收取；空爐待命；未解鎖的第 2 爐顯示鎖定
  const renderFurnaceSlot = (f, idx) => {
    if (idx >= unlockedFurnaces) {
      return (
        <div key={idx} style={{ ...rowStyle, opacity: 0.55 }}>
          <span style={{ fontSize: 22 }}>🔒</span>
          <span style={{ flex: 1, fontSize: 12, color: "#8a7a6a" }}>第 {idx + 1} 座丹爐——突破至<b>築基期</b>後啟用，可同時煉兩爐</span>
        </div>
      );
    }
    if (!f.recipeId) {
      return (
        <div key={idx} style={{ ...rowStyle, opacity: 0.8 }}>
          <span style={{ fontSize: 22 }}>🔥</span>
          <span style={{ flex: 1, fontSize: 12, color: "#8a7a6a" }}>丹爐 {idx + 1}——空爐待命，從下方丹方開始煉製</span>
        </div>
      );
    }
    const r = recipeById(f.recipeId);
    const done = furnaceDone(f, now);
    const nextMin = done >= f.batch ? 0 : Math.ceil((f.startedAt + (done + 1) * r.craftMin * 60000 - now) / 60000);
    return (
      <div key={idx} style={rowStyle}>
        <span style={{ fontSize: 22 }}>{r.icon}</span>
        <span style={{ flex: 1 }}>
          <b style={{ fontSize: 14 }}>丹爐 {idx + 1}・{r.name}</b>
          <span style={{ display: "block", fontSize: 11, color: "#8a7a6a" }}>
            已煉好 {done} / {f.batch} 爐{done < f.batch && `・下一爐約 ${nextMin} 分`}
          </span>
        </span>
        <button
          style={btnStyle(true, done > 0)}
          disabled={done < 1}
          onClick={() => {
            const r2 = collectFurnace(save, idx);
            if (r2) { onToast(`${r2.recipe.icon} ${r2.recipe.name} ×${r2.count} 入袋`); onDirty(); setTick((t) => t + 1); }
          }}
        >收取</button>
      </div>
    );
  };

  const renderFurnace = () => {
    return (
      <div>
        {save.shop.furnaces.map((f, idx) => renderFurnaceSlot(f, idx))}
        <div style={{ borderTop: "1px dashed #ddd0c1", margin: "10px 0" }} />
        {RECIPES.map((r) => {
          const unlocked = recipeUnlocked(r, save.cultivation);
          const max = unlocked ? maxBatch(save, r) : 0;
          const inText = Object.entries(r.in).map(([k, n]) => `${itemMeta(k).icon}${itemMeta(k).name} ×${n}`).join(" + ");
          return (
            <div key={r.id} style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: 8, opacity: unlocked ? 1 : 0.55 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{r.icon}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 14 }}>{r.name}{!unlocked && " 🔒"}</b>
                  <span style={{ display: "block", fontSize: 11, color: "#8a7a6a" }}>
                    {inText} → 賣 🪙{r.sellPrice}・每爐 {r.craftMin} 分
                  </span>
                </span>
              </div>
              {unlocked && max >= 1 && (() => {
                const batch = Math.min(Math.max(1, batchByRecipe[r.id] || 1), max);
                const setBatch = (n) => setBatchByRecipe((prev) => ({ ...prev, [r.id]: Math.min(Math.max(1, n), max) }));
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                    <button style={{ ...btnStyle(false), padding: "6px 10px" }} disabled={batch <= 1} onClick={() => setBatch(batch - 1)}>−</button>
                    <span style={{ minWidth: 22, textAlign: "center", fontWeight: 700, fontSize: 13 }}>{batch}</span>
                    <button style={{ ...btnStyle(false), padding: "6px 10px" }} disabled={batch >= max} onClick={() => setBatch(batch + 1)}>＋</button>
                    <button style={{ ...btnStyle(false), padding: "6px 8px", fontSize: 11 }} disabled={batch >= max} onClick={() => setBatch(max)}>最大</button>
                    <button style={{ ...btnStyle(true, hasIdleFurnace), marginLeft: 4 }} disabled={!hasIdleFurnace} onClick={() => {
                      const err = startCraft(save, r.id, batch);
                      if (err) onToast(err); else { onToast(`${r.icon} 開始煉製 ×${batch}`); onDirty(); setBatchByRecipe((prev) => ({ ...prev, [r.id]: 1 })); }
                      setTick((t) => t + 1);
                    }}>煉製</button>
                  </div>
                );
              })()}
              {unlocked && max < 1 && <div style={{ fontSize: 11, color: "#b0a494", textAlign: "right" }}>材料不足</div>}
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
      <div style={{ fontSize: 11, color: "#8a7a6a" }}>貨架每 {Math.round(SELL_INTERVAL_SEC / 60)} 分鐘自動賣出 1 件，離線也照賣；貨架不產出靈魂結晶。</div>
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
                報酬 🪙{o.rewardCoins} + 💎{o.rewardCrystals}{o.rewardBlueprint ? " + 📜圖紙" : ""}{o.rewardMaterials ? ` + ${itemMeta(o.rewardMaterials.id).icon}×${o.rewardMaterials.n}` : ""}（持有 {inv[o.itemId] || 0}）
              </span>
            </span>
            {o.done ? (
              <span style={{ fontSize: 12, fontWeight: 700, color: "#3d7a5c" }}>已交付</span>
            ) : (
              <button style={btnStyle(true, enough)} disabled={!enough} onClick={() => {
                const r = deliverOrder(save, o.id);
                if (typeof r === "string") { onToast(r); return; }
                onCrystals(r.rewardCrystals, { note: `雲隱山莊・行商訂單「${m.name}」` });
                onToast(`交付完成！🪙+${r.rewardCoins} 💎+${r.rewardCrystals}${r.blueprintName ? `，獲得 📜${r.blueprintName}圖紙` : ""}${r.materials ? `，獲得 ${itemMeta(r.materials.id).icon}${itemMeta(r.materials.id).name}×${r.materials.n}` : ""}`);
                onDirty();
                setTick((t) => t + 1);
              }}>交付</button>
            )}
          </div>
        );
      })}
      <div style={{ fontSize: 11, color: "#8a7a6a" }}>訂單每日更新，💎 與遊戲中心的抽卡水晶共用。</div>
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
  const renderTab = (id) => id === "furnace" ? renderFurnace() : id === "shelf" ? renderShelves() : id === "order" ? renderOrders() : renderBag();

  return (
    <div style={{ textAlign: "left" }}>
      {lockTab ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <b style={{ flex: 1, fontSize: 15, color: "#4e4438" }}>{tabs.find(([id]) => id === initialTab)?.[1]}</b>
          <button onClick={() => setShowBag((v) => !v)} style={{
            border: 0, borderRadius: 10, padding: "6px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer",
            background: showBag ? "#7d5a6e" : "#efe6da", color: showBag ? "#fff" : "#6b5d4f",
          }}>🎒 背包</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              flex: 1, border: 0, borderRadius: 10, padding: "7px 0", fontSize: 13, fontWeight: 700, cursor: "pointer",
              background: tab === id ? "#7d5a6e" : "#efe6da", color: tab === id ? "#fff" : "#6b5d4f",
            }}>{label}</button>
          ))}
        </div>
      )}
      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        {lockTab ? (showBag ? renderBag() : renderTab(initialTab)) : renderTab(tab)}
      </div>
      <button onClick={onClose} style={{ width: "100%", marginTop: 12, border: 0, borderRadius: 12, padding: "9px 0", fontSize: 14, background: "#e8ddd0", color: "#6b5d4f", cursor: "pointer" }}>離開</button>
    </div>
  );
}
