import React, { useEffect, useState } from "react";
import { RECIPES } from "../data/recipes";
import {
  itemMeta, recipeById, recipeUnlocked, maxBatch,
  startCraft, furnaceDone, collectFurnace, furnaceCount,
  stockShelfQuantity, unstockShelf, settleShelves, SELL_INTERVAL_SEC,
  deliverOrder,
} from "../systems/shop";
import { useYunyinLocale } from "../i18n/YunyinLocale.jsx";

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
  const { yt, yv, ym } = useYunyinLocale();
  const [tab, setTab] = useState(initialTab);
  const [showBag, setShowBag] = useState(false);
  const [, setTick] = useState(0);
  // 每個丹方自己記一個「這次想煉幾爐」，玩家用 +/- 調好一次送出，不用反覆點按鈕
  const [batchByRecipe, setBatchByRecipe] = useState({});
  // 空貨架先選商品，再選上架數量；每座貨架保留自己的暫存選擇。
  const [shelfDrafts, setShelfDrafts] = useState({});

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
          <span style={{ flex: 1, fontSize: 12, color: "#8a7a6a" }}>{yt("shop.furnaceLocked", { number: idx + 1 })}</span>
        </div>
      );
    }
    if (!f.recipeId) {
      return (
        <div key={idx} style={{ ...rowStyle, opacity: 0.8 }}>
          <span style={{ fontSize: 22 }}>🔥</span>
          <span style={{ flex: 1, fontSize: 12, color: "#8a7a6a" }}>{yt("shop.furnaceIdle", { number: idx + 1 })}</span>
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
          <b style={{ fontSize: 14 }}>{yt("shop.furnaceTitle", { number: idx + 1, name: yv(r.name) })}</b>
          <span style={{ display: "block", fontSize: 11, color: "#8a7a6a" }}>
            {yt("shop.furnaceProgress", { done, total: f.batch })}{done < f.batch && ` · ${yt("shop.nextBatch", { minutes: nextMin })}`}
          </span>
        </span>
        <button
          style={btnStyle(true, done > 0)}
          disabled={done < 1}
          onClick={() => {
            const r2 = collectFurnace(save, idx);
            if (r2) { onToast(yt("shop.collected", { icon: r2.recipe.icon, name: yv(r2.recipe.name), count: r2.count })); onDirty(); setTick((t) => t + 1); }
          }}
        >{yt("common.collect")}</button>
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
          const inText = Object.entries(r.in).map(([k, n]) => `${itemMeta(k).icon}${yv(itemMeta(k).name)} ×${n}`).join(" + ");
          return (
            <div key={r.id} style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: 8, opacity: unlocked ? 1 : 0.55 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{r.icon}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 14 }}>{yv(r.name)}{!unlocked && " 🔒"}</b>
                  <span style={{ display: "block", fontSize: 11, color: "#8a7a6a" }}>
                    {yt("shop.recipeDetails", { ingredients: inText, price: r.sellPrice, minutes: r.craftMin })}
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
                    <button style={{ ...btnStyle(false), padding: "6px 8px", fontSize: 11 }} disabled={batch >= max} onClick={() => setBatch(max)}>{yt("common.max")}</button>
                    <button style={{ ...btnStyle(true, hasIdleFurnace), marginLeft: 4 }} disabled={!hasIdleFurnace} onClick={() => {
                      const err = startCraft(save, r.id, batch);
                      if (err) onToast(ym(err)); else { onToast(yt("shop.craftingStarted", { icon: r.icon, count: batch })); onDirty(); setBatchByRecipe((prev) => ({ ...prev, [r.id]: 1 })); }
                      setTick((t) => t + 1);
                    }}>{yt("shop.craft")}</button>
                  </div>
                );
              })()}
              {unlocked && max < 1 && <div style={{ fontSize: 11, color: "#b0a494", textAlign: "right" }}>{yt("shop.insufficientMaterials")}</div>}
            </div>
          );
        })}
        <div style={{ fontSize: 11, color: "#8a7a6a" }}>{yt("shop.recipeHint")}</div>
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
                <b style={{ fontSize: 14 }}>{yv(m.name)} ×{sh.stock}</b>
                <span style={{ display: "block", fontSize: 11, color: "#8a7a6a" }}>
                  {yt("shop.shelfSale", { price: m.sellPrice, time: nextSec >= 60 ? yt("shop.minutes", { value: Math.ceil(nextSec / 60) }) : yt("shop.seconds", { value: nextSec }) })}
                </span>
              </span>
              <button style={btnStyle(false)} onClick={() => { unstockShelf(save, idx); onDirty(); setTick((t) => t + 1); }}>{yt("shop.unstock")}</button>
            </div>
          );
        }
        const shelfKey = String(sh.id ?? idx);
        const draft = shelfDrafts[shelfKey];
        const selectedItemId = draft?.itemId;
        const selectedHave = selectedItemId ? (inv[selectedItemId] || 0) : 0;
        const selectedMeta = selectedItemId ? itemMeta(selectedItemId) : null;
        const selectedQuantity = Math.min(
          selectedHave,
          Math.max(1, Math.trunc(Number(draft?.quantity) || 1)),
        );
        const setSelectedQuantity = (quantity) => {
          const nextQuantity = Math.min(
            selectedHave,
            Math.max(1, Math.trunc(Number(quantity) || 1)),
          );
          setShelfDrafts((current) => ({
            ...current,
            [shelfKey]: { ...current[shelfKey], quantity: nextQuantity },
          }));
        };
        const clearShelfDraft = () => {
          setShelfDrafts((current) => {
            const next = { ...current };
            delete next[shelfKey];
            return next;
          });
        };
        return (
          <div key={sh.id} style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch" }}>
            <div style={{ fontSize: 12, color: "#8a7a6a", marginBottom: invEntries.length ? 6 : 0 }}>
              {yt(selectedMeta && selectedHave > 0 ? "shop.emptyShelfQuantity" : "shop.emptyShelfItem", { number: sh.id + 1 })}
            </div>
            {invEntries.length === 0 ? (
              <div style={{ fontSize: 11, color: "#b0a494" }}>{yt("shop.noSellableItems")}</div>
            ) : selectedMeta && selectedHave > 0 ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 22 }}>{selectedMeta.icon}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ display: "block", fontSize: 13 }}>{yv(selectedMeta.name)}</b>
                    <small style={{ color: "#8a7a6a" }}>{yt("shop.inventoryOwned", { count: selectedHave })}</small>
                  </span>
                  <button style={{ ...btnStyle(false), padding: "6px 9px", fontSize: 11 }} onClick={clearShelfDraft}>{yt("shop.reselect")}</button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                  <button style={{ ...btnStyle(false), padding: "7px 11px" }} disabled={selectedQuantity <= 1} onClick={() => setSelectedQuantity(selectedQuantity - 1)}>−</button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max={selectedHave}
                    value={selectedQuantity}
                    aria-label={yt("shop.stockQuantity", { name: yv(selectedMeta.name) })}
                    onChange={(event) => setSelectedQuantity(event.target.value)}
                    onFocus={(event) => event.target.select()}
                    style={{
                      width: 58, boxSizing: "border-box", border: "1px solid #d8c9b8", borderRadius: 10,
                      padding: "7px 5px", background: "#fff", color: "#5d5147", textAlign: "center", fontSize: 13, fontWeight: 700,
                    }}
                  />
                  <button style={{ ...btnStyle(false), padding: "7px 11px" }} disabled={selectedQuantity >= selectedHave} onClick={() => setSelectedQuantity(selectedQuantity + 1)}>＋</button>
                  <button style={{ ...btnStyle(false), padding: "7px 9px", fontSize: 11 }} disabled={selectedQuantity >= selectedHave} onClick={() => setSelectedQuantity(selectedHave)}>{yt("shop.all")}</button>
                  <button style={{ ...btnStyle(true), marginLeft: "auto" }} onClick={() => {
                    const err = stockShelfQuantity(save, idx, selectedItemId, selectedQuantity);
                    if (err) {
                      onToast(ym(err));
                    } else {
                      onToast(yt("shop.stocked", { icon: selectedMeta.icon, name: yv(selectedMeta.name), count: selectedQuantity }));
                      clearShelfDraft();
                      onDirty();
                    }
                    setTick((t) => t + 1);
                  }}>{yt("shop.stock")}</button>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {invEntries.map(([id, n]) => {
                  const m = itemMeta(id);
                  return (
                    <button key={id} style={btnStyle(false)} onClick={() => {
                      setShelfDrafts((current) => ({
                        ...current,
                        [shelfKey]: { itemId: id, quantity: 1 },
                      }));
                    }}>{m.icon}{yv(m.name)} ×{n}</button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <div style={{ fontSize: 11, color: "#8a7a6a" }}>{yt("shop.shelfHint", { minutes: Math.round(SELL_INTERVAL_SEC / 60) })}</div>
    </div>
  );

  const renderOrders = () => (
    <div>
      {save.shop.orders.length === 0 && <div style={{ fontSize: 12, color: "#8a7a6a" }}>{yt("shop.noOrders")}</div>}
      {save.shop.orders.map((o) => {
        const m = itemMeta(o.itemId);
        const enough = (inv[o.itemId] || 0) >= o.count;
        const tierKey = { "普通": "shop.tierNormal", "進階": "shop.tierAdvanced", "稀有": "shop.tierRare" }[o.tier];
        const tierLabel = tierKey ? yt(tierKey) : o.tier;
        return (
          <div key={o.id} style={{ ...rowStyle, opacity: o.done ? 0.5 : 1 }}>
            <span style={{ fontSize: 22 }}>{m.icon}</span>
            <span style={{ flex: 1 }}>
              <b style={{ fontSize: 14 }}>{tierLabel ? `【${tierLabel}】` : ""}{yv(m.name)} ×{o.count}</b>
              <span style={{ display: "block", fontSize: 11, color: "#8a7a6a" }}>
                {yt("shop.orderReward", { coins: o.rewardCoins, crystals: o.rewardCrystals, extras: `${o.rewardBlueprint ? yt("shop.blueprintExtra") : ""}${o.rewardMaterials ? ` + ${itemMeta(o.rewardMaterials.id).icon}×${o.rewardMaterials.n}` : ""}`, owned: inv[o.itemId] || 0 })}
              </span>
            </span>
            {o.done ? (
              <span style={{ fontSize: 12, fontWeight: 700, color: "#3d7a5c" }}>{yt("shop.delivered")}</span>
            ) : (
              <button style={btnStyle(true, enough)} disabled={!enough} onClick={() => {
                const r = deliverOrder(save, o.id);
                if (typeof r === "string") { onToast(ym(r)); return; }
                onCrystals(r.rewardCrystals, { note: yt("shop.orderNote", { name: yv(m.name) }) });
                const extras = `${r.blueprintName ? yt("shop.gainedBlueprint", { name: yv(r.blueprintName) }) : ""}${r.materials ? yt("shop.gainedMaterial", { icon: itemMeta(r.materials.id).icon, name: yv(itemMeta(r.materials.id).name), count: r.materials.n }) : ""}`;
                onToast(yt("shop.deliveryComplete", { coins: r.rewardCoins, crystals: r.rewardCrystals, extras }));
                onDirty();
                setTick((t) => t + 1);
              }}>{yt("shop.deliver")}</button>
            )}
          </div>
        );
      })}
      <div style={{ fontSize: 11, color: "#8a7a6a" }}>{yt("shop.orderHint")}</div>
    </div>
  );

  const renderBag = () => (
    <div>
      {invEntries.length === 0 && <div style={{ fontSize: 12, color: "#8a7a6a" }}>{yt("shop.bagEmpty")}</div>}
      {invEntries.map(([id, n]) => {
        const m = itemMeta(id);
        return (
          <div key={id} style={rowStyle}>
            <span style={{ fontSize: 20 }}>{m.icon}</span>
            <span style={{ flex: 1, fontSize: 13 }}><b>{yv(m.name)}</b> ×{n}</span>
            <span style={{ fontSize: 11, color: "#8a7a6a" }}>{yt("shop.referencePrice", { price: m.sellPrice })}</span>
          </div>
        );
      })}
    </div>
  );

  const tabs = [["furnace", yt("shop.tabFurnace")], ["shelf", yt("shop.tabShelf")], ["order", yt("shop.tabOrder")], ["bag", yt("shop.tabBag")]];
  const renderTab = (id) => id === "furnace" ? renderFurnace() : id === "shelf" ? renderShelves() : id === "order" ? renderOrders() : renderBag();

  return (
    <div style={{ textAlign: "left" }}>
      {lockTab ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <b style={{ flex: 1, fontSize: 15, color: "#4e4438" }}>{tabs.find(([id]) => id === initialTab)?.[1]}</b>
          <button onClick={() => setShowBag((v) => !v)} style={{
            border: 0, borderRadius: 10, padding: "6px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer",
            background: showBag ? "#7d5a6e" : "#efe6da", color: showBag ? "#fff" : "#6b5d4f",
          }}>🎒 {yt("shop.tabBag")}</button>
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
      <button onClick={onClose} style={{ width: "100%", marginTop: 12, border: 0, borderRadius: 12, padding: "9px 0", fontSize: 14, background: "#e8ddd0", color: "#6b5d4f", cursor: "pointer" }}>{yt("common.leave")}</button>
    </div>
  );
}
