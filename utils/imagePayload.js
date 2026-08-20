const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const DATA_URL_RE = /^data:([^;,]+);base64,([\s\S]*)$/i;

export function normalizeImageMimeType(value) {
  const mimeType = String(value || "").trim().toLowerCase();
  const normalized = mimeType === "image/jpg" ? "image/jpeg" : mimeType;
  return SUPPORTED_IMAGE_MIME_TYPES.has(normalized) ? normalized : "";
}

export function splitImageData(value) {
  const source = String(value || "").trim();
  const match = source.match(DATA_URL_RE);
  if (!match) return { data: source.replace(/\s+/g, ""), declaredMimeType: "" };
  return { data: match[2].replace(/\s+/g, ""), declaredMimeType: normalizeImageMimeType(match[1]) };
}

function decodeHeader(base64) {
  if (!base64) return new Uint8Array();
  try {
    const decoded = globalThis.atob(base64.slice(0, 32));
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  } catch (_) {
    return new Uint8Array();
  }
}

export function detectImageMimeType(value) {
  const bytes = decodeHeader(splitImageData(value).data);
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "image/gif";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return "";
}

export function normalizeImagePayload(value, declaredMimeType = "") {
  const split = splitImageData(value);
  if (!split.data) return null;
  return {
    data: split.data,
    mimeType: detectImageMimeType(split.data) || normalizeImageMimeType(declaredMimeType) || split.declaredMimeType || "image/png",
  };
}

export function toImageDataUrl(value, declaredMimeType = "") {
  const image = normalizeImagePayload(value, declaredMimeType);
  return image ? `data:${image.mimeType};base64,${image.data}` : "";
}
