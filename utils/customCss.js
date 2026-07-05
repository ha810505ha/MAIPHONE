export const sanitizeCustomCss = (value) => String(value || "")
  .slice(0, 30000)
  .replace(/@import[\s\S]*?;/gi, "")
  .replace(/url\s*\(\s*(['"]?)https?:[\s\S]*?\1\s*\)/gi, "none")
  .replace(/expression\s*\([^)]*\)/gi, "")
  .replace(/javascript\s*:/gi, "");
