// 本機自動快照：把文字資料（不含圖片、不含金鑰）另存一份，
// 讓玩家在資料被覆蓋、回溯或誤清時可以自己還原。
//
// 網頁版存在獨立的 IndexedDB `maliphone_snapshots`；快照和主資料在同一個網站來源，
// 瀏覽器或系統整個清掉網站資料時快照也會一起消失。
// APK 自 1.5.2 起改存 App 私有檔案系統（MP-090）：Android 清掉 WebView 資料庫時快照仍在，
// 舊 APK 留在 IndexedDB 的快照會在第一次讀取時搬到檔案；檔案系統不可用時退回 IndexedDB。
// APK 另有「最新存檔鏡像」（reason latest）：資料有變動時最多每分鐘寫一份，兩個固定 id 輪流，
// 被系統清掉時最多只損失一分鐘內的進度。
//
// 兩個 store：meta 只放時間、原因與摘要（清單與每小時檢查只讀這個，很輕）；
// data 放快照本體，只有建立與還原時才讀寫。

import { createSnapshotFileStore } from "./snapshotFileStore.js";

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
  // 最新存檔鏡像（MP-090）：APK 資料有變動時最多每分鐘寫一份到私有檔案夾，固定佔一格。
  latest: "latest",
});
// 鏡像用兩個固定 id 輪流寫：新的寫完才刪舊的，任何時刻至少有一份完整的。
export const LATEST_SNAPSHOT_IDS = Object.freeze(["snap_latest_a", "snap_latest_b"]);
export const isLatestSnapshotId = (id) => LATEST_SNAPSHOT_IDS.includes(id);

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
  // 最新存檔鏡像不在保留名額內，也永遠不會被這裡刪掉。
  const newestFirst = [...list]
    .filter((item) => item.reason !== SNAPSHOT_REASONS.latest && !isLatestSnapshotId(item.id))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
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

