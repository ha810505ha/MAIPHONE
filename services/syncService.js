// 雲端同步引擎（M3）：消化 indexedDbStorage 的 outbox，接後端 /api/sync
import { LEGACY_AUTO_SYNC_ENABLED } from "../config/featureFlags.js";
import { fetchWithTimeout, NETWORK_TIMEOUTS } from "../utils/networkRequest.js";
// 設計原則：後端不在（本地純前端開發、離線）時全部靜默跳過，App 照常運作。
import {
  getSyncOutbox, readEntity, ackSynced, applyRemoteEntities, clearSyncOutbox, resetLocalEntities, getDeviceId,
} from "../utils/indexedDbStorage.js";

// 官方伺服器網址：Railway 部署好後填進來（例 "https://maliphone.up.railway.app"）。
// 有填的話玩家完全不用碰伺服器設定，APK/網頁都直接連官方伺服器；
// 設定頁的網址欄位也會隱藏（localStorage 的 mali_server_url 仍可覆寫，留給自架玩家）。
export const OFFICIAL_SERVER_URL = "";

const AUTH_KEY = "mali_auth";
const CURSOR_KEY = "mali_sync_cursor";
// 換帳號後、還沒成功從雲端完整拉取前為 "1"：
// 期間不推送本地資料（那是舊帳號的），等下次連上線先清掉本地實體再重拉
const PENDING_RESET_KEY = "mali_pending_account_reset";
const LAST_USER_KEY = "mali_last_user_id"; // 登出後仍記得上一個帳號，用來判斷是否換了帳號
const SERVER_URL_KEY = "mali_server_url"; // APK 或自架時設定絕對網址；網頁版留空走同源
const PUSH_BATCH = 50;

const getServerBase = () => {
  try {
    const v = localStorage.getItem(SERVER_URL_KEY);
    if (v) return v.replace(/\/+$/, ""); // 自架玩家的手動覆寫優先
  } catch {}
  if (OFFICIAL_SERVER_URL) return OFFICIAL_SERVER_URL.replace(/\/+$/, "");
  return ""; // 同源（Railway 部署 / vite dev proxy）
};

const loadAuth = () => {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || null; } catch { return null; }
};
const saveAuth = (auth) => {
  try {
    if (auth) localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    else localStorage.removeItem(AUTH_KEY);
  } catch {}
};

const isPendingReset = () => {
  try { return !!localStorage.getItem(PENDING_RESET_KEY); } catch { return false; }
};
const setPendingReset = (on) => {
  try {
    if (on) localStorage.setItem(PENDING_RESET_KEY, "1");
    else localStorage.removeItem(PENDING_RESET_KEY);
  } catch {}
};

const getCursor = () => {
  try { return Number(localStorage.getItem(CURSOR_KEY)) || 0; } catch { return 0; }
};
const setCursor = (seq) => {
  try { localStorage.setItem(CURSOR_KEY, String(seq)); } catch {}
};

