import { useEffect, useMemo, useState } from "react";
import { scopeCustomCss } from "../../utils/customCss";

function readStorage(key, fallback) {
  try { const value = localStorage.getItem(key); return value === null ? fallback : value; } catch { return fallback; }
}

export default function useAppearanceSettings(defaults) {
  const [themeName, setThemeName] = useState(defaults.themeName);
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
  const [settingsAppearanceOpen, setSettingsAppearanceOpen] = useState(() => readStorage("mali_settings_appearance_open", "1") !== "0");

  useEffect(() => { try { localStorage.setItem("mali_theme_effects", themeEffectsEnabled ? "1" : "0"); } catch {} }, [themeEffectsEnabled]);
  useEffect(() => { try { localStorage.setItem("mali_custom_css_enabled", customCssEnabled ? "1" : "0"); } catch {} }, [customCssEnabled]);
  useEffect(() => { try { localStorage.setItem("mali_settings_appearance_open", settingsAppearanceOpen ? "1" : "0"); } catch {} }, [settingsAppearanceOpen]);
  useEffect(() => { try { localStorage.setItem("mali_custom_font", customFontName || ""); } catch {} }, [customFontName]);

  const scopedCustomCss = useMemo(() => (customCssEnabled ? scopeCustomCss(customCss) : ""), [customCssEnabled, customCss]);
  return { themeName, setThemeName, fontName, setFontName, fontSizeScale, setFontSizeScale, customFontName, setCustomFontName, uiLanguage, setUiLanguage, themeEffectsEnabled, setThemeEffectsEnabled, customCssEnabled, setCustomCssEnabled, customCss, setCustomCss, customCssDraft, setCustomCssDraft, customCssNotice, setCustomCssNotice, customCssGuideOpen, setCustomCssGuideOpen, settingsAppearanceOpen, setSettingsAppearanceOpen, scopedCustomCss };
}
