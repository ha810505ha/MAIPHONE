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

// 櫻色誓約（抽卡）自 1.5.0 起正式開放（2026-10-19）；特殊建置仍可設 VITE_GACHA_ENABLED=false 關閉。
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

// 雲端存檔上傳：建置旗標可整包關閉（VITE_CLOUD_UPLOAD_ENABLED=false）。
// 2026-10-28 曾讓正式站 maliphone.com 只讀雲端（MP-090）；2026-10-29 改為「正式站直接開同步」（MP-094），
// 網頁版登入後自動上傳，所以正式網域不再擋上傳；OFFICIAL_SITE_HOST_PATTERN 保留給其他判斷用。
export const CLOUD_UPLOAD_ENABLED = readFeatureFlag("VITE_CLOUD_UPLOAD_ENABLED", true);
export const OFFICIAL_SITE_HOST_PATTERN = /(^|\.)maliphone\.com$/;

// 正式站（maliphone.com／www.maliphone.com）要像一般 AI 聊天平台：登入就載入雲端、變動自動上傳、沒有手動雲端按鈕（2026-10-29）。
// GitHub Pages、測試站、localhost 與原生 App 仍保留手動按鈕。hostname／native 可注入給測試用。
export function isOfficialSite({ hostname, native } = {}) {
  const isNative = native ?? (typeof window !== "undefined" && Boolean(window.Capacitor?.isNativePlatform?.()));
  if (isNative) return false;
  const host = hostname ?? (typeof location !== "undefined" ? location.hostname : "");
  return OFFICIAL_SITE_HOST_PATTERN.test(String(host || "").trim().toLowerCase());
}

export function isCloudUploadAllowed({ flag = CLOUD_UPLOAD_ENABLED } = {}) {
  return Boolean(flag);
}

// 網頁版自動同步（MP-094）：登入後資料有變動就自動上傳（最多每 5 分鐘一次），雲端較新時只提示、不自動覆蓋本機。
// APP（Capacitor 原生）不自動同步：決定 APP 之後拔掉雲端、改用檔案匯入匯出轉移。
export const CLOUD_AUTO_SYNC_ENABLED = readFeatureFlag("VITE_CLOUD_AUTO_SYNC_ENABLED", true);

export function isCloudAutoSyncAvailable({ flag = CLOUD_AUTO_SYNC_ENABLED, uploadFlag = CLOUD_UPLOAD_ENABLED, native } = {}) {
  if (!flag || !uploadFlag) return false;
  const isNative = native ?? (typeof window !== "undefined" && Boolean(window.Capacitor?.isNativePlatform?.()));
  return !isNative;
}

// 測試模型（文字）／測試 LLM（2026-10-28）：點數商店要上了，設定頁先拿掉這塊讓版面乾淨；
// 自帶 API（API 預設、AI 連線）照常。預設關；測試站要用就在建置時開 VITE_MALI_TEST_MODEL_ENABLED=true。
// 關閉時所有存檔／備份裡的 aiSource 一律視為 personal，舊玩家不會卡在看不到的測試模型上。
export const MALI_TEST_MODEL_ENABLED = readFeatureFlag("VITE_MALI_TEST_MODEL_ENABLED", false);

export function normalizeAiSource(source, enabled = MALI_TEST_MODEL_ENABLED) {
  return enabled && source === "hosted_test" ? "hosted_test" : "personal";
}
