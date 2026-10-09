import { useEffect, useMemo } from "react";
import { FONT_PRESETS, THEME_PRESETS } from "../../styles/themePresets";
import { buildThemeCss } from "../../styles/themeCss";
import { buildFontStack } from "../../utils/fontName";

export default function useThemeRuntime({ themeName, fontName, fontSizeScale, customFontName, currentApp, themeEffectsEnabled, scopedCustomCss }) {
  const normalizedThemeName = themeName === "湖水藍"
    ? "海鹽汽水"
    : themeName === "蜜桃手帳"
      ? "蜜桃慕斯"
      : themeName;
  const activeTheme = THEME_PRESETS[normalizedThemeName] || THEME_PRESETS["莓果蘇打"];
  const isNightTheme = normalizedThemeName === "夜色絨幕";
  const hasPeachEffects = normalizedThemeName === "蜜桃慕斯";
  // 現有桌面與聊天樣式皆以這組共用結構為基礎；名稱沿用以維持元件相容性。
  const isPeachTheme = true;
  const showThemeEffects = !currentApp;
  const activeFontStack = buildFontStack(customFontName, (FONT_PRESETS[fontName] || FONT_PRESETS["圓體"]).stack);
  const themeCss = useMemo(() => buildThemeCss({
    activeTheme,
    activeFontStack,
    fontSizeScale,
    isNightTheme,
    isPeachTheme,
    hasPeachEffects,
    themeEffectsEnabled,
    showThemeEffects,
    normalizedThemeName,
    scopedCustomCss,
  }), [activeTheme, activeFontStack, fontSizeScale, isNightTheme, hasPeachEffects, themeEffectsEnabled, showThemeEffects, normalizedThemeName, scopedCustomCss]);

  // 瀏覽器網址列／加到主畫面後的頂端狀態列顏色（index.html 的 theme-color）原本固定莓果粉，改成跟著主題。
  // 淺色主題用主題主色（莓果仍是原本的 #f48fb1）；夜色用深底，避免深色畫面上方一條亮粉。
  const statusBarColor = isNightTheme ? "#1A1625" : (activeTheme.vars?.["--mp-pink"] || "#f48fb1");
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", statusBarColor);
  }, [statusBarColor]);

  return { normalizedThemeName, activeTheme, isNightTheme, isPeachTheme, hasPeachEffects, showThemeEffects, activeFontStack, themeCss };
}
