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

// Dating remains configurable per build while staying available during active development.
export const DATING_ENABLED = readFeatureFlag("VITE_DATING_ENABLED", false);

// 雲端帳號／同步仍在開發中；false 時只使用本機 IndexedDB 與手動全域備份。
export const SYNC_ENABLED = readFeatureFlag("VITE_SYNC_ENABLED", false);

// 相簿算圖仍在開發中；false 時隱藏設定頁的圖像 API 區塊與相簿的生成入口。
export const IMAGE_GEN_ENABLED = readFeatureFlag("VITE_IMAGE_GEN_ENABLED", true);
