import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// MP-094（2026-10-29「正式站直接開同步」）：網頁版登入後自動上傳；排程純函式、上傳核心注入假 API 驗證。
globalThis.localStorage = {
  values: new Map(),
  getItem(key) { return this.values.get(key) ?? null; },
  setItem(key, value) { this.values.set(key, String(value)); },
  removeItem(key) { this.values.delete(key); },
};

const {
  AUTO_SYNC_MIN_INTERVAL_MS, AUTO_SYNC_QUIET_MS, AUTO_SYNC_WORKER_UPLOADS_PER_HOUR, getAutoSyncTimings, planNextAutoSync, readAutoSyncState, writeAutoSyncState,
} = await import("../services/cloud/autoSyncPlanner.js");
const { isOfficialSite } = await import("../config/featureFlags.js");
const {
  TEXT_SYNC_DOCUMENT_KEY, TEXT_SYNC_SIZE_LIMITS, TextSyncDocumentTooLargeError, TextSyncRemoteReadError, measureDocumentBytes,
  readTextSyncMeta, saveTextSyncMeta, uploadTextSyncDocument,
} = await import("../services/cloud/textSyncService.js");
const { CloudDataRequestError } = await import("../services/cloud/cloudDataService.js");

// --- 排程 ---
const now = 1_800_000_000_000;
assert.equal(planNextAutoSync({ now, dirty: false }), null, "nothing changed → nothing to do");
assert.equal(planNextAutoSync({ now, dirty: true, blocked: true }), null, "cloud newer → wait for the player, never retry on its own");
assert.equal(planNextAutoSync({ now, dirty: true, lastChangeAt: now, lastAttemptAt: 0 }), AUTO_SYNC_QUIET_MS, "a fresh change waits the quiet period");
assert.equal(planNextAutoSync({ now, dirty: true, lastChangeAt: now - AUTO_SYNC_QUIET_MS, lastAttemptAt: now - 60_000 }), AUTO_SYNC_MIN_INTERVAL_MS - 60_000, "at most one upload per interval");
assert.equal(planNextAutoSync({ now, dirty: true, lastChangeAt: now - 10 * 60_000, lastAttemptAt: now - 10 * 60_000 }), 0, "quiet and interval both satisfied → now");
assert.equal(planNextAutoSync({ now, dirty: true, lastChangeAt: 0, lastAttemptAt: 0, blockedUntil: now + 3600_000 }), 3600_000, "rate limited → wait for retryAfter");
assert.ok(AUTO_SYNC_MIN_INTERVAL_MS >= 2 * 60_000 && 3600_000 / AUTO_SYNC_MIN_INTERVAL_MS <= 30, "stays under the worker's 30 uploads per hour");

// --- 時間設定（2026-10-29）：正式站安靜 15 秒、間隔 2 分鐘；其他網頁維持 45 秒／5 分鐘 ---
assert.deepEqual({ ...getAutoSyncTimings() }, { quietMs: 45_000, minIntervalMs: 5 * 60_000 }, "GitHub Pages / test site / localhost keep 45 s / 5 min");
assert.deepEqual({ ...getAutoSyncTimings({ official: false }) }, { quietMs: AUTO_SYNC_QUIET_MS, minIntervalMs: AUTO_SYNC_MIN_INTERVAL_MS });
const officialTimings = getAutoSyncTimings({ official: true });
assert.deepEqual({ ...officialTimings }, { quietMs: 15_000, minIntervalMs: 2 * 60_000 }, "official site: quiet 15 s, at most every 2 min");
assert.equal(AUTO_SYNC_WORKER_UPLOADS_PER_HOUR, 30);
for (const profile of [getAutoSyncTimings(), officialTimings]) {
  assert.ok(3600_000 / profile.minIntervalMs <= AUTO_SYNC_WORKER_UPLOADS_PER_HOUR, "never more uploads per hour than the worker allows (30/h)");
}
assert.equal(getAutoSyncTimings({ official: true }), officialTimings, "stable object so the hook's callbacks do not churn");
assert.equal(planNextAutoSync({ now, dirty: true, lastChangeAt: now, lastAttemptAt: 0, ...officialTimings }), 15_000, "official: a fresh change waits 15 s");
assert.equal(planNextAutoSync({ now, dirty: true, lastChangeAt: now - 60_000, lastAttemptAt: now - 30_000, ...officialTimings }), 90_000, "official: at most one upload per 2 min");

