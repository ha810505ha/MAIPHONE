// 本機自動快照：把文字資料（不含圖片、不含金鑰）另存一份在獨立的 IndexedDB，
// 讓玩家在資料被覆蓋、回溯或誤清時可以自己還原。
// 注意：快照和主資料在同一個網站來源，瀏覽器或系統整個清掉網站資料時快照也會一起消失；
// 它防的是程式、同步、匯入與誤操作造成的覆蓋，不能取代匯出備份或雲端。
//
// 兩個 store：meta 只放時間、原因與摘要（清單與每小時檢查只讀這個，很輕）；
// data 放快照本體，只有建立與還原時才讀寫。

const DB_NAME = "maliphone_snapshots";
const DB_VERSION = 2;
const META_STORE = "meta";
const DATA_STORE = "data";

export const SNAPSHOT_DAILY_INTERVAL_MS = 20 * 60 * 60 * 1000;
// 最多 5 份：每日 2 份＋覆蓋／清空／手動前 2 份＋內容最多的 1 份。
export const SNAPSHOT_KEEP_DAILY = 2;
export const SNAPSHOT_KEEP_EVENT = 2;

export const SNAPSHOT_REASONS = Object.freeze({
  daily: "daily",
  beforeOverwrite: "before-overwrite",
  beforeReset: "before-reset",
  manual: "manual",
});

function openSnapshotDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // v1 只存在於未發布的開發版，結構不同，直接移除。
      if (db.objectStoreNames.contains("snapshots")) db.deleteObjectStore("snapshots");
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(DATA_STORE)) db.createObjectStore(DATA_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Snapshot DB open failed"));
  });
}

function withStores(storeNames, mode, run) {
  return openSnapshotDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    let result;
    Promise.resolve(run(tx)).then((value) => { result = value; }, reject);
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error("Snapshot transaction failed")); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error("Snapshot transaction aborted")); };
  }));
}

const requestToPromise = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

/** 快照內容的簡短統計，給清單顯示，也用來判斷哪一份內容最多。 */
export function summarizeSnapshotState(state) {
  const chatHistory = state?.chatHistory && typeof state.chatHistory === "object" ? state.chatHistory : {};
  const messages = Object.values(chatHistory).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
  return {
    characters: Array.isArray(state?.characters) ? state.characters.length : 0,
    chats: Object.keys(chatHistory).length,
    messages,
    posts: Array.isArray(state?.posts) ? state.posts.length : 0,
  };
}

const contentScore = (summary) => (Number(summary?.messages) || 0) + (Number(summary?.characters) || 0) * 50 + (Number(summary?.posts) || 0);

/** 依保留規則回傳要刪除的快照 id；純函式，方便測試。 */
export function selectSnapshotsToDelete(list, { keepDaily = SNAPSHOT_KEEP_DAILY, keepEvent = SNAPSHOT_KEEP_EVENT } = {}) {
  const newestFirst = [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const daily = newestFirst.filter((item) => item.reason === SNAPSHOT_REASONS.daily);
  const events = newestFirst.filter((item) => item.reason !== SNAPSHOT_REASONS.daily);
  // 內容最多的一份永遠保留：資料被清空後，每天的快照都會是空的，不能讓它們把好的那份擠掉。
  const richest = newestFirst.reduce((best, item) => (!best || contentScore(item.summary) > contentScore(best.summary) ? item : best), null);
  const keep = new Set([
    ...daily.slice(0, keepDaily).map((item) => item.id),
    ...events.slice(0, keepEvent).map((item) => item.id),
  ]);
  if (richest) keep.add(richest.id);
  return newestFirst.filter((item) => !keep.has(item.id)).map((item) => item.id);
}

/** 只讀 meta，給設定頁清單與每日檢查用。 */
export async function listLocalSnapshots() {
  const metas = await withStores([META_STORE], "readonly", (tx) => requestToPromise(tx.objectStore(META_STORE).getAll()));
  return (metas || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function getLocalSnapshot(id) {
  return withStores([META_STORE, DATA_STORE], "readonly", async (tx) => {
    const [meta, data] = await Promise.all([
      requestToPromise(tx.objectStore(META_STORE).get(id)),
      requestToPromise(tx.objectStore(DATA_STORE).get(id)),
    ]);
    return meta && data ? { ...meta, state: data.state } : null;
  });
}

export async function saveLocalSnapshot({ reason, state, version = "" }) {
  const createdAt = Date.now();
  const json = JSON.stringify(state);
  const meta = {
    id: `snap_${createdAt}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt,
    reason,
    version: String(version || ""),
    bytes: json.length,
    summary: summarizeSnapshotState(state),
  };
  // 存 JSON 解析後的純資料，避免結構化複製遇到函式等不可存的值。
  const data = { id: meta.id, state: JSON.parse(json) };
  await withStores([META_STORE, DATA_STORE], "readwrite", async (tx) => {
    const metaStore = tx.objectStore(META_STORE);
    const dataStore = tx.objectStore(DATA_STORE);
    await Promise.all([requestToPromise(metaStore.put(meta)), requestToPromise(dataStore.put(data))]);
    const all = await requestToPromise(metaStore.getAll());
    const stale = selectSnapshotsToDelete(all || []);
    await Promise.all(stale.flatMap((id) => [
      requestToPromise(metaStore.delete(id)),
      requestToPromise(dataStore.delete(id)),
    ]));
  });
  return meta;
}

export async function isDailySnapshotDue(now = Date.now()) {
  const metas = await listLocalSnapshots();
  const lastDaily = metas.find((item) => item.reason === SNAPSHOT_REASONS.daily);
  return !lastDaily || now - (lastDaily.createdAt || 0) >= SNAPSHOT_DAILY_INTERVAL_MS;
}

export async function deleteAllLocalSnapshots() {
  await withStores([META_STORE, DATA_STORE], "readwrite", (tx) => Promise.all([
    requestToPromise(tx.objectStore(META_STORE).clear()),
    requestToPromise(tx.objectStore(DATA_STORE).clear()),
  ]));
}
