export const CLOUD_MEDIA_PREFIX = "maliphone-media:";
const MEDIA_NAME_RE = /^sha256-[a-f0-9]{64}\.(webp|jpg|png)$/;

export function getCloudMediaName(ref) {
  if (typeof ref !== "string" || !ref.startsWith(CLOUD_MEDIA_PREFIX)) return null;
  const name = ref.slice(CLOUD_MEDIA_PREFIX.length);
  return MEDIA_NAME_RE.test(name) ? name : null;
}

export function isCloudMediaRef(value) {
  return typeof value === "string" && value.startsWith(CLOUD_MEDIA_PREFIX);
}

export function getCloudMediaKind(key, inherited = "") {
  const normalized = String(key || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (normalized.includes("avatar")) return "avatar";
  if (normalized.includes("background") || normalized.includes("wallpaper")) return "background";
  // Other media fields remain local, including when nested inside a background.
  if (["image", "photo", "thumbnail", "cover", "hero", "banner"].some((name) => normalized.includes(name))) return "";
  return inherited;
}
