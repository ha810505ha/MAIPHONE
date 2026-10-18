// 櫻誓召喚前置演出影片（MP-069）。原檔屬本機私有素材，不進 Git：
// dev 走 /__local-gacha-fx/，正式版預設走 R2（assets.maliphone.com，支援 iPhone 需要的分段下載），
// VITE_GACHA_FX_BASE_URL 可改指其他位置；影片載入失敗時演出退回 CSS 動畫。
export const GACHA_FX_PROD_BASE_URL = "https://assets.maliphone.com/gacha/fx";
const fxBase = String(import.meta.env?.VITE_GACHA_FX_BASE_URL || (import.meta.env?.DEV ? "/__local-gacha-fx" : GACHA_FX_PROD_BASE_URL)).replace(/\/$/, "");

export const SUMMON_FX_FILES = Object.freeze({ petals: "summon-petals.mp4", golden: "summon-golden.mp4" });
// 抽卡畫面背景音樂（小舞 2026-10-18 提供 Gentle Sway），和影片放同一個資料夾／網址。
export const GACHA_BGM_FILE = "gacha-bgm.m4a";

export function resolveGachaBgm() {
  return fxBase ? `${fxBase}/${GACHA_BGM_FILE}` : null;
}

// 進抽卡頁時先把兩支影片拉進快取，召喚時才不會先卡一段灰底（Android WebView 的預設畫面）。
let preloaded = false;
export function preloadSummonVideos() {
  if (preloaded || !fxBase || typeof document === "undefined") return;
  preloaded = true;
  Object.values(SUMMON_FX_FILES).forEach((file) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.src = `${fxBase}/${file}`;
    video.load?.();
  });
}

// R／SR 用花瓣版，SSR 用金色版。
export function resolveSummonVideo(rarity) {
  if (!fxBase) return null;
  return `${fxBase}/${rarity === "SSR" ? SUMMON_FX_FILES.golden : SUMMON_FX_FILES.petals}`;
}
