// Saves a JSON payload to a user-visible location and reports where it landed.
// On native Android the WebView ignores anchor `download` attributes, so files
// must be written through the Capacitor Filesystem plugin instead.

const sanitizeFilename = (filename) =>
  String(filename || "maliphone-export.json").replace(/[^a-zA-Z0-9._-]/g, "_");

const JSON_STRING_SLICE = 64 * 1024;
const JSON_FILE_CHUNK = 256 * 1024;

function* serializeJsonValue(value, ancestors, key = "") {
  if (value && typeof value === "object" && typeof value.toJSON === "function") value = value.toJSON(key);

  if (value === null) { yield "null"; return; }
  if (typeof value === "string") {
    yield "\"";
    for (let start = 0; start < value.length;) {
      let end = Math.min(value.length, start + JSON_STRING_SLICE);
      const lastCode = value.charCodeAt(end - 1);
      if (end < value.length && lastCode >= 0xD800 && lastCode <= 0xDBFF) end += 1;
      yield JSON.stringify(value.slice(start, end)).slice(1, -1);
      start = end;
    }
    yield "\"";
    return;
  }
  if (typeof value === "number") { yield Number.isFinite(value) ? JSON.stringify(value) : "null"; return; }
  if (typeof value === "boolean") { yield value ? "true" : "false"; return; }
  if (typeof value === "bigint") throw new TypeError("Do not know how to serialize a BigInt");
  if (typeof value !== "object") return;
  if (ancestors.has(value)) throw new TypeError("Converting circular structure to JSON");

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      yield "[";
      for (let index = 0; index < value.length; index += 1) {
        if (index) yield ",";
        const item = value[index];
        if (item === undefined || typeof item === "function" || typeof item === "symbol") yield "null";
        else yield* serializeJsonValue(item, ancestors, String(index));
      }
      yield "]";
      return;
    }

    yield "{";
    let first = true;
    for (const property of Object.keys(value)) {
      const item = value[property];
      if (item === undefined || typeof item === "function" || typeof item === "symbol") continue;
      if (!first) yield ",";
      first = false;
      yield JSON.stringify(property);
      yield ":";
      yield* serializeJsonValue(item, ancestors, property);
    }
    yield "}";
  } finally {
    ancestors.delete(value);
  }
}

// Produces valid JSON in bounded pieces. Native Android can append these pieces
// directly to disk instead of holding one huge JSON string (and a second bridge
// copy of it) in WebView memory.
export function* serializeJsonChunks(payload, maxChunkLength = JSON_FILE_CHUNK) {
  if (payload === undefined || typeof payload === "function" || typeof payload === "symbol") {
    throw new TypeError("Payload is not JSON serializable");
  }
  const limit = Math.max(JSON_STRING_SLICE, Number(maxChunkLength) || JSON_FILE_CHUNK);
  let buffer = "";
  for (const fragment of serializeJsonValue(payload, new Set())) {
    if (buffer && buffer.length + fragment.length > limit) {
      yield buffer;
      buffer = "";
    }
    buffer += fragment;
  }
  if (buffer) yield buffer;
}

const ensureFilesystemPermission = async (Filesystem) => {
  // Android 10 and below need the publicStorage permission to write to the
  // shared Documents folder; newer versions grant it implicitly.
  try {
    const status = await Filesystem.checkPermissions();
    if (status.publicStorage === "granted") return;
    await Filesystem.requestPermissions();
  } catch {}
};

