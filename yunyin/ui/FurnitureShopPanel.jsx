import React, { useState } from "react";
import { FURNITURE_CATALOG } from "../home/furnitureCatalog";
import { isFurnitureUnlocked, purchaseFurniture } from "../home/furnitureOwnership";
import { FURNITURE_IMAGES } from "../data/assetUrls";

// 家具縮圖：優先秀真實素材貼圖，讓玩家看得出實際外觀（不同顏色/款式的家具常共用同一個 emoji，
// 光看 icon 根本分不出差異）；沒登記圖片的家具才退回 icon。
function FurnitureThumb({ item, size = 40 }) {
  const src = FURNITURE_IMAGES[item.id];
  if (!src) return <span style={{ fontSize: size * 0.55 }}>{item.icon}</span>;
  return <img src={src} alt={item.name} style={{ width: size, height: size, objectFit: "contain", imageRendering: "pixelated" }} />;
}

const rowStyle = { display: "flex", alignItems: "center", gap: 8, border: "1px solid #e2d6c6", borderRadius: 12, padding: "9px 10px", marginBottom: 8, background: "#fff" };

const priceText = (price) => price?.crystals ? `💎 ${price.crystals}` : `🪙 ${price?.coins || 0}`;

const CATEGORY_LABELS = { bed: "床鋪", table: "桌案", chair: "椅凳", storage: "收納", kitchen: "廚具", bath: "衛浴", fitness: "健身", rug: "地毯", decor: "擺飾" };
const CATEGORY_ORDER = ["bed", "table", "chair", "storage", "kitchen", "bath", "fitness", "rug", "decor"];

// 丹房櫃台：家具解鎖制購買。解鎖後回家開佈置模式即可擺放（有各自的擺放上限）。
export default function FurnitureShopPanel({ save, crystals, onCrystals, onDirty, onToast, onClose }) {
  const [, setTick] = useState(0);
  const allItems = Object.values(FURNITURE_CATALOG).filter((item) => item.price);
  const categories = CATEGORY_ORDER.filter((cat) => allItems.some((item) => item.category === cat));
  const [tab, setTab] = useState(categories[0] || "decor");
  const items = allItems.filter((item) => item.category === tab);

  const buy = (item) => {
    const result = purchaseFurniture({ save, crystals, furnitureId: item.id });
    if (result.error) { onToast(result.error); return; }
    if (result.cost.crystals > 0) onCrystals(-result.cost.crystals, {
      source: "furniture",
      note: `雲隱山莊・購買家具「${item.name}」`,
    });
    if (save.blueprints?.[item.id]) delete save.blueprints[item.id]; // 圖紙用掉
    onDirty();
    setTick((t) => t + 1);
    onToast(`${item.icon} ${item.name} 已解鎖，回家佈置吧！`);
  };

  return (
    <div style={{ textAlign: "left" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto" }}>
        {categories.map((cat) => (
          <button key={cat} onClick={() => setTab(cat)} style={{
            flex: "0 0 auto", border: 0, borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
            background: tab === cat ? "#7d5a6e" : "#efe6da", color: tab === cat ? "#fff" : "#6b5d4f",
          }}>{CATEGORY_LABELS[cat] || cat}</button>
        ))}
      </div>
      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        {items.map((item) => {
          const unlocked = isFurnitureUnlocked(save.home, item.id);
          const needBlueprint = item.requiresBlueprint && !save.blueprints?.[item.id] && !unlocked;
          const affordable = item.price.crystals ? crystals >= item.price.crystals : save.coins >= item.price.coins;
          return (
            <div key={item.id} style={{ ...rowStyle, opacity: needBlueprint ? 0.6 : 1 }}>
              <span style={{ width: 40, height: 40, display: "grid", placeItems: "center", flexShrink: 0 }}><FurnitureThumb item={item} /></span>
              <span style={{ flex: 1 }}>
                <b style={{ fontSize: 14 }}>{item.name}{item.requiresBlueprint && " 📜"}</b>
                <span style={{ display: "block", fontSize: 11, color: "#8a7a6a" }}>
                  {needBlueprint ? "需要圖紙（秘境或稀有訂單取得）" : `${priceText(item.price)}・上限 ${item.maxCount} 件`}
                </span>
              </span>
              {unlocked ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: "#3d7a5c" }}>已解鎖</span>
              ) : (
                <button
                  disabled={needBlueprint || !affordable}
                  onClick={() => buy(item)}
                  style={{
                    border: 0, borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 700,
                    cursor: needBlueprint || !affordable ? "default" : "pointer",
                    opacity: needBlueprint || !affordable ? 0.55 : 1,
                    background: "linear-gradient(135deg,#7d5a6e,#9c7089)", color: "#fff",
                  }}
                >{priceText(item.price)}</button>
              )}
            </div>
          );
        })}
        {items.length === 0 && <div style={{ fontSize: 12, color: "#8a7a6a" }}>這個分類目前沒有商品。</div>}
      </div>
      <div style={{ fontSize: 11, color: "#8a7a6a", marginTop: 4 }}>購買後永久解鎖，回玩家小屋點 🛋️ 佈置。📜 為圖紙稀有件。</div>
      <button onClick={onClose} style={{ width: "100%", marginTop: 10, border: 0, borderRadius: 12, padding: "9px 0", fontSize: 14, background: "#e8ddd0", color: "#6b5d4f", cursor: "pointer" }}>離開</button>
    </div>
  );
}
