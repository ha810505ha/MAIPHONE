// 暫時隱藏尚未完成的卡面與召喚入口；改為 true 即可重新開放。
const parseBooleanFlag = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
};

const readFeatureFlag = (name, fallback) => {
  const viteValue = import.meta.env?.[name];
  const nodeValue = typeof process !== "undefined" ? process.env?.[name] : undefined;
  return parseBooleanFlag(viteValue ?? nodeValue, fallback);
};

// 櫻色誓約（抽卡）自 1.5.0 起正式開放（小舞 2026-10-19）；特殊建置仍可設 VITE_GACHA_ENABLED=false 關閉。
export const GACHA_ENABLED = readFeatureFlag("VITE_GACHA_ENABLED", true);

// 信風仍在開發中。預設完全關閉；只有刻意設定
// VITE_DATING_ENABLED=true 的測試／預覽建置才會顯示。
export const DATING_ENABLED = readFeatureFlag("VITE_DATING_ENABLED", false);

// 商店 App（MP-051 第一階段，只收靈魂結晶）仍在開發中。預設關閉；
// 只有刻意設定 VITE_STORE_ENABLED=true 的測試／預覽建置才會顯示。
export const STORE_ENABLED = readFeatureFlag("VITE_STORE_ENABLED", false);

// 測試建置專用的系統信件（例如大量測試結晶）。預設關閉，正式建置絕不開啟；
// 只有 VITE_TEST_GRANTS_ENABLED=true 的私人測試站建置才會把 testOnly 信件放進信箱。
export const TEST_GRANTS_ENABLED = readFeatureFlag("VITE_TEST_GRANTS_ENABLED", false);

// 雲端帳號／同步已開放；特殊建置仍可明確設為 false 關閉。
export const SYNC_ENABLED = readFeatureFlag("VITE_SYNC_ENABLED", true);

// 舊版 Railway／自架後端的背景同步已由 Supabase + Cloudflare 手動文字同步取代。
// 僅供需要舊 /api/auth 與 /api/sync 路由的特殊自架版本明確開啟。
export const LEGACY_AUTO_SYNC_ENABLED = readFeatureFlag("VITE_LEGACY_AUTO_SYNC_ENABLED", false);

// 相簿算圖仍在開發中；false 時隱藏設定頁的圖像 API 區塊與相簿的生成入口。
export const IMAGE_GEN_ENABLED = readFeatureFlag("VITE_IMAGE_GEN_ENABLED", false);

// 雲端存檔上傳（MP-090，小舞 2026-10-28）：正式站 maliphone.com 只讀雲端、不上傳，
// 雲端存檔以手機 App 上傳為準，玩家逐步移轉到正式站時不會互相蓋來蓋去。
// 建置旗標可整包關閉（VITE_CLOUD_UPLOAD_ENABLED=false）；正式網域則在執行時直接判定，
// 同一份 dist 放到 GitHub Pages／測試站仍可上傳。
export const CLOUD_UPLOAD_ENABLED = readFeatureFlag("VITE_CLOUD_UPLOAD_ENABLED", true);
export const OFFICIAL_SITE_HOST_PATTERN = /(^|\.)maliphone\.com$/;

export function isCloudUploadAllowed({ hostname, flag = CLOUD_UPLOAD_ENABLED } = {}) {
  if (!flag) return false;
  const host = hostname ?? (typeof window !== "undefined" ? window.location?.hostname : "") ?? "";
  return !OFFICIAL_SITE_HOST_PATTERN.test(String(host || "").toLowerCase());
}

// 測試模型（文字）／測試 LLM（小舞 2026-10-28）：點數商店要上了，設定頁先拿掉這塊讓版面乾淨；
// 自帶 API（API 預設、AI 連線）照常。預設關；測試站要用就在建置時開 VITE_MALI_TEST_MODEL_ENABLED=true。
// 關閉時所有存檔／備份裡的 aiSource 一律視為 personal，舊玩家不會卡在看不到的測試模型上。
export const MALI_TEST_MODEL_ENABLED = readFeatureFlag("VITE_MALI_TEST_MODEL_ENABLED", false);

export function normalizeAiSource(source, enabled = MALI_TEST_MODEL_ENABLED) {
  return enabled && source === "hosted_test" ? "hosted_test" : "personal";
}
