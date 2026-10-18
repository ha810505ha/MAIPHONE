import { normalizeUiLanguage } from "./i18n.js";

// 公開隱私權政策（public/privacy.html，Pages 以 /privacy 提供）。
// Google OAuth 品牌驗證要求首頁可見此連結；設定「關於」區也連到同一頁。
// 網頁版一律開同網域的 /privacy（GitHub Pages、測試站、正式站各有一份）。
// APK 沒有網址可用，暫時改開 GitHub Pages：正式站 maliphone.com 尚未公開（小舞 2026-10-19），公開後再改回。
export const PRIVACY_URL_PROD = "https://ha810505ha.github.io/MAIPHONE/privacy";

// 服務條款（public/terms.html）走同一套網址規則。
export const TERMS_URL_PROD = "https://ha810505ha.github.io/MAIPHONE/terms";

// 正式網域 maliphone.com 尚未公開（小舞 2026-10-19）：GitHub Pages 上不顯示會露出網域的客服信箱。
// APK、正式站、測試站與本機照常顯示。
export function canShowOfficialContact() {
  if (Boolean(globalThis.Capacitor?.isNativePlatform?.())) return true;
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  return /(^|\.)maliphone\.com$|^maliphone(-test)?\.pages\.dev$|^localhost$|^127\.0\.0\.1$/.test(host);
}

function getPublicPageUrl(pageName, prodUrl) {
  const lang = normalizeUiLanguage(typeof document !== "undefined" ? document.documentElement.lang : "");
  let base = prodUrl;
  try {
    const isNative = Boolean(globalThis.Capacitor?.isNativePlatform?.());
    if (!isNative && typeof window !== "undefined") {
      base = new URL(`${import.meta.env?.BASE_URL || "/"}${pageName}`, window.location.origin).toString();
    }
  } catch {
    base = prodUrl;
  }
  return `${base}?lang=${encodeURIComponent(lang)}`;
}

export function getPrivacyUrl() {
  return getPublicPageUrl("privacy", PRIVACY_URL_PROD);
}

export function getTermsUrl() {
  return getPublicPageUrl("terms", TERMS_URL_PROD);
}
