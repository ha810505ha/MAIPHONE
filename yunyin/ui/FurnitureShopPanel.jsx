import React, { useState } from "react";
import { FURNITURE_CATALOG } from "../home/furnitureCatalog";
import { isFurnitureUnlocked, purchaseFurniture } from "../home/furnitureOwnership";
import { FURNITURE_IMAGES } from "../data/assetUrls";
import { useYunyinLocale } from "../i18n/YunyinLocale.jsx";

// 家具縮圖：優先秀真實素材貼圖，讓玩家看得出實際外觀（不同顏色/款式的家具常共用同一個 emoji，
// 光看 icon 根本分不出差異）；沒登記圖片的家具才退回 icon。
function FurnitureThumb({ item, displayName, size = 40 }) {
  const src = FURNITURE_IMAGES[item.id];
  if (!src) return <span style={{ fontSize: size * 0.55 }}>{item.icon}</span>;
  return <img src={src} alt={displayName || item.name} style={{ width: size, height: size, objectFit: "contain", imageRendering: "pixelated" }} />;
}

const rowStyle = { display: "flex", alignItems: "center", gap: 8, border: "1px solid #e2d6c6", borderRadius: 12, padding: "9px 10px", marginBottom: 8, background: "#fff" };

const priceText = (price) => price?.crystals ? `💎 ${price.crystals}` : `🪙 ${price?.coins || 0}`;

const CATEGORY_LABEL_KEYS = { bed: "furniture.categoryBed", table: "furniture.categoryTable", chair: "furniture.categoryChair", storage: "furniture.categoryStorage", kitchen: "furniture.categoryKitchen", bath: "furniture.categoryBath", fitness: "furniture.categoryFitness", rug: "furniture.categoryRug", decor: "furniture.categoryDecor" };
const CATEGORY_ORDER = ["bed", "table", "chair", "storage", "kitchen", "bath", "fitness", "rug", "decor"];

// 丹房櫃台：家具解鎖制購買。解鎖後回家開佈置模式即可擺放（有各自的擺放上限）。
export default function FurnitureShopPanel({ save, crystals, onCrystals, onDirty, onToast, onClose }) {
  const { yt, yv, ym } = useYunyinLocale();
  const [, setTick] = useState(0);
  const allItems = Object.values(FURNITURE_CATALOG).filter((item) => item.price);
  const categories = CATEGORY_ORDER.filter((cat) => allItems.some((item) => item.category === cat));
  const [tab, setTab] = useState(categories[0] || "decor");
  const items = allItems.filter((item) => item.category === tab);

  const buy = (item) => {
    const result = purchaseFurniture({ save, crystals, furnitureId: item.id });
    if (result.error) { onToast(ym(result.error)); return; }
    if (result.cost.crystals > 0) onCrystals(-result.cost.crystals, {
      source: "furniture",
      note: yt("furniture.purchaseNote", { name: yv(item.name) }),
    });
    if (save.blueprints?.[item.id]) delete save.blueprints[item.id]; // 圖紙用掉
    onDirty();
    setTick((t) => t + 1);
    onToast(yt("furniture.unlockedToast", { icon: item.icon, name: yv(item.name) }));
  };

  return (
    <div style={{ textAlign: "left" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto" }}>
        {categories.map((cat) => (
          <button key={cat} onClick={() => setTab(cat)} style={{
            flex: "0 0 auto", border: 0, borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
            background: tab === cat ? "#7d5a6e" : "#efe6da", color: tab === cat ? "#fff" : "#6b5d4f",
          }}>{CATEGORY_LABEL_KEYS[cat] ? yt(CATEGORY_LABEL_KEYS[cat]) : cat}</button>
        ))}
      </div>
      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        {items.map((item) => {
          const unlocked = isFurnitureUnlocked(save.home, item.id);
          const needBlueprint = item.requiresBlueprint && !save.blueprints?.[item.id] && !unlocked;
          const affordable = item.price.crystals ? crystals >= item.price.crystals : save.coins >= item.price.coins;
          return (
            <div key={item.id} style={{ ...rowStyle, opacity: needBlueprint ? 0.6 : 1 }}>
              <span style={{ width: 40, height: 40, display: "grid", placeItems: "center", flexShrink: 0 }}><FurnitureThumb item={item} displayName={yv(item.name)} /></span>
              <span style={{ flex: 1 }}>
                <b style={{ fontSize: 14 }}>{yv(item.name)}{item.requiresBlueprint && " 📜"}</b>
                <span style={{ display: "block", fontSize: 11, color: "#8a7a6a" }}>
                  {needBlueprint ? yt("furniture.blueprintRequired") : yt("furniture.limit", { price: priceText(item.price), count: item.maxCount })}
                </span>
              </span>
              {unlocked ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: "#3d7a5c" }}>{yt("common.unlocked")}</span>
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
        {items.length === 0 && <div style={{ fontSize: 12, color: "#8a7a6a" }}>{yt("furniture.emptyCategory")}</div>}
      </div>
      <div style={{ fontSize: 11, color: "#8a7a6a", marginTop: 4 }}>{yt("furniture.hint")}</div>
      <button onClick={onClose} style={{ width: "100%", marginTop: 10, border: 0, borderRadius: 12, padding: "9px 0", fontSize: 14, background: "#e8ddd0", color: "#6b5d4f", cursor: "pointer" }}>{yt("common.leave")}</button>
    </div>
  );
}
