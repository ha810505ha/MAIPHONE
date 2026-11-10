let convertTaiwanToChina = null;
let converterLoadPromise = null;

// OpenCC handles most Taiwan-to-mainland wording. These product/UI terms need
// a small final pass because their preferred wording is context-specific.
const ZH_CN_UI_REPLACEMENTS = [
  ["本应用程式", "本应用程序"],
  ["应用程式", "应用程序"],
  ["行动设备", "移动设备"],
  ["行动装置", "移动设备"],
  ["系统信箱", "系统邮箱"],
  ["信箱", "邮箱"],
  ["帐号", "账号"],
  ["预设", "默认"],
  ["目前", "当前"],
  ["取得", "获取"],
  ["贴文", "帖子"],
  ["全域", "全局"],
  ["品质", "质量"],
  ["激活", "启用"],
  ["算图", "图像生成"],
];

export const SUPPORTED_UI_LANGUAGES = Object.freeze(["zh-TW", "zh-CN", "en", "ja", "ko"]);

export function loadSimplifiedChineseConverter() {
  if (convertTaiwanToChina) return Promise.resolve(convertTaiwanToChina);
  if (!converterLoadPromise) {
    converterLoadPromise = import("opencc-js/t2cn").then(({ default: OpenCC }) => {
      convertTaiwanToChina = OpenCC.Converter({ from: "twp", to: "cn" });
      return convertTaiwanToChina;
    });
  }
  return converterLoadPromise;
}

export function toSimplifiedChinese(value) {
  if (typeof value !== "string" || !value) return value;
  let converted = convertTaiwanToChina ? convertTaiwanToChina(value) : value;
  for (const [source, target] of ZH_CN_UI_REPLACEMENTS) {
    converted = converted.replaceAll(source, target);
  }
  return converted;
}

export function normalizeUiLanguage(value, fallback = "zh-TW") {
  return SUPPORTED_UI_LANGUAGES.includes(value) ? value : fallback;
}

export function translate(locale, zhOrTranslations, en, ja, ko, zhCN) {
  if (
    zhOrTranslations
    && typeof zhOrTranslations === "object"
    && !Array.isArray(zhOrTranslations)
    && (
      Object.hasOwn(zhOrTranslations, "zh-TW")
      || Object.hasOwn(zhOrTranslations, "zh-CN")
      || Object.hasOwn(zhOrTranslations, "en")
    )
  ) {
    const translations = zhOrTranslations;
    if (locale === "zh-CN") {
      return translations["zh-CN"] ?? toSimplifiedChinese(translations["zh-TW"] ?? "");
    }
    return translations[locale] ?? translations["zh-TW"] ?? "";
  }

  if (locale === "zh-CN") return zhCN ?? toSimplifiedChinese(zhOrTranslations);
  return {
    "zh-TW": zhOrTranslations,
    en,
    ja,
    ko,
  }[locale] ?? zhOrTranslations;
}

export function localizeFallbackText(locale, value) {
  return locale === "zh-CN" ? toSimplifiedChinese(value) : value;
}

export function localizeCurrentUiText(value) {
  if (typeof document === "undefined") return value;
  return localizeFallbackText(document.documentElement.lang, value);
}

export function confirmLocalized(value) {
  return window.confirm(localizeCurrentUiText(value));
}