// --- 正式站判斷（hostname 可注入）---
for (const hostname of ["maliphone.com", "www.maliphone.com", "MaliPhone.com"]) {
  assert.equal(isOfficialSite({ hostname, native: false }), true, `${hostname} is the official site`);
}
for (const hostname of ["ha810505ha.github.io", "maliphone-test.pages.dev", "localhost", "127.0.0.1", "maliphone.com.evil.example", "notmaliphone.com", ""]) {
  assert.equal(isOfficialSite({ hostname, native: false }), false, `${hostname || "(empty)"} keeps the manual buttons`);
}
assert.equal(isOfficialSite({ hostname: "maliphone.com", native: true }), false, "the native app is never treated as the official site");
assert.equal(isOfficialSite(), false, "node (no window/location) is not the official site");

// --- 每帳號狀態 ---
assert.deepEqual(readAutoSyncState("u1").enabled, true, "auto sync defaults on");
writeAutoSyncState("u1", { enabled: false, lastStatus: "failed", lastMessage: "x" });
assert.equal(readAutoSyncState("u1").enabled, false);
assert.equal(readAutoSyncState("u2").enabled, true, "per account");
localStorage.setItem("maliphone_cloud_auto_sync:u3", "{broken");
assert.equal(readAutoSyncState("u3").enabled, true, "broken state falls back to defaults");

// --- 上傳核心（假 API） ---
const notFound = () => Object.assign(new CloudDataRequestError("missing", 404, "DOCUMENT_NOT_FOUND"), {});
const makeApi = ({ existing = null, putResult = { revision: 1, updatedAt: "2026-10-29T00:00:00Z", updatedBy: "web" }, putError = null, getError = null } = {}) => {
  const calls = { get: 0, put: [] };
  return {
    calls,
    api: {
      async getCloudDocument() { calls.get += 1; if (getError) throw getError; if (!existing) throw notFound(); return existing; },
      async putCloudDocument(session, key, data, options) { calls.put.push({ key, data, options }); if (putError) throw putError; return putResult; },
    },
  };
};
const session = { access_token: "t" };
const docOf = (state) => ({ format: "maliphone-text-sync", formatVersion: 1, version: "1.5.3", exportedAt: "x", state });
const getTextSyncDocument = async ({ onMediaSync }) => { onMediaSync?.({ uploaded: 0, failed: 0 }); return docOf({ characters: [{ id: "c1" }], featureData: { gachaCurrency: 5, gachaCrystalLedger: [], notes: [] }, walletData: { wallet: { balance: 1, transactions: [], assets: [] }, characterWallets: {}, transfers: [] } }); };

// 第一次上傳（雲端沒東西）
let { api, calls } = makeApi();
let result = await uploadTextSyncDocument({ session, userId: "u1", getTextSyncDocument, api });
assert.equal(result.status, "uploaded");
assert.equal(result.revision, 1);
assert.equal(calls.put[0].key, TEXT_SYNC_DOCUMENT_KEY);
assert.equal(calls.put[0].options.baseRevision, 0, "first upload uses base revision 0");
assert.equal(readTextSyncMeta("u1").revision, 1, "local meta records the new revision");
assert.equal(result.warning, null);
assert.ok(result.bytes > 100);

