// 相簿圖片儲存：獨立於 maliphone_db，避免與 app state 搶 DB 版本號。
// 圖片本體（Blob）與描述資料（meta）分兩個 store：
//   images  key=id  { id, blob, mimeType }
//   meta    key=id  { id, prompt, provider, model, charId, favorite, createdAt, ... }
// 列表只讀 meta（很輕），Blob 等到真的要顯示才取，九宮格才不會一次撈幾十 MB。

const DB_NAME = "maliphone_gallery";
const DB_VERSION = 1;
const IMAGE_STORE = "images";
const META_STORE = "meta";
// 算圖 API 設定也放這裡，刻意不走 saveFeatureEntity —— 那會把資料推進 sync outbox，
// API Key 不該進同步佇列。
const CONFIG_STORE = "config";
const IMAGE_API_KEY = "imageApi";

// 壓縮階梯：由大往小試，第一個進得了預算的就採用。
const GALLERY_MAX_BYTES = 400 * 1024;
const GALLERY_MAX_EDGES = [1536, 1280, 1024, 896, 768];
const GALLERY_QUALITIES = [0.86, 0.78, 0.7, 0.62, 0.54];

// 同一張圖片可同時出現在縮圖與預覽；引用計數避免其中一個元件卸載時讓另一個 <img> 失效。
const objectUrlCache = new Map();
const objectUrlLoads = new Map();
let objectUrlGeneration = 0;

