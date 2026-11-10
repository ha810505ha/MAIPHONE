// 自動同步的排程決策（純函式，MP-094）：資料有變動且登入時，最多每 5 分鐘上傳一次，
// 變動後先等一小段安靜時間（打字中不送），被限流／失敗就依 retryAfter 或固定退避。
export const AUTO_SYNC_MIN_INTERVAL_MS = 5 * 60 * 1000;
export const AUTO_SYNC_QUIET_MS = 45 * 1000;
// 正式站（2026-10-29「像一般 AI 聊天平台」）：安靜 15 秒、最少間隔 2 分鐘。
// worker 每人每小時最多 30 次 PUT（寫死在 SQL），2 分鐘＝30 次／小時已是上限，不可再調低。
export const AUTO_SYNC_OFFICIAL_MIN_INTERVAL_MS = 2 * 60 * 1000;
export const AUTO_SYNC_OFFICIAL_QUIET_MS = 15 * 1000;
export const AUTO_SYNC_WORKER_UPLOADS_PER_HOUR = 30;
const AUTO_SYNC_TIMINGS = Object.freeze({
  default: Object.freeze({ quietMs: AUTO_SYNC_QUIET_MS, minIntervalMs: AUTO_SYNC_MIN_INTERVAL_MS }),
  official: Object.freeze({ quietMs: AUTO_SYNC_OFFICIAL_QUIET_MS, minIntervalMs: AUTO_SYNC_OFFICIAL_MIN_INTERVAL_MS }),
});

/** 自動上傳的時間設定：正式站用 official，其他網頁（GitHub Pages、測試站、localhost）用 default。 */
export function getAutoSyncTimings({ official = false } = {}) {
  return official ? AUTO_SYNC_TIMINGS.official : AUTO_SYNC_TIMINGS.default;
}
export const AUTO_SYNC_FAILURE_BACKOFF_MS = 15 * 60 * 1000;
export const AUTO_SYNC_STATE_PREFIX = "maliphone_cloud_auto_sync:";

/**
 * 回傳距現在幾毫秒後該嘗試上傳；null 表示現在不該排。
 * - dirty：上次成功上傳後本機有變動
 * - lastChangeAt：最後一次變動時間；lastAttemptAt：最後一次嘗試（成功或失敗）
 * - blockedUntil：限流／失敗後的退避截止；blocked：雲端較新等待玩家決定（不自動重試）
 */
export function planNextAutoSync({
  now = Date.now(), dirty = false, blocked = false, lastChangeAt = 0, lastAttemptAt = 0, blockedUntil = 0,
  minIntervalMs = AUTO_SYNC_MIN_INTERVAL_MS, quietMs = AUTO_SYNC_QUIET_MS,
} = {}) {
  if (!dirty || blocked) return null;
  const earliest = Math.max(
    (Number(lastChangeAt) || 0) + quietMs,
    (Number(lastAttemptAt) || 0) + minIntervalMs,
    Number(blockedUntil) || 0,
  );
  return Math.max(0, earliest - now);
}

const DEFAULT_STATE = Object.freeze({ enabled: true, lastAttemptAt: 0, lastSyncAt: 0, lastRevision: 0, lastStatus: "", lastMessage: "" });

const storage = () => {
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; }
};

export function readAutoSyncState(userId) {
  const store = storage();
  if (!store || !userId) return { ...DEFAULT_STATE };
  try {
    const value = JSON.parse(store.getItem(`${AUTO_SYNC_STATE_PREFIX}${userId}`) || "null");
    return value && typeof value === "object" ? { ...DEFAULT_STATE, ...value } : { ...DEFAULT_STATE };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function writeAutoSyncState(userId, patch) {
  const next = { ...readAutoSyncState(userId), ...patch };
  const store = storage();
  if (store && userId) {
    try { store.setItem(`${AUTO_SYNC_STATE_PREFIX}${userId}`, JSON.stringify(next)); } catch {}
  }
  return next;
}

/**
 * 自動下載決策（MP-095，純函式）：
 * - 雲端沒有存檔 → null
 * - 本機沒有任何角色 → "load"（沒東西可損失，直接載入）
 * - 雲端比這台上次同步的版本新：這台沒有還沒傳上去的變動（且同步過）→ "load"；有未傳變動或從沒同步過 → "ask"
 * - 其他 → null
 */
export function planAutoDownload({ remoteExists = false, remoteRevision = 0, localRevision = 0, localCharacterCount = 0, dirty = false } = {}) {
  if (!remoteExists) return null;
  if (!(Number(localCharacterCount) > 0)) return "load";
  const remote = Number(remoteRevision) || 0;
  const local = Number(localRevision) || 0;
  if (remote <= local) return null;
  return dirty || !local ? "ask" : "load";
}
export const AUTO_CHECK_MIN_INTERVAL_MS = 5 * 60 * 1000;
