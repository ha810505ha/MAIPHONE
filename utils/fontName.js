// 使用者填的字型名稱會被塞進 CSS 的 --mp-font，必須擋掉分號、大括號等字元，
// 否則 `Arial; color: red` 這種輸入就會變成注入一條新宣告。
export const sanitizeFontName = (value) => String(value || "")
  .replace(/[^\w\sÀ-ɏ぀-ヿ一-鿿豈-﫿-]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, 40);

// 自訂字型排在最前面，後面接原本的預設堆疊當後備：
// 使用者裝置上沒裝這個字型時，會自動退回預設字體而不是變成系統襯線字。
export const buildFontStack = (customName, presetStack) => {
  const safe = sanitizeFontName(customName);
  return safe ? `"${safe}",${presetStack}` : presetStack;
};
