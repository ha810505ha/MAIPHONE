import manifest from "./cardArtManifest.json" with { type: "json" };

// 正式卡圖放在公開圖庫 R2（assets.maliphone.com）；dev 用本機私有素材，特殊建置可用環境變數改指其他位置。
export const GACHA_ART_PROD_BASE_URL = "https://assets.maliphone.com/gacha/cards";
const assetBase = String(import.meta.env?.VITE_GACHA_ART_BASE_URL || (import.meta.env?.DEV ? "/__local-gacha-art" : GACHA_ART_PROD_BASE_URL)).replace(/\/$/, "");

// Resolve artwork at display time so older inventory snapshots retain their content.
export function withGachaCardArt(card) {
  const entry = card && manifest[card.id];
  if (!entry || !assetBase) return card;
  return { ...card, art: `${assetBase}/${entry.image}`, artThumbnail: `${assetBase}/${entry.thumbnail}`, framedArt: undefined };
}
