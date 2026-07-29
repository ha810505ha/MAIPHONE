const DB_NAME = "maliphone_tts_audio";
const DB_VERSION = 1;
const STORE_NAME = "audio";
const MAX_CACHE_ENTRIES = 200;
const MAX_CACHE_BYTES = 64 * 1024 * 1024;

function openDatabase() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("accessedAt", "accessedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("TTS cache database open failed"));
  });
}

async function runTransaction(mode, work) {
  const database = await openDatabase();
  if (!database) return null;
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      let result;
      try {
        result = work(transaction.objectStore(STORE_NAME));
      } catch (error) {
        reject(error);
        return;
      }
      transaction.oncomplete = () => resolve(typeof result === "function" ? result() : result);
      transaction.onerror = () => reject(transaction.error || new Error("TTS cache transaction failed"));
      transaction.onabort = () => reject(transaction.error || new Error("TTS cache transaction aborted"));
    });
  } finally {
    database.close();
  }
}

export async function getCachedTtsAudio(key) {
  if (!key) return null;
  let row = null;
  await runTransaction("readwrite", (store) => {
    const request = store.get(key);
    request.onsuccess = () => {
      row = request.result || null;
      if (row?.blob instanceof Blob) store.put({ ...row, accessedAt: Date.now() });
    };
  });
  return row?.blob instanceof Blob && row.blob.size > 0 ? row.blob : null;
}

export async function putCachedTtsAudio(key, blob) {
  if (!key || !(blob instanceof Blob) || blob.size <= 0) return;
  const now = Date.now();
  await runTransaction("readwrite", (store) => {
    store.put({ key, blob, createdAt: now, accessedAt: now });
    const entries = [];
    let totalBytes = 0;
    const cursorRequest = store.index("accessedAt").openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) {
        const size = Number(cursor.value?.blob?.size) || 0;
        entries.push({ key: cursor.primaryKey, size });
        totalBytes += size;
        cursor.continue();
        return;
      }
      while (entries.length > MAX_CACHE_ENTRIES || totalBytes > MAX_CACHE_BYTES) {
        const oldest = entries.shift();
        if (!oldest) break;
        store.delete(oldest.key);
        totalBytes -= oldest.size;
      }
    };
  });
}

export async function clearCachedTtsAudio() {
  await runTransaction("readwrite", (store) => store.clear());
}
