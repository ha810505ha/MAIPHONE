const DB_NAME = "maliphone_db";
const DB_VERSION = 1;
const STORE_NAME = "app_kv";
const APP_STATE_KEY = "app_state";

const LEGACY_LOCAL_KEYS = [
  "mali_characters",
  "mali_activeCharId",
  "mali_chatHistory",
  "mali_posts",
  "mali_memories",
  "mali_apiConfig",
];

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
  });
}

function readKv(key) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error || new Error("IndexedDB read failed"));
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  }));
}

function writeKv(key, value) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("IndexedDB write failed"));
    };
  }));
}

function readLegacyLocalStorage() {
  try {
    const found = {};
    for (const key of LEGACY_LOCAL_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw !== null) found[key] = JSON.parse(raw);
    }
    if (Object.keys(found).length === 0) return null;
    return {
      characters: found.mali_characters ?? [],
      activeCharId: found.mali_activeCharId ?? null,
      chatHistory: found.mali_chatHistory ?? {},
      posts: found.mali_posts ?? [],
      memories: found.mali_memories ?? {},
      apiConfig: found.mali_apiConfig ?? {
        provider: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "",
        model: "gpt-4o-mini",
      },
    };
  } catch {
    return null;
  }
}

function clearLegacyLocalStorage() {
  try {
    for (const key of LEGACY_LOCAL_KEYS) localStorage.removeItem(key);
  } catch {}
}

async function loadAppState(defaultState) {
  const saved = await readKv(APP_STATE_KEY);
  if (saved) return { ...defaultState, ...saved };

  const legacy = readLegacyLocalStorage();
  if (legacy) {
    const migrated = { ...defaultState, ...legacy };
    await writeKv(APP_STATE_KEY, migrated);
    clearLegacyLocalStorage();
    return migrated;
  }
  return defaultState;
}

function saveAppState(state) {
  return writeKv(APP_STATE_KEY, state);
}

export { loadAppState, saveAppState };