export async function downloadJsonFile(payload, filename) {
  if (window.Capacitor?.isNativePlatform?.()) {
    let Filesystem;
    let Directory;
    let safeName;
    try {
      const plugin = await import("@capacitor/filesystem");
      ({ Filesystem, Directory } = plugin);
      const { Encoding } = plugin;
      await ensureFilesystemPermission(Filesystem);
      safeName = sanitizeFilename(filename);
      let first = true;
      for (const data of serializeJsonChunks(payload)) {
        if (first) {
          await Filesystem.writeFile({ path: safeName, data, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
          first = false;
        } else {
          await Filesystem.appendFile({ path: safeName, data, directory: Directory.Documents, encoding: Encoding.UTF8 });
        }
      }
      if (first) throw new TypeError("Payload is not JSON serializable");
      return { method: "native-filesystem", path: safeName };
    } catch (error) {
      console.warn("[export] native filesystem unavailable, falling back", error);
      if (Filesystem && Directory && safeName) {
        try { await Filesystem.deleteFile({ path: safeName, directory: Directory.Documents }); } catch {}
      }
    }
  }

  // Compact JSON is substantially smaller for browser downloads. Browsers do
  // not expose an append-to-user-file API, so they retain the single-string
  // fallback used outside the native Android app.
  const jsonText = JSON.stringify(payload);
  if (jsonText === undefined) throw new TypeError("Payload is not JSON serializable");

  // Android WebView does not always honor an anchor's `download` attribute.
  // Prefer the native share/save sheet there so the user can explicitly choose
  // a destination (Files, Drive, messaging app, etc.). Desktop/mobile browsers
  // without file sharing continue to use the normal download flow below.
  const blob = new Blob([jsonText], { type: "application/json" });
  const isNativeAndroid = !!window.Capacitor?.isNativePlatform?.() || /Android/i.test(navigator.userAgent || "");
  if (isNativeAndroid && typeof navigator.share === "function" && typeof File === "function") {
    try {
      const file = new File([blob], filename, { type: "application/json" });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return { method: "share" };
      }
    } catch (error) {
      // Closing the share sheet is not an export failure. For unsupported or
      // rejected shares, fall through to the regular browser download.
      if (error?.name === "AbortError") return { method: "cancelled" };
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return { method: "download" };
}

export async function downloadTextFile(text, filename, mimeType = "text/plain;charset=utf-8") {
  const safeName = sanitizeFilename(filename);
  const content = String(text ?? "");
  if (window.Capacitor?.isNativePlatform?.()) {
    try {
      const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
      await ensureFilesystemPermission(Filesystem);
      await Filesystem.writeFile({ path: safeName, data: content, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
      return { method: "native-filesystem", path: safeName };
    } catch (error) {
      console.warn("[export] native text export unavailable, falling back", error);
    }
  }
  const blob = new Blob([content], { type: mimeType });
  const isNativeAndroid = !!window.Capacitor?.isNativePlatform?.() || /Android/i.test(navigator.userAgent || "");
  if (isNativeAndroid && typeof navigator.share === "function" && typeof File === "function") {
    try {
      const file = new File([blob], safeName, { type: mimeType });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: safeName });
        return { method: "share" };
      }
    } catch (error) {
      if (error?.name === "AbortError") return { method: "cancelled" };
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return { method: "download" };
}

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

// Saves a binary image blob with the same platform fallbacks as JSON exports:
// Capacitor filesystem (base64) → native share sheet → anchor download.
export async function downloadImageFile(blob, filename, { preferBrowserDownload = false } = {}) {
  const safeName = sanitizeFilename(filename);
  if (window.Capacitor?.isNativePlatform?.()) {
    try {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      await ensureFilesystemPermission(Filesystem);
      const data = await blobToBase64(blob);
      await Filesystem.writeFile({ path: safeName, data, directory: Directory.Documents, recursive: true });
      return { method: "native-filesystem", path: safeName };
    } catch (error) {
      console.warn("[export] native filesystem unavailable, falling back", error);
    }
  }
  const isNativeAndroid = !!window.Capacitor?.isNativePlatform?.() || /Android/i.test(navigator.userAgent || "");
  if (!preferBrowserDownload && isNativeAndroid && typeof navigator.share === "function" && typeof File === "function") {
    try {
      const file = new File([blob], safeName, { type: blob.type || "image/png" });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: safeName });
        return { method: "share" };
      }
    } catch (error) {
      if (error?.name === "AbortError") return { method: "cancelled" };
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return { method: "download" };
}

// Builds the success toast for an export result, including the on-device
// location when one is known. Returns null when no toast should be shown
// (e.g. the user dismissed the share sheet).
export function exportToastMessage(result, tr) {
  if (result?.method === "cancelled") return null;
  if (result?.method === "native-filesystem") {
    const location = `Documents/${result.path}`;
    return tr(`已匯出到 ${location}`, `Exported to ${location}`, `${location} に書き出しました`, `${location}(으)로 내보냈습니다`);
  }
  return tr("已匯出", "Exported", "書き出しました", "내보냈습니다");
}
