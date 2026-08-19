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

// Keep the current production defaults while allowing builds and tests to opt in explicitly.
export const GACHA_ENABLED = readFeatureFlag("VITE_GACHA_ENABLED", false);

// 信風仍在開發中。預設完全關閉；只有刻意設定
// VITE_DATING_ENABLED=true 的測試／預覽建置才會顯示。
export const DATING_ENABLED = readFeatureFlag("VITE_DATING_ENABLED", false);

// 雲端帳號／同步已開放；特殊建置仍可明確設為 false 關閉。
export const SYNC_ENABLED = readFeatureFlag("VITE_SYNC_ENABLED", true);

// 相簿算圖仍在開發中；false 時隱藏設定頁的圖像 API 區塊與相簿的生成入口。
export const IMAGE_GEN_ENABLED = readFeatureFlag("VITE_IMAGE_GEN_ENABLED", false);
