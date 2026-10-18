import { normalizeUiLanguage } from "./i18n.js";

// 公開隱私權政策（public/privacy.html，Pages 以 /privacy 提供）。
// Google OAuth 品牌驗證要求首頁可見此連結；設定「關於」區也連到同一頁。
// 網頁版一律開同網域的 /privacy（GitHub Pages、測試站、正式站各有一份）。
// APK 沒有網址可用，暫時改開 GitHub Pages：正式站 maliphone.com 尚未公開（小舞 2026-10-19），公開後再改回。
export const PRIVACY_URL_PROD = "https://ha810505ha.github.io/MAIPHONE/privacy";

// 服務條款（public/terms.html）走同一套網址規則。
export const TERMS_URL_PROD = "https://ha810505ha.github.io/MAIPHONE/terms";

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
