import React, { useState } from "react";
import { withGachaCardArt } from "../../data/gacha/cardArt.js";

// 櫻色誓約卡片的圓形縮圖（小舞 2026-10-19：已選卡片用圓形卡圖＋稀有度邊框，其他列表比照）。
// 依卡片 ID 在顯示時解析卡圖，舊存檔也能補上；沒有卡圖或載入失敗才退回原本的圖示。
export const GACHA_RARITY_RING = Object.freeze({ SSR: "#f4d574", SR: "#e9a1ca", R: "#aeb9ea" });

export default function GachaItemThumb({ itemId, rarity, icon, size = 46, ring = true, className = "", style }) {
  const [failed, setFailed] = useState(false);
  const resolved = itemId ? withGachaCardArt({ id: itemId }) : null;
  const src = !failed && (resolved?.artThumbnail || resolved?.art);
  return <span
    className={`sg-item-thumb ${className}`.trim()}
    aria-hidden="true"
    style={{
      width: size,
      height: size,
      flex: `0 0 ${size}px`,
      display: "grid",
      placeItems: "center",
      borderRadius: "50%",
      overflow: "hidden",
      boxSizing: "border-box",
      border: ring ? `2.5px solid ${GACHA_RARITY_RING[rarity] || GACHA_RARITY_RING.R}` : "none",
      background: "var(--mp-surface)",
      fontSize: Math.round(size * 0.5),
      lineHeight: 1,
      ...style,
    }}
  >
    {src ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : (icon || "🌸")}
  </span>;
}
