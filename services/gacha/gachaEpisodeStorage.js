const DB_NAME = "maliphone-gacha";
const DB_VERSION = 1;
const STORE_NAME = "episodeData";
const EPISODES_KEY = "episodes";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("無法開啟特別篇資料庫"));
  });
}

async function runTransaction(mode, action) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = action(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("特別篇資料庫操作失敗"));
      transaction.onerror = () => reject(transaction.error || new Error("特別篇資料庫交易失敗"));
    });
  } finally { database.close(); }
}

export async function loadGachaEpisodes() {
  if (typeof indexedDB === "undefined") return null;
  const value = await runTransaction("readonly", (store) => store.get(EPISODES_KEY));
  return Array.isArray(value) ? value : null;
}

export async function saveGachaEpisodes(episodes) {
  if (typeof indexedDB === "undefined") throw new Error("瀏覽器不支援 IndexedDB");
  await runTransaction("readwrite", (store) => store.put(Array.isArray(episodes) ? episodes : [], EPISODES_KEY));
}

export function deleteLegacyGachaDatabase() {
  if (typeof indexedDB === "undefined") return;
  try { indexedDB.deleteDatabase(DB_NAME); } catch (_) {}
}