function newId() {
  try {
    if (globalThis.crypto?.randomUUID) return `img_${globalThis.crypto.randomUUID()}`;
  } catch (_) {
    // 某些 WebView 沒有 randomUUID，往下走 fallback。
  }
  return `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        const store = db.createObjectStore(META_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
        store.createIndex("charId", "charId");
      }
      if (!db.objectStoreNames.contains(CONFIG_STORE)) {
        db.createObjectStore(CONFIG_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("相簿資料庫開啟失敗"));
  });
}

function runTx(storeNames, mode, work) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    let result;
    try {
      result = work(tx);
    } catch (err) {
      db.close();
      reject(err);
      return;
    }
    tx.oncomplete = () => {
      db.close();
      resolve(typeof result === "function" ? result() : result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("相簿資料庫操作失敗"));
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error("相簿資料庫操作中止"));
    };
  }));
}

function reqValue(req) {
  return () => req.result ?? null;
}

// === 壓縮 ===

let webpSupport = null;
function supportsWebp() {
  if (webpSupport != null) return webpSupport;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    webpSupport = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch (_) {
    webpSupport = false;
  }
  return webpSupport;
}

function canvasToBlob(canvas, mimeType, quality) {
  if (typeof canvas.convertToBlob === "function") {
    return canvas.convertToBlob({ type: mimeType, quality }).catch(() => null);
  }
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("圖片解碼失敗"));
    image.src = src;
  });
}

function createResizeCanvas(width, height) {
  if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function yieldToRenderer() {
  if (globalThis.scheduler?.yield) {
    await globalThis.scheduler.yield();
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function toObjectSource(source) {
  if (typeof source === "string") return { src: source, revoke: null };
  const url = URL.createObjectURL(source);
  return { src: url, revoke: () => URL.revokeObjectURL(url) };
}

async function decodeGallerySource(source) {
  if (typeof Blob !== "undefined" && source instanceof Blob && typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close?.(),
      };
    } catch (_) {
      // 舊 WebView 的 createImageBitmap 可能存在但不支援該格式，退回 Image 元素。
    }
  }
  const { src, revoke } = await toObjectSource(source);
  try {
    const image = await loadImageElement(src);
    return { image, width: image.naturalWidth || image.width, height: image.naturalHeight || image.height, release: revoke };
  } catch (error) {
    revoke?.();
    throw error;
  }
}

/**
 * 把生成結果壓成 WebP（不支援時退回 JPEG）。
 * source 可以是 Blob 或 data URL / object URL 字串。
 */
export async function compressImageForGallery(source, options = {}) {
  const maxBytes = Number(options.maxBytes) > 0 ? Number(options.maxBytes) : GALLERY_MAX_BYTES;
  const mimeType = supportsWebp() ? "image/webp" : "image/jpeg";
  const decoded = await decodeGallerySource(source);
  try {
    let picked = null;
    const canvas = createResizeCanvas(1, 1);
    for (const maxEdge of GALLERY_MAX_EDGES) {
      const longest = Math.max(decoded.width, decoded.height);
      const scale = longest > maxEdge ? maxEdge / longest : 1;
      canvas.width = Math.max(1, Math.round(decoded.width * scale));
      canvas.height = Math.max(1, Math.round(decoded.height * scale));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Canvas 不可用");
      context.drawImage(decoded.image, 0, 0, canvas.width, canvas.height);
      for (const quality of GALLERY_QUALITIES) {
        const blob = await canvasToBlob(canvas, mimeType, quality);
        if (!blob) continue;
        picked = { blob, width: canvas.width, height: canvas.height };
        if (blob.size <= maxBytes) break;
      }
      if (picked && picked.blob.size <= maxBytes) break;
      await yieldToRenderer();
    }
    if (!picked) throw new Error("圖片壓縮失敗");
    return { blob: picked.blob, mimeType, width: picked.width, height: picked.height, bytes: picked.blob.size };
  } finally {
    decoded.release?.();
  }
}

// === 讀寫 ===

/**
 * 存一張生成圖。預設會先壓縮；已經壓過的可傳 compress: false。
 * 回傳 meta（不含 Blob），可直接放進畫面 state。
 */
export async function saveGalleryImage(input) {
  const source = input?.blob || input?.dataUrl || input?.src;
  if (!source) throw new Error("沒有可儲存的圖片");

  const processed = input?.compress === false && input?.blob
    ? { blob: input.blob, mimeType: input.blob.type || "image/webp", width: input.width || 0, height: input.height || 0, bytes: input.blob.size }
    : await compressImageForGallery(source, { maxBytes: input?.maxBytes });

  const id = input?.id || newId();
  const meta = {
    id,
    prompt: String(input?.prompt || ""),
    negativePrompt: String(input?.negativePrompt || ""),
    provider: String(input?.provider || ""),
    model: String(input?.model || ""),
    seed: input?.seed ?? null,
    charId: input?.charId || "",
    source: String(input?.source || "generate"), // generate | upload | chat
    tags: Array.isArray(input?.tags) ? input.tags.filter(Boolean).map(String) : [],
    favorite: !!input?.favorite,
    createdAt: Number(input?.createdAt) || Date.now(),
    mimeType: processed.mimeType,
    width: processed.width,
    height: processed.height,
    bytes: processed.bytes,
  };

  await runTx([IMAGE_STORE, META_STORE], "readwrite", (tx) => {
    tx.objectStore(IMAGE_STORE).put({ id, blob: processed.blob, mimeType: processed.mimeType });
    tx.objectStore(META_STORE).put(meta);
  });

  return meta;
}

/**
 * 取 meta 列表，預設新的在前。
 * 篩選條件都在記憶體做 —— meta 很小，量大到需要 cursor 分頁再說。
 */
export async function listGalleryMeta(options = {}) {
  const offset = Math.max(0, Number(options.offset) || 0);
  const limit = Number(options.limit) > 0 ? Number(options.limit) : Infinity;
  const hasFilters = !!(options.charId || options.favorite || options.source || options.tag);
  return runTx([META_STORE], "readonly", (tx) => {
    const store = tx.objectStore(META_STORE);
    const countReq = store.count();
    const cursorReq = store.index("createdAt").openCursor(null, options.oldestFirst ? "next" : "prev");
    const rows = [];
    let matched = 0;
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return;
      const row = cursor.value;
      const matches =
        (!options.charId || row.charId === options.charId) &&
        (!options.favorite || row.favorite) &&
        (!options.source || row.source === options.source) &&
        (!options.tag || (row.tags || []).includes(options.tag));
      if (matches) {
        if (matched >= offset && rows.length < limit) rows.push(row);
        matched += 1;
      }
      // 無篩選時 count 已是精確總數，取得本頁後即可停止游標，避免掃完整個相簿。
      if (!hasFilters && rows.length >= limit) return;
      cursor.continue();
    };
    return () => ({ total: hasFilters ? matched : (countReq.result || 0), rows });
  });
}

export function getGalleryMeta(id) {
  return runTx([META_STORE], "readonly", (tx) => reqValue(tx.objectStore(META_STORE).get(id)));
}

export async function updateGalleryMeta(id, patch) {
  const current = await getGalleryMeta(id);
  if (!current) return null;
  const next = { ...current, ...patch, id };
  await runTx([META_STORE], "readwrite", (tx) => {
    tx.objectStore(META_STORE).put(next);
  });
  return next;
}

export async function getGalleryImageBlob(id) {
  const row = await runTx([IMAGE_STORE], "readonly", (tx) => reqValue(tx.objectStore(IMAGE_STORE).get(id)));
  return row?.blob || null;
}

/**
 * 取可直接餵給 <img src> 的 URL，同一 id 會重用。
 * 元件卸載時記得呼叫 releaseGalleryImageUrl / releaseAllGalleryImageUrls，否則 Blob 不會被回收。
 */
export async function getGalleryImageUrl(id) {
  const cached = objectUrlCache.get(id);
  if (cached) {
    cached.references += 1;
    return cached.url;
  }
  if (!objectUrlLoads.has(id)) {
    const generation = objectUrlGeneration;
    objectUrlLoads.set(id, getGalleryImageBlob(id).then((blob) => {
      if (!blob || generation !== objectUrlGeneration) return "";
      const url = URL.createObjectURL(blob);
      objectUrlCache.set(id, { url, references: 0 });
      return url;
    }).finally(() => {
      objectUrlLoads.delete(id);
    }));
  }
  const url = await objectUrlLoads.get(id);
  if (!url) return "";
  const entry = objectUrlCache.get(id);
  if (entry) entry.references += 1;
  return url;
}

export function releaseGalleryImageUrl(id) {
  const entry = objectUrlCache.get(id);
  if (!entry) return;
  entry.references = Math.max(0, entry.references - 1);
  if (entry.references > 0) return;
  URL.revokeObjectURL(entry.url);
  objectUrlCache.delete(id);
}

export function releaseAllGalleryImageUrls() {
  // 讓仍在讀取 IndexedDB 的舊請求失效，避免清空後又建立無人持有的 Object URL。
  objectUrlGeneration += 1;
  for (const entry of objectUrlCache.values()) URL.revokeObjectURL(entry.url);
  objectUrlCache.clear();
}

export async function deleteGalleryImage(id) {
  await objectUrlLoads.get(id)?.catch(() => "");
  const entry = objectUrlCache.get(id);
  if (entry) {
    URL.revokeObjectURL(entry.url);
    objectUrlCache.delete(id);
  }
  await runTx([IMAGE_STORE, META_STORE], "readwrite", (tx) => {
    tx.objectStore(IMAGE_STORE).delete(id);
    tx.objectStore(META_STORE).delete(id);
  });
}

export async function clearGallery() {
  await Promise.allSettled([...objectUrlLoads.values()]);
  releaseAllGalleryImageUrls();
  await runTx([IMAGE_STORE, META_STORE], "readwrite", (tx) => {
    tx.objectStore(IMAGE_STORE).clear();
    tx.objectStore(META_STORE).clear();
  });
}

// === 算圖 API 設定 ===

export const DEFAULT_IMAGE_API_CONFIG = {
  enabled: false,
  provider: "gemini",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  apiKey: "",
  model: "gemini-2.5-flash-image",
  dailyLimit: 20,
  usedDate: "",
  usedCount: 0,
};

export async function loadImageApiConfig() {
  const saved = await runTx([CONFIG_STORE], "readonly", (tx) => reqValue(tx.objectStore(CONFIG_STORE).get(IMAGE_API_KEY)));
  return { ...DEFAULT_IMAGE_API_CONFIG, ...(saved || {}) };
}

export async function saveImageApiConfig(config) {
  const next = { ...DEFAULT_IMAGE_API_CONFIG, ...(config || {}) };
  await runTx([CONFIG_STORE], "readwrite", (tx) => {
    tx.objectStore(CONFIG_STORE).put(next, IMAGE_API_KEY);
  });
  return next;
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

/** 還剩幾張額度。跨日自動歸零。 */
export async function getImageQuota() {
  const config = await loadImageApiConfig();
  const limit = Math.max(0, Number(config.dailyLimit) || 0);
  const used = config.usedDate === todayKey() ? Math.max(0, Number(config.usedCount) || 0) : 0;
  return { limit, used, remaining: limit > 0 ? Math.max(0, limit - used) : Infinity };
}

/**
 * 生成成功後才呼叫，扣掉 count 張額度。
 * 失敗的請求不扣 —— 玩家沒拿到圖就不該算在上限裡。
 */
export async function consumeImageQuota(count = 1) {
  const config = await loadImageApiConfig();
  const isToday = config.usedDate === todayKey();
  const used = isToday ? Math.max(0, Number(config.usedCount) || 0) : 0;
  return saveImageApiConfig({ ...config, usedDate: todayKey(), usedCount: used + Math.max(1, Number(count) || 1) });
}

/** 相簿佔用量；quota 由瀏覽器估算，手機上可能不準，只當參考。 */
export async function getGalleryUsage() {
  const { rows, total } = await listGalleryMeta();
  const bytes = rows.reduce((sum, row) => sum + (Number(row.bytes) || 0), 0);
  let quota = 0;
  try {
    const estimate = await navigator.storage?.estimate?.();
    quota = Number(estimate?.quota) || 0;
  } catch (_) {
    quota = 0;
  }
  return { count: total, bytes, quota };
}
