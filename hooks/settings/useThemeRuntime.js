import { FONT_PRESETS, THEME_PRESETS } from "../../styles/maliPhoneCss";
import { buildThemeCss } from "../../styles/themeCss";

export default function useThemeRuntime({ themeName, fontName, currentApp, themeEffectsEnabled, scopedCustomCss }) {
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
  const activeFontStack = (FONT_PRESETS[fontName] || FONT_PRESETS["圓體"]).stack;
  const themeCss = buildThemeCss({
    activeTheme,
    activeFontStack,
    isNightTheme,
    isPeachTheme,
    hasPeachEffects,
    themeEffectsEnabled,
    showThemeEffects,
    normalizedThemeName,
    scopedCustomCss,
  });

  return { normalizedThemeName, activeTheme, isNightTheme, isPeachTheme, hasPeachEffects, showThemeEffects, activeFontStack, themeCss };
}