// === IndexedDB 實作（網頁版主要儲存；APK 的舊快照與退路） ===
async function idbList() {
  const metas = await withStores([META_STORE], "readonly", (tx) => requestToPromise(tx.objectStore(META_STORE).getAll()));
  return (metas || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function idbGet(id) {
  return withStores([META_STORE, DATA_STORE], "readonly", async (tx) => {
    const [meta, data] = await Promise.all([
      requestToPromise(tx.objectStore(META_STORE).get(id)),
      requestToPromise(tx.objectStore(DATA_STORE).get(id)),
    ]);
    return meta && data ? { ...meta, state: data.state } : null;
  });
}

function idbSave(meta, data) {
  return withStores([META_STORE, DATA_STORE], "readwrite", async (tx) => {
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
}

function idbClear() {
  return withStores([META_STORE, DATA_STORE], "readwrite", (tx) => Promise.all([
    requestToPromise(tx.objectStore(META_STORE).clear()),
    requestToPromise(tx.objectStore(DATA_STORE).clear()),
  ]));
}

// === APK 檔案系統實作 ===
const isNativeApp = () => typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
let fileStorePromise = null;

// 舊 APK 的快照還在 IndexedDB：搬一份到檔案系統，之後以檔案為準。失敗就略過，不擋使用。
async function migrateIdbSnapshotsToFiles(store) {
  let metas;
  try { metas = await idbList(); } catch { return; }
  for (const meta of metas) {
    try {
      if (await store.has(meta.id)) continue;
      const full = await idbGet(meta.id);
      if (full?.state) await store.put(meta, { id: meta.id, state: full.state });
    } catch {}
  }
}

/** 測試用：直接指定檔案庫（Node 沒有 Capacitor）。 */
export function configureSnapshotFileStoreForTests(store) {
  fileStorePromise = store ? Promise.resolve(store) : null;
  latestMetaCache = null;
  latestJsonCache = null;
}

function getFileStore() {
  if (fileStorePromise) return fileStorePromise;
  if (!isNativeApp()) return Promise.resolve(null);
  if (!fileStorePromise) {
    fileStorePromise = import("@capacitor/filesystem")
      .then((plugin) => createSnapshotFileStore(plugin))
      .then(async (store) => { await migrateIdbSnapshotsToFiles(store); return store; })
      .catch((error) => {
        console.warn("[snapshot] 檔案系統不可用，改用 IndexedDB", error);
        return null;
      });
  }
  return fileStorePromise;
}

/** 只讀 meta，給設定頁清單與每日檢查用。 */
export async function listLocalSnapshots() {
  const store = await getFileStore();
  if (!store) return idbList();
  const fromFiles = collapseLatestSnapshots(await store.list());
  // 檔案寫入失敗時退回 IndexedDB 的那幾份也要列出來，才救得回。
  let fromIdb = [];
  try { fromIdb = await idbList(); } catch {}
  const seen = new Set(fromFiles.map((item) => item.id));
  return [...fromFiles, ...fromIdb.filter((item) => !seen.has(item.id))]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/** 兩個鏡像槽只列最新的一份（舊的那份只在寫入途中短暫並存）。 */
export function collapseLatestSnapshots(list) {
  const latest = list.filter((item) => isLatestSnapshotId(item.id))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  return list.filter((item) => !isLatestSnapshotId(item.id) || item === latest);
}

/**
 * 最新存檔鏡像要不要寫（純函式）：內容沒變不寫；
 * 本機已經沒有任何角色而鏡像仍有角色時不蓋掉——玩家清空或剛被清掉時，鏡像是最後的退路。
 */
export function shouldWriteLatestSnapshot({ previous, previousJson, nextSummary, nextJson }) {
  if (previousJson != null && previousJson === nextJson) return false;
  if (previous && (nextSummary?.characters || 0) === 0 && (previous.summary?.characters || 0) > 0) return false;
  return true;
}

let latestMetaCache = null;
let latestJsonCache = null;

/** 最新存檔鏡像：只在有私有檔案夾的 APK 寫；網頁版沒有安全位置，直接回 null。 */
export async function saveLatestSnapshot({ state, version = "" }) {
  const store = await getFileStore();
  if (!store) return null;
  const json = JSON.stringify(state);
  const summary = summarizeSnapshotState(state);
  const previous = latestMetaCache
    || (await store.list()).filter((item) => isLatestSnapshotId(item.id)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0]
    || null;
  if (!shouldWriteLatestSnapshot({ previous, previousJson: latestJsonCache, nextSummary: summary, nextJson: json })) return null;
  const id = previous && previous.id === LATEST_SNAPSHOT_IDS[0] ? LATEST_SNAPSHOT_IDS[1] : LATEST_SNAPSHOT_IDS[0];
  const meta = { id, createdAt: Date.now(), reason: SNAPSHOT_REASONS.latest, version: String(version || ""), bytes: json.length, summary };
  await store.put(meta, { id, state: JSON.parse(json) });
  latestMetaCache = meta;
  latestJsonCache = json;
  if (previous && previous.id !== id) await store.removeMany([previous.id]);
  return meta;
}

export async function getLocalSnapshot(id) {
  const store = await getFileStore();
  if (store) {
    const found = await store.get(id);
    if (found) return found;
  }
  return idbGet(id);
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
  const store = await getFileStore();
  if (store) {
    try {
      await store.put(meta, data);
      await store.removeMany(selectSnapshotsToDelete(await store.list()));
      return meta;
    } catch (error) {
      console.warn("[snapshot] 檔案寫入失敗，改存 IndexedDB", error);
    }
  }
  await idbSave(meta, data);
  return meta;
}

export async function isDailySnapshotDue(now = Date.now()) {
  const metas = await listLocalSnapshots();
  const lastDaily = metas.find((item) => item.reason === SNAPSHOT_REASONS.daily);
  return !lastDaily || now - (lastDaily.createdAt || 0) >= SNAPSHOT_DAILY_INTERVAL_MS;
}

export async function deleteAllLocalSnapshots() {
  const store = await getFileStore();
  if (store) await store.clear();
  latestMetaCache = null;
  latestJsonCache = null;
  await idbClear();
}