async function api(path, { method = "GET", body, token, signal, timeoutMs } = {}) {
  const res = await fetchWithTimeout(`${getServerBase()}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }, {
    signal,
    timeoutMs: timeoutMs || NETWORK_TIMEOUTS.SYNC,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

// access token 過期時自動用 refresh token 換發
let refreshPromise = null;

async function refreshSession(auth) {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await api("/auth/refresh", {
        method: "POST",
        body: { refreshToken: auth.refreshToken },
      });
      if (response.status !== 200) return null;
      const next = {
        ...auth,
        userId: response.data.userId || auth.userId,
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
      };
      delete next.needsRelogin; // 換發成功，取消重新登入標記
      saveAuth(next);
      return next;
    })().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

async function createOrRecoverAnonymousAccount() {
  const platform = window.Capacitor?.isNativePlatform?.() ? "android" : "web";
  const response = await api("/auth/anonymous", {
    method: "POST",
    body: { deviceId: getDeviceId(), platform },
  });
  if (response.status !== 200) throw new Error(response.data?.error || "anonymous-signup-failed");
  const auth = {
    userId: response.data.userId,
    accessToken: response.data.accessToken,
    refreshToken: response.data.refreshToken,
    anonymous: true,
  };
  saveAuth(auth);
  return auth;
}

async function authedApi(path, opts = {}) {
  let auth = loadAuth();
  if (!auth?.accessToken) throw new Error("not-authenticated");
  let res = await api(path, { ...opts, token: auth.accessToken });
  if (res.status !== 401) return res;

  const refreshed = await refreshSession(auth);
  if (refreshed) return api(path, { ...opts, token: refreshed.accessToken });

  if (!auth.anonymous) {
    // email 帳號的 session 失效（過期或被其他裝置登出）：
    // 保留本地資料與帳號資訊、標記需要重新登入。
    // 絕不能自動改建匿名帳號——那會讓這台裝置從此接不回原本的雲端資料。
    saveAuth({ ...auth, needsRelogin: true });
    throw new Error("login-required");
  }
  // 匿名帳號：用 deviceId 取回。失敗會直接 throw，不動本地任何狀態。
  const recovered = await createOrRecoverAnonymousAccount();
  if (recovered.userId !== auth.userId) setCursor(0); // 拿到的是全新身分才需要從頭拉
  return api(path, { ...opts, token: recovered.accessToken });
}

export async function isServerReachable(timeoutMs = 2500) {
  try {
    const res = await fetchWithTimeout(`${getServerBase()}/api/health`, {}, { timeoutMs });
    const reachable = res.ok;
    await res.body?.cancel();
    return reachable;
  } catch {
    return false;
  }
}

// 沒帳號就自動建匿名帳號（之後可在設定裡綁定 email 升級）
export async function ensureAccount() {
  const existing = loadAuth();
  if (existing?.refreshToken) return existing;
  return createOrRecoverAnonymousAccount();
}

// 上傳 outbox。衝突（本地較舊）→ 以 server 版本覆蓋本地後 ack。
// 回傳 { pushed, appliedRemote }：appliedRemote > 0 表示衝突時伺服器版本已寫回本地，
// App 執行中必須重新載入，否則畫面上的舊資料下次存檔會蓋回雲端。
async function pushOutbox() {
  // 換帳號後還沒完成雲端重建前，本地實體仍屬於舊帳號，不可推到新帳號
  if (isPendingReset()) return { pushed: 0, appliedRemote: 0 };
  const outbox = await getSyncOutbox();
  const keys = Object.keys(outbox);
  let pushed = 0;
  let appliedRemote = 0;
  for (let i = 0; i < keys.length; i += PUSH_BATCH) {
    const batch = keys.slice(i, i + PUSH_BATCH);
    const entities = [];
    for (const key of batch) {
      const wrapped = await readEntity(key);
      if (!wrapped) continue;
      entities.push({ key, rev: wrapped.rev, updatedAt: wrapped.updatedAt, deviceId: wrapped.deviceId, deleted: wrapped.deleted, data: wrapped.data });
    }
    if (!entities.length) { await ackSynced(batch); continue; }
    const res = await authedApi("/sync/push", { method: "POST", body: { entities } });
    if (res.status !== 200) throw new Error(res.data?.error || `push failed (${res.status})`);
    const ackKeys = [];
    const conflicts = [];
    for (const r of res.data.results || []) {
      if (r.status === "conflict" && r.server) conflicts.push(r.server);
      if (["ok", "conflict", "invalid", "too_large"].includes(r.status)) ackKeys.push(r.key);
      if (r.status === "ok") pushed += 1;
    }
    if (conflicts.length) appliedRemote += await applyRemoteEntities(conflicts);
    await ackSynced(ackKeys.filter(Boolean));
  }
  return { pushed, appliedRemote };
}

// 增量拉取並套用到本地
async function pullChanges() {
  let since = getCursor();
  let pulled = 0;
  for (let guard = 0; guard < 50; guard += 1) {
    const res = await authedApi(`/sync/pull?since=${since}`);
    if (res.status !== 200) throw new Error(res.data?.error || `pull failed (${res.status})`);
    const { entities = [], nextSince = since, hasMore = false } = res.data || {};
    if (entities.length) {
      // 本地還在 outbox（未上傳）的實體不覆蓋，避免蓋掉尚未推走的變更
      const outbox = await getSyncOutbox();
      // 只計實際寫入的筆數（applyRemoteEntities 會跳過本裝置的 echo），
      // 呼叫端才不會因為拉回自己剛推的資料而誤觸重載
      pulled += await applyRemoteEntities(entities.filter((e) => !outbox[e.key]));
    }
    since = nextSince;
    setCursor(since);
    if (!hasMore) break;
  }
  return pulled;
}

let syncPromise = null;
// 完整同步：push outbox → pull 增量。
// 注意：pull 只把資料寫進本地儲存，執行中的 App 畫面不會自動更新——
// 開機時（載入 state 前）呼叫沒問題；營運中呼叫後若 pulled > 0，呼叫端應重新載入。
export async function syncNow({ pull = true } = {}) {
  if (!LEGACY_AUTO_SYNC_ENABLED) return { pushed: 0, pulled: 0, appliedRemote: 0, disabled: true };
  // React StrictMode 在開發環境會重跑初始化 effect。第二次呼叫必須等待
  // 已在進行的同步，否則會先載入尚未套用遠端資料的 IndexedDB。
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    await ensureAccount();
    const { pushed, appliedRemote } = await pushOutbox();
    const pulled = pull ? await pullChanges() : 0;
    return { pushed, pulled, appliedRemote };
  })();
  try {
    return await syncPromise;
  } finally {
    syncPromise = null;
  }
}

// App 啟動時呼叫：伺服器不在就靜默跳過
export async function syncOnBoot() {
  if (!LEGACY_AUTO_SYNC_ENABLED) return { pushed: 0, pulled: 0, appliedRemote: 0, disabled: true };
  if (!(await isServerReachable())) return null;
  try {
    const pendingReset = isPendingReset();
    if (pendingReset) {
      // 換帳號後第一次連上雲端：清掉舊帳號的本地實體，改以雲端資料重建。
      // 標記等整輪同步成功才移除，中途失敗下次開機會重試（reset 可重複執行）。
      await resetLocalEntities();
      setCursor(0);
      setPendingReset(false); // 先移除讓 pushOutbox 解鎖；失敗會在 catch 裡復原
      try {
        const result = await syncNow({ pull: true });
        console.info("[sync] boot (account switch):", result);
        return result;
      } catch (err) {
        setPendingReset(true);
        throw err;
      }
    }
    const result = await syncNow({ pull: true });
    console.info("[sync] boot:", result);
    return result;
  } catch (err) {
    console.warn("[sync] boot failed:", err?.message || err);
    return null;
  }
}

// 存檔後排程 push-only 同步（debounce 5 秒），離線/無後端一律靜默
let pushTimer = null;
export function schedulePush() {
  if (!LEGACY_AUTO_SYNC_ENABLED) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    pushTimer = null;
    if (!loadAuth()) return; // 從未連過後端就不打擾
    try {
      const result = await syncNow({ pull: false });
      if (result?.appliedRemote > 0) {
        // 推送遇到衝突、伺服器版本已寫回本地儲存：畫面上還是舊資料，
        // 不重載的話下一次存檔會把舊資料再蓋回雲端，造成另一台裝置的編輯遺失
        console.info("[sync] remote data applied during push; reloading");
        setTimeout(() => window.location.reload(), 500);
      }
    } catch (err) { console.warn("[sync] push failed:", err?.message || err); }
  }, 5000);
}

export function getSyncAccount() {
  return loadAuth();
}

// === 設定頁用的帳號 API ===
export function getServerUrl() {
  try { return localStorage.getItem(SERVER_URL_KEY) || ""; } catch { return ""; }
}
export function setServerUrl(url) {
  try {
    const v = String(url || "").trim().replace(/\/+$/, "");
    if (v) localStorage.setItem(SERVER_URL_KEY, v);
    else localStorage.removeItem(SERVER_URL_KEY);
  } catch {}
}

export async function getMe() {
  const res = await authedApi("/auth/me");
  if (res.status !== 200) throw new Error(res.data?.error || "無法取得帳號資訊");
  return res.data;
}

// 匿名帳號綁定 email 升級
export async function bindEmail(email, password) {
  const res = await authedApi("/auth/register", { method: "POST", body: { email, password } });
  if (res.status !== 200) throw new Error(res.data?.error || "綁定失敗");
  const auth = loadAuth();
  if (auth) saveAuth({ ...auth, anonymous: false }); // 升級後 session 失效不可再走匿名回復
  return res.data;
}

// 登入既有帳號（切換帳號）。呼叫端應在成功後重新載入 App 讓資料合併生效。
export async function loginAccount(email, password) {
  const platform = window.Capacitor?.isNativePlatform?.() ? "android" : "web";
  const res = await api("/auth/login", { method: "POST", body: { email, password, deviceId: getDeviceId(), platform } });
  if (res.status !== 200) throw new Error(res.data?.error || "登入失敗");
  // 本地資料屬於上一個身分（含登出前的帳號）時，標記待重建：
  // 下次開機連上雲端會先清掉本地實體再從雲端完整拉取，避免舊帳號資料混進新帳號
  const prevUserId = loadAuth()?.userId || (() => {
    try { return localStorage.getItem(LAST_USER_KEY); } catch { return null; }
  })();
  if (prevUserId && prevUserId !== res.data.userId) setPendingReset(true);
  saveAuth({ userId: res.data.userId, accessToken: res.data.accessToken, refreshToken: res.data.refreshToken });
  setCursor(0); // 換帳號後從頭拉
  await clearSyncOutbox().catch(() => {}); // 舊帳號（通常是本機匿名）的待同步項目不推到新帳號，避免蓋掉雲端資料
  return res.data;
}

export async function logoutAccount() {
  const auth = loadAuth();
  if (auth?.refreshToken) {
    await api("/auth/logout", { method: "POST", body: { refreshToken: auth.refreshToken } }).catch(() => {});
  }
  if (auth?.userId) {
    try { localStorage.setItem(LAST_USER_KEY, auth.userId); } catch {} // 記住資料屬於誰，之後登入別的帳號才知道要重建
  }
  saveAuth(null);
  setCursor(0);
}

export async function logoutDevice(deviceId) {
  const res = await authedApi(`/auth/devices/${encodeURIComponent(deviceId)}`, { method: "DELETE" });
  if (res.status !== 200) throw new Error(res.data?.error || "登出裝置失敗");
}

export async function getPendingSyncCount() {
  const outbox = await getSyncOutbox();
  return Object.keys(outbox).length;
}
