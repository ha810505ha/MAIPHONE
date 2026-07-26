export const sanitizeCustomCss = (value) => {
  // 先移除註解與反斜線轉義，避免 @\69 mport 這類混淆繞過後面的規則。
  let css = String(value || "").slice(0, 30000)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\\(?:[0-9a-fA-F]{1,6}[ \t\r\n]?|[\s\S])/g, "");
  css = css
    .replace(/@import[^;{}]*(?:;|(?=[{}])|$)/gi, "")
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/javascript\s*:/gi, "");
  // url() 採白名單：只允許 data:image 與相對路徑，任何帶 scheme 或 // 開頭的外部位址一律拒絕。
  css = css.replace(/url\s*\(\s*(['"]?)([\s\S]*?)\1\s*\)/gi, (match, _quote, target) => {
    const trimmed = target.trim();
    if (/^data:image\//i.test(trimmed)) return match;
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(trimmed)) return "none";
    return match;
  });
  css = css.replace(/(?:-webkit-)?image-set\s*\(([^)]*)\)/gi, (match, inner) =>
    (/\/\//.test(inner) ? "none" : match));
  return css;
};

// 括號防呆：多一個 } 會逃出 @scope 汙染整個畫面，未閉合則會吃掉後面的規則。
export const hasBalancedBraces = (css) => {
  let depth = 0;
  let quote = "";
  for (const ch of String(css || "")) {
    if (quote) { if (ch === quote) quote = ""; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "{") depth += 1;
    else if (ch === "}") { depth -= 1; if (depth < 0) return false; }
  }
  return depth === 0;
};

export const scopeCustomCss = (value) => {
  const safeCss = sanitizeCustomCss(value);
  if (!safeCss.trim() || !hasBalancedBraces(safeCss)) return "";

  // Older Android WebViews discard an unknown @scope rule together with all of
  // its contents. Keep scoped CSS on modern engines and preserve custom CSS as
  // a functional fallback on older installed devices.
  if (typeof globalThis.CSSScopeRule === "undefined") return safeCss;

  // @scope 內的類別選擇器只匹配後代、命中不到 scoping root 自己，
  // 因此把 .mp-phone 與 :root 改寫成 :scope，讓變數與根樣式覆寫真的生效。
  const rewritten = safeCss
    .replace(/\.mp-phone(?![\w-])/g, ":scope")
    .replace(/:root(?![\w-])/g, ":scope");
  return `@scope (.mp-phone) { ${rewritten} }`;
};
