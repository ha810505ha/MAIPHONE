const MAX_REDACTION_KEYWORDS = 32;
const MAX_REDACTION_KEYWORD_LENGTH = 64;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function normalizeScreenshotRedactionKeywords(value) {
  const seen = new Set();
  return String(value || "")
    .split(/[\n,，]+/)
    .map((item) => item.trim().slice(0, MAX_REDACTION_KEYWORD_LENGTH))
    .filter((item) => {
      if (!item) return false;
      const key = item.toLocaleLowerCase();
      if (seen.has(key) || seen.size >= MAX_REDACTION_KEYWORDS) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => right.length - left.length);
}

export function redactScreenshotText(value, keywords, mask = "ＯＯ") {
  const source = String(value ?? "");
  if (!source || !keywords?.length) return source;
  const pattern = keywords.map(escapeRegExp).join("|");
  return pattern ? source.replace(new RegExp(pattern, "giu"), mask) : source;
}

export function containsScreenshotRedactionKeyword(value, keywords) {
  if (!keywords?.length) return false;
  const source = String(value || "").toLocaleLowerCase();
  return keywords.some((keyword) => source.includes(String(keyword).toLocaleLowerCase()));
}
