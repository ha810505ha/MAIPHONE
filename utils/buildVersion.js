// 每次正式建置的版本號（vite.config.js 以 define 注入，同時輸出 version.json）。
// 開發模式沒有注入，視為 "dev"，不做線上版本比對。
/* global __MALIPHONE_BUILD__ */
export const BUILD_ID = typeof __MALIPHONE_BUILD__ !== "undefined" ? __MALIPHONE_BUILD__ : "dev";

const RELOAD_GUARD_KEY = "mali_build_reload_target";

/**
 * 讀線上 version.json；發現比目前執行的版本新，就重新載入一次。
 * 同一個目標版本只重載一次（sessionStorage 記錄），避免網路或快取異常時無限重載。
 */
export async function reloadIfNewBuild({ baseUrl = "/", fetchImpl = fetch, storage = sessionStorage, reload = () => window.location.reload() } = {}) {
  if (BUILD_ID === "dev") return false;
  let latest = "";
  try {
    // 加時間參數：舊版 Service Worker 對這類請求是快取優先，網址每次不同才會真的連網。
    const response = await fetchImpl(`${baseUrl}version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!response?.ok) return false;
    latest = String((await response.json())?.build || "").trim();
  } catch {
    return false;
  }
  if (!latest || latest === BUILD_ID) return false;
  try {
    if (storage.getItem(RELOAD_GUARD_KEY) === latest) return false;
    storage.setItem(RELOAD_GUARD_KEY, latest);
  } catch {
    return false;
  }
  reload();
  return true;
}
