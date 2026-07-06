const DB_NAME = "maliphone_db";
const DB_VERSION = 1;
const STORE_NAME = "app_kv";
const APP_STATE_KEY = "app_state";

// 大資料各自獨立成分區，其餘小資料統一放 core 分區。
// 儲存時只重寫「參照有變動」的分區，避免打一個字就整包重寫。
const PARTITION_FIELDS = ["chatHistory", "chatBackgrounds", "posts", "phoneInboxCache", "phoneAppCache"];
const CORE_KEY = "part_core";
const partitionKey = (field) => `part_${field}`;

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

function writeEntries(entries) {
  if (!entries.length) return Promise.resolve();
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    for (const [key, value] of entries) {
      if (value === undefined) store.delete(key);
      else store.put(value, key);
    }
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

function splitState(state) {
  const core = { ...state };
  const parts = {};
  for (const field of PARTITION_FIELDS) {
    parts[field] = core[field];
    delete core[field];
  }
  return { core, parts };
}

// 記住每個分區上次寫入的參照，儲存時比對決定要不要重寫該分區
const lastSaved = { core: null, parts: {} };

async function writeStatePartitioned(state, force = false) {
  const { core, parts } = splitState(state);
  const entries = [];
  const coreChanged = force || lastSaved.core === null ||
    Object.keys(core).length !== Object.keys(lastSaved.core).length ||
    Object.keys(core).some((k) => core[k] !== lastSaved.core[k]);
  if (coreChanged) entries.push([CORE_KEY, core]);
  for (const field of PARTITION_FIELDS) {
    if (force || parts[field] !== lastSaved.parts[field]) {
      entries.push([partitionKey(field), parts[field]]);
    }
  }
  await writeEntries(entries);
  lastSaved.core = core;
  lastSaved.parts = { ...parts };
}

async function readStatePartitioned() {
  const core = await readKv(CORE_KEY);
  if (!core) return null;
  const state = { ...core };
  for (const field of PARTITION_FIELDS) {
    const value = await readKv(partitionKey(field));
    if (value !== null && value !== undefined) state[field] = value;
  }
  return state;
}

async function loadAppState(defaultState) {
  const partitioned = await readStatePartitioned();
  if (partitioned) {
    const state = { ...defaultState, ...partitioned };
    const { core, parts } = splitState(state);
    lastSaved.core = core;
    lastSaved.parts = { ...parts };
    return state;
  }

  // 舊版單一 key 格式 → 遷移成分區格式後刪除舊 key
  const savedLegacyKv = await readKv(APP_STATE_KEY);
  if (savedLegacyKv) {
    const migrated = { ...defaultState, ...savedLegacyKv };
    await writeStatePartitioned(migrated, true);
    await writeEntries([[APP_STATE_KEY, undefined]]);
    return migrated;
  }

  const legacy = readLegacyLocalStorage();
  if (legacy) {
    const migrated = { ...defaultState, ...legacy };
    await writeStatePartitioned(migrated, true);
    clearLegacyLocalStorage();
    return migrated;
  }
  return defaultState;
}

function saveAppState(state) {
  return writeStatePartitioned(state);
}

export { loadAppState, saveAppState };
