const CHAT_BACKGROUND_MAX_BYTES = 1500 * 1024;
const CHAT_BACKGROUND_MAX_EDGES = [1600, 1400, 1200, 1000, 820];
const CHAT_BACKGROUND_QUALITIES = [0.82, 0.74, 0.66, 0.58, 0.5];

export function normalizeChatBackground(bg, sanitizeImageUrl) {
  if (!bg) return { src: "", x: 0, y: 0, zoom: 1, blur: 0 };
  if (typeof bg === "string") return { src: sanitizeImageUrl(bg) || "", x: 0, y: 0, zoom: 1, blur: 0 };
  return {
    src: sanitizeImageUrl(bg?.src || bg?.url || "") || "",
    x: Number.isFinite(Number(bg?.x)) ? Number(bg.x) : 0,
    y: Number.isFinite(Number(bg?.y)) ? Number(bg.y) : 0,
    zoom: Number.isFinite(Number(bg?.zoom)) ? Number(bg.zoom) : 1,
    blur: Number.isFinite(Number(bg?.blur)) ? Number(bg.blur) : 0,
  };
}

export function getChatBackgroundLayerStyle(bg, normalizeBackground, extraScale = 1, fitAxis = "height") {
  const normalized = normalizeBackground(bg);
  const zoom = Math.max(1, Math.min(2.2, Number(normalized.zoom) || 1));
  const scaledZoom = zoom * Math.max(1, Number(extraScale) || 1);
  return {
    position: "absolute",
    inset: 0,
    backgroundImage: `url(${normalized.src})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: fitAxis === "width" ? `calc(100% * ${scaledZoom}) auto` : `auto calc(100% * ${scaledZoom})`,
    backgroundPosition: `${50 + (Number(normalized.x) || 0)}% ${50 + (Number(normalized.y) || 0)}%`,
    pointerEvents: "none",
  };
}

export function getChatBackgroundBlurFilter(bg, normalizeBackground) {
  const normalized = normalizeBackground(bg);
  return `blur(${Math.max(0, Math.min(24, Number(normalized.blur) || 0))}px) saturate(.92) brightness(.96)`;
}

export function compressChatBackgroundFile(file, { sanitizeImageUrl, onSuccess, onError }) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const safe = sanitizeImageUrl(String(reader.result || ""));
    if (!safe) return onError("unsupported");
    const image = new Image();
    image.onload = () => {
      let picked = null;
      const bytesFromDataUrl = (dataUrl) => Math.ceil(Math.max(0, String(dataUrl || "").length - String(dataUrl || "").indexOf(",") - 1) * 0.75);
      for (const maxEdge of CHAT_BACKGROUND_MAX_EDGES) {
        const scale = Math.max(image.width, image.height) > maxEdge ? maxEdge / Math.max(image.width, image.height) : 1;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) return onError("processing");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        for (const quality of CHAT_BACKGROUND_QUALITIES) {
          const output = canvas.toDataURL("image/jpeg", quality);
          picked = { output, bytes: bytesFromDataUrl(output) };
          if (picked.bytes <= CHAT_BACKGROUND_MAX_BYTES) break;
        }
        if (picked?.bytes <= CHAT_BACKGROUND_MAX_BYTES) break;
      }
      if (!picked || picked.bytes > CHAT_BACKGROUND_MAX_BYTES) return onError("too_large");
      const output = sanitizeImageUrl(picked.output);
      if (!output) return onError("processing");
      onSuccess(output);
    };
    image.onerror = () => onError("load");
    image.src = safe;
  };
  reader.onerror = () => onError("load");
  reader.readAsDataURL(file);
}
