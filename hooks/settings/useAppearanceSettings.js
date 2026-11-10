import { useEffect, useMemo, useState } from "react";
import { scopeCustomCss } from "../../utils/customCss";
import { THEME_PRESETS } from "../../styles/themePresets";

function readStorage(key, fallback) {
  try { const value = localStorage.getItem(key); return value === null ? fallback : value; } catch { return fallback; }
}

export default function useAppearanceSettings(defaults) {
  // 主題名稱在本機多存一份：IndexedDB 要非同步讀完才知道主題，啟動那一瞬間會先用預設的莓果蘇打畫待機畫面。
  // 這裡只是啟動快取，讀完存檔後仍以 hydration 的值為準。
  const [themeName, setThemeName] = useState(() => {
    const cached = readStorage("mali_theme_name", "");
    return THEME_PRESETS[cached] ? cached : defaults.themeName;
  });
  const [fontName, setFontName] = useState(defaults.fontName);
  const [fontSizeScale, setFontSizeScale] = useState(defaults.fontSizeScale || "normal");
  const [customFontName, setCustomFontName] = useState(() => readStorage("mali_custom_font", ""));
  const [uiLanguage, setUiLanguage] = useState(defaults.uiLanguage);
  const [themeEffectsEnabled, setThemeEffectsEnabled] = useState(() => readStorage("mali_theme_effects", "1") !== "0");
  const [customCssEnabled, setCustomCssEnabled] = useState(() => readStorage("mali_custom_css_enabled", "0") === "1");
  const [customCss, setCustomCss] = useState(() => readStorage("mali_custom_css", ""));
  const [customCssDraft, setCustomCssDraft] = useState(() => readStorage("mali_custom_css", ""));
  const [customCssNotice, setCustomCssNotice] = useState("");
  const [customCssGuideOpen, setCustomCssGuideOpen] = useState(false);

  useEffect(() => { try { localStorage.setItem("mali_theme_name", themeName || ""); } catch {} }, [themeName]);
  useEffect(() => { try { localStorage.setItem("mali_theme_effects", themeEffectsEnabled ? "1" : "0"); } catch {} }, [themeEffectsEnabled]);
  useEffect(() => { try { localStorage.setItem("mali_custom_css_enabled", customCssEnabled ? "1" : "0"); } catch {} }, [customCssEnabled]);
  useEffect(() => { try { localStorage.setItem("mali_custom_font", customFontName || ""); } catch {} }, [customFontName]);

  const scopedCustomCss = useMemo(() => (customCssEnabled ? scopeCustomCss(customCss) : ""), [customCssEnabled, customCss]);
  return { themeName, setThemeName, fontName, setFontName, fontSizeScale, setFontSizeScale, customFontName, setCustomFontName, uiLanguage, setUiLanguage, themeEffectsEnabled, setThemeEffectsEnabled, customCssEnabled, setCustomCssEnabled, customCss, setCustomCss, customCssDraft, setCustomCssDraft, customCssNotice, setCustomCssNotice, customCssGuideOpen, setCustomCssGuideOpen, scopedCustomCss };
}