// 雲端與本機同版 → 正常上傳，帳本與進度併入
({ api, calls } = makeApi({ existing: { key: TEXT_SYNC_DOCUMENT_KEY, revision: 1, updatedAt: "x", updatedBy: "web", data: docOf({ characters: [], featureData: { gachaCurrency: 5, gachaCrystalLedger: [], notes: [] }, walletData: { wallet: { balance: 1, transactions: [{ id: "t1" }], assets: [] }, characterWallets: {}, transfers: [] } }) }, putResult: { revision: 2 } }));
result = await uploadTextSyncDocument({ session, userId: "u1", getTextSyncDocument, api });
assert.equal(result.status, "uploaded");
assert.equal(calls.put[0].options.baseRevision, 1);
assert.deepEqual(calls.put[0].data.state.walletData.wallet.transactions.map((t) => t.id), ["t1"], "cloud wallet transactions are merged before replacing");

// 雲端較新（另一台上傳過）→ conflict，不送
({ api, calls } = makeApi({ existing: { key: TEXT_SYNC_DOCUMENT_KEY, revision: 9, updatedAt: "y", updatedBy: "android", data: docOf({ characters: [], featureData: {}, walletData: {} }) } }));
result = await uploadTextSyncDocument({ session, userId: "u1", getTextSyncDocument, api });
assert.equal(result.status, "conflict");
assert.equal(result.conflict.currentRevision, 9);
assert.equal(calls.put.length, 0, "no PUT when the cloud is newer");
// force 可覆蓋（玩家確認過）
result = await uploadTextSyncDocument({ session, userId: "u1", getTextSyncDocument, api, force: true });
assert.equal(result.status, "uploaded");
assert.equal(calls.put[0].options.force, true);

// 競爭衝突（409）→ conflict
({ api, calls } = makeApi({ putError: Object.assign(new CloudDataRequestError("conflict", 409, "REVISION_CONFLICT", { currentRevision: 3, updatedAt: "z", updatedBy: "ios" })) }));
saveTextSyncMeta("u1", { revision: 0 });
result = await uploadTextSyncDocument({ session, userId: "u1", getTextSyncDocument, api });
assert.equal(result.status, "conflict");
assert.equal(result.conflict.currentRevision, 3);

// 雲端讀不到（非 404）→ 停止並丟 TextSyncRemoteReadError
({ api } = makeApi({ getError: new Error("network down") }));
await assert.rejects(uploadTextSyncDocument({ session, userId: "u1", getTextSyncDocument, api }), TextSyncRemoteReadError);

// 文件過大 → 不送
({ api, calls } = makeApi());
const big = async () => docOf({ characters: [{ id: "c1", persona: "字".repeat(2000) }], featureData: {}, walletData: {} });
await assert.rejects(uploadTextSyncDocument({ session, userId: "u1", getTextSyncDocument: big, api, limits: { warnBytes: 100, maxBytes: 1000 } }), TextSyncDocumentTooLargeError);
assert.equal(calls.put.length, 0);
result = await uploadTextSyncDocument({ session, userId: "u1", getTextSyncDocument: big, api, limits: { warnBytes: 100, maxBytes: 1_000_000 } });
assert.equal(result.warning, "large", "over the soft limit → warning but still uploaded");
assert.ok(measureDocumentBytes({ a: "字" }) > 3, "bytes, not characters");
assert.ok(TEXT_SYNC_SIZE_LIMITS.maxBytes > TEXT_SYNC_SIZE_LIMITS.warnBytes);

// 限流（429）原樣往上丟，讓呼叫端退避
({ api } = makeApi({ putError: Object.assign(new CloudDataRequestError("slow down", 429, "UPLOAD_RATE_LIMITED"), { retryAfter: 1200 }) }));
await assert.rejects(uploadTextSyncDocument({ session, userId: "u1", getTextSyncDocument, api }), (error) => error.status === 429);

