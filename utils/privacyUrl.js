import { normalizeUiLanguage } from "./i18n.js";

// 公開隱私權政策（public/privacy.html，Pages 以 /privacy 提供）。
// Google OAuth 品牌驗證要求首頁可見此連結；設定「關於」區也連到同一頁。
// 網頁版連同網域的 /privacy（測試站、正式站各自對應）；APK 內沒有這個網址，改開正式站。
export const PRIVACY_URL_PROD = "https://maliphone.com/privacy";

// 服務條款（public/terms.html）走同一套網址規則。
export const TERMS_URL_PROD = "https://maliphone.com/terms";

function getPublicPageUrl(pageName, prodUrl) {
  const lang = normalizeUiLanguage(typeof document !== "undefined" ? document.documentElement.lang : "");
  let base = prodUrl;
  try {
    const isNative = Boolean(globalThis.Capacitor?.isNativePlatform?.());
    // 法律頁只部署在正式站與測試站（public/legal 不進公開 repo），其他網域（例如 GitHub Pages）一律連正式站。
    const host = typeof window !== "undefined" ? window.location.hostname : "";
    const hasLegalPages = /(^|\.)maliphone\.com$|^maliphone(-test)?\.pages\.dev$|^localhost$|^127\.0\.0\.1$/.test(host);
    if (!isNative && hasLegalPages) {
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