// --- 接線 ---
const account = await readFile(new URL("../components/auth/AccountSettingsSection.jsx", import.meta.url), "utf8");
assert.ok(account.includes("uploadTextSyncDocument({"), "the manual button uses the shared upload core");
assert.ok(!account.includes("const TEXT_SYNC_META_PREFIX"), "sync meta helpers live in the service");
assert.ok(account.includes("autoSync?.available"), "the account page shows the auto-sync switch");
// 正式站：手動上傳／下載、雲端舊版本、手動說明都藏起來；雲端較新時給兩個按鈕。
assert.ok(account.includes("const officialMode = isOfficialSite() && Boolean(autoSync?.available);"), "official mode comes from the hostname helper (and only when auto sync works)");
assert.ok(/\{!officialMode && <div style=\{\{ display: "grid", gridTemplateColumns: uploadAllowed/.test(account), "manual upload/download buttons are hidden on the official site");
assert.ok(/\{!officialMode && <div style=\{\{ marginTop: 10, borderTop[^\n]*\n\s*<div className="mp-version-row"/.test(account), "the cloud history section is hidden on the official site");
assert.ok(account.includes("{!officialMode && <div style={{ marginTop: 3, fontSize: 11, color: \"var(--mp-txt-l)\" }}>{tr(CLOUD_MEDIA_SYNC_TEXT.description)}"), "the manual upload/download paragraph is hidden on the official site");
const officialBlock = account.slice(account.indexOf('{officialMode && autoSync.enabled && autoSync.state?.lastStatus === "cloud-newer"'), account.indexOf('{!officialMode && autoSync.state?.lastStatus === "cloud-newer"'));
assert.ok(officialBlock.includes("downloadTextSync({ confirm: false })"), "\u201cuse the cloud version\u201d downloads without another confirm");
assert.ok(officialBlock.includes("keepLocalVersion("), "\u201cuse this device\u2019s version\u201d reuses the forced-upload path");
assert.ok(account.includes("const conflictOverwrite = () => keepLocalVersion(syncConflict?.currentRevision);"), "the conflict modal and the official button share one forced-upload path");
assert.ok(/keepLocalVersion = \(current\) => \{\s*if \(!window\.confirm\(fillCloudSyncText\(tr\(CLOUD_SYNC_REVISION_TEXT\.overwriteConfirm\)/.test(account), "forced upload keeps the existing confirm text");
const root = await readFile(new URL("../MaliPhone.jsx", import.meta.url), "utf8");
assert.ok(root.includes("useCloudAutoSync({"), "MaliPhone mounts the auto-sync hook");
assert.ok(root.includes("autoSync: cloudAutoSync"), "the account page receives the hook state");
const storage = await readFile(new URL("../utils/indexedDbStorage.js", import.meta.url), "utf8");
assert.ok(storage.includes('dispatchAppDataSaved(changedKeys, "app-state")'), "only real entity writes announce a change");
const hook = await readFile(new URL("../hooks/cloud/useCloudAutoSync.js", import.meta.url), "utf8");
// MP-095：自動下載只走 planAutoDownload 決定的「本機空／無未傳變動」情況，而且一定經過受保護的還原交易（先留快照）。
assert.ok(hook.includes("planAutoDownload({"), "downloads are gated by the pure decision function");
assert.equal((hook.match(/await apply\(remote\.data/g) || []).length, 1, "exactly one download path, through applyTextSyncDocument's protected restore");
assert.ok(hook.includes("APP_DATA_SAVED_EVENT"), "auto sync listens to real saves, not renders");
assert.ok(hook.includes("getAutoSyncTimings({ official })") && hook.includes("const official = isOfficialSite();"), "the hook picks the timing profile by hostname");
assert.equal((hook.match(/\.\.\.timings/g) || []).length, 2, "both the scheduler and the page-hide flush use the chosen profile");
assert.ok(/return \{[^}]*\buploading\b[^}]*\bpending\b[^}]*getNextUploadAt/.test(hook), "the hook exposes uploading / pending / next upload time for the status line");
console.log("ok: web auto sync uploads after real saves (official site 15 s / 2 min, elsewhere 45 s / 5 min), pauses when the cloud is newer, and the official site hides manual cloud buttons (MP-094/095)");
