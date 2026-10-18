import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { conflictFromError, getDeviceLabel, metaAfterHistoryRestore, resolveUploadBase } from "../services/cloud/cloudSyncRevision.js";
import { CloudDataRequestError, isCloudRevisionConflict, putCloudDocument } from "../services/cloud/cloudDataService.js";
import { CLOUD_SYNC_REVISION_TEXT, fillCloudSyncText } from "../constants/cloudSyncRevisionText.js";
import { CLOUD_MEDIA_SYNC_TEXT } from "../constants/cloudMediaSyncText.js";

// 1. baseRevision 與衝突判斷（MP-032 P2，規格情境 1～3）
assert.deepEqual(resolveUploadBase({ meta: null, remote: null }), { baseRevision: 0, conflict: null }, "first upload with no cloud copy uses base 0");
assert.deepEqual(resolveUploadBase({ meta: { revision: 4 }, remote: null }), { baseRevision: 0, conflict: null }, "cloud copy missing still creates with base 0");
assert.deepEqual(resolveUploadBase({ meta: { revision: 7 }, remote: { revision: 7 } }), { baseRevision: 7, conflict: null }, "matching revision uploads normally");

const newer = resolveUploadBase({ meta: { revision: 10 }, remote: { revision: 12, updatedAt: "2026-10-16T13:30:00Z", updatedBy: "Android" } });
assert.equal(newer.conflict.reason, "remote-newer");
assert.equal(newer.conflict.currentRevision, 12);
assert.equal(newer.conflict.localRevision, 10);
assert.equal(newer.conflict.updatedBy, "Android");

const never = resolveUploadBase({ meta: null, remote: { revision: 3 } });
assert.equal(never.conflict.reason, "never-synced", "a device without sync history must not silently overwrite an existing cloud save");
assert.equal(resolveUploadBase({ meta: { revision: "bad" }, remote: { revision: 2 } }).conflict.reason, "never-synced");
assert.equal(resolveUploadBase({ meta: { revision: 9 }, remote: { revision: 2 } }).conflict.reason, "mismatch", "a cloud reset is not overwritten silently");

// 2. worker 409 轉成衝突
const error = new CloudDataRequestError("Revision conflict", 409, "REVISION_CONFLICT", { currentRevision: 15, updatedAt: "t", updatedBy: "Windows Chrome" });
assert.equal(isCloudRevisionConflict(error), true);
assert.equal(isCloudRevisionConflict(new CloudDataRequestError("x", 409, undefined)), false);
assert.deepEqual(conflictFromError(error, { revision: 14 }), { reason: "remote-newer", currentRevision: 15, localRevision: 14, updatedAt: "t", updatedBy: "Windows Chrome" });
assert.equal(conflictFromError(new Error("network"), {}), null);

// 3. 找回舊版後的 meta：版號記成雲端最新版，之後上傳不會被誤擋（情境 4）
const restored = metaAfterHistoryRestore({ restoredRevision: 9, headRevision: 12, headUpdatedAt: "h", at: "now" });
assert.deepEqual(restored, { action: "restore-history", at: "now", revision: 12, restoredRevision: 9, remoteUpdatedAt: "h" });
assert.deepEqual(resolveUploadBase({ meta: restored, remote: { revision: 12 } }), { baseRevision: 12, conflict: null });

// 4. 裝置標籤只含粗略類型
assert.equal(getDeviceLabel({ Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" } }), "Android");
assert.equal(getDeviceLabel({ navigator: { userAgent: "Mozilla/5.0 (Windows NT 10.0) AppleWebKit Chrome/140.0 Safari/537.36" } }), "Windows Chrome");
assert.equal(getDeviceLabel({ navigator: { userAgent: "" } }), "Web");
assert.ok(getDeviceLabel({ navigator: { userAgent: "x".repeat(200) } }).length <= 40);

// 5. 上傳時送出的標頭
const calls = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), init });
  return new Response(JSON.stringify({ key: "k", revision: 8 }), { status: 200, headers: { "Content-Type": "application/json" } });
};
try {
  const environment = { VITE_CLOUDFLARE_DATA_API_URL: "https://worker.example" };
  const session = { access_token: "token" };
  await putCloudDocument(session, "app-text-sync-v1", { a: 1 }, { baseRevision: 7, device: "Android", environment });
  assert.equal(calls[0].init.headers["X-Mali-Base-Revision"], "7");
  assert.equal(calls[0].init.headers["X-Mali-Device"], "Android");
  assert.equal(calls[0].init.headers["X-Mali-Base-Revision-Force"], undefined);
  await putCloudDocument(session, "app-text-sync-v1", { a: 1 }, { force: true, environment });
  assert.equal(calls[1].init.headers["X-Mali-Base-Revision-Force"], "1");
  assert.equal(calls[1].init.headers["X-Mali-Base-Revision"], undefined, "force overwrites never send a stale base");
  await putCloudDocument(session, "app-text-sync-v1", { a: 1 }, environment);
  assert.equal(calls[2].init.headers["X-Mali-Base-Revision"], undefined, "legacy environment argument still works");

  globalThis.fetch = async () => new Response(JSON.stringify({ error: "Revision conflict", code: "REVISION_CONFLICT", currentRevision: 21 }), { status: 409, headers: { "Content-Type": "application/json" } });
  await assert.rejects(() => putCloudDocument(session, "k", {}, { baseRevision: 20, environment }), (err) => isCloudRevisionConflict(err) && err.currentRevision === 21);
} finally {
  globalThis.fetch = originalFetch;
}

// 5b. v3：裝置端壓縮、圖片引用清單、從標頭讀版號、429
{
  const { encodeSyncPayload, collectSyncMediaRefs } = await import("../services/cloud/cloudSyncPayload.js");
  const { getCloudDocument, getCloudDocumentHistoryVersion, isCloudUploadRateLimited } = await import("../services/cloud/cloudDataService.js");
  const hashA = "a".repeat(64), hashB = "b".repeat(64);
  const sample = { format: "x", state: { avatar: `maliphone-media:sha256-${hashA}.webp`, bg: `maliphone-media:sha256-${hashB}.jpg`, again: `maliphone-media:sha256-${hashA}.webp` } };
  assert.deepEqual(collectSyncMediaRefs(JSON.stringify(sample)).sort(), [`sha256-${hashA}.webp`, `sha256-${hashB}.jpg`], "media refs are deduplicated and use the worker's name format");

  const decode = async ({ body, encoding }) => {
    const newline = body.indexOf(0x0a);
    const meta = JSON.parse(new TextDecoder().decode(body.subarray(0, newline)));
    let payload = body.subarray(newline + 1);
    if (encoding === "gzip") {
      assert.deepEqual([payload[0], payload[1]], [0x1f, 0x8b], "gzip payload starts with the gzip magic bytes");
      payload = new Uint8Array(await new Response(new Blob([payload]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
    }
    return { meta, data: JSON.parse(new TextDecoder().decode(payload)) };
  };
  const gz = await encodeSyncPayload(sample);
  assert.equal(gz.encoding, "gzip");
  assert.deepEqual((await decode(gz)).data, sample, "gzip round trip keeps the save intact");
  assert.equal((await decode(gz)).meta.mediaRefs.length, 2);

  const noCompression = { ...globalThis, CompressionStream: undefined };
  const plain = await encodeSyncPayload(sample, { env: noCompression });
  assert.equal(plain.encoding, "identity", "browsers without CompressionStream send uncompressed data");
  assert.deepEqual((await decode(plain)).data, sample);

  // 重度玩家：約 3.6MB 的聊天文字要能壓到 20MB 上限以內，且明顯變小。
  const messages = Array.from({ length: 10000 }, (_, index) => ({ id: `m${index}`, role: index % 2 ? "assistant" : "user", content: `今天天氣很好，我們去散步吧。這是第 ${index} 則訊息，角色回覆內容會有不少重複的句型與語氣。` }));
  const heavy = await encodeSyncPayload({ format: "x", state: { messages } });
  assert.ok(heavy.rawBytes > 1_500_000, `fixture is large (${heavy.rawBytes} bytes)`);
  assert.ok(heavy.payloadBytes < heavy.rawBytes / 4, `compression shrinks chat text a lot (${heavy.rawBytes} -> ${heavy.payloadBytes})`);
  assert.ok(heavy.payloadBytes < 20 * 1024 * 1024);

  const environment = { VITE_CLOUDFLARE_DATA_API_URL: "https://worker.example" };
  const session = { access_token: "token" };
  const originalFetch2 = globalThis.fetch;
  try {
    let seenHeaders;
    globalThis.fetch = async (url, init) => {
      seenHeaders = init.headers;
      return new Response(JSON.stringify(sample), { status: 200, headers: { "Content-Type": "application/json", "X-Mali-Revision": "12", "X-Mali-Updated-At": "2026-10-16 10:00:00", "X-Mali-Updated-By": "Android", "X-Mali-Document-Key": "app-text-sync-v1" } });
    };
    const doc = await getCloudDocument(session, "app-text-sync-v1", environment);
    assert.equal(seenHeaders["X-Mali-Client"], "2", "reads ask the worker for the v3 response format");
    assert.deepEqual(doc, { key: "app-text-sync-v1", data: sample, revision: 12, updatedAt: "2026-10-16 10:00:00", updatedBy: "Android" });
    const version = await getCloudDocumentHistoryVersion(session, "app-text-sync-v1", 11, environment);
    assert.equal(version.revision, 12);

    // 舊 worker 或尚未搬到 R2 的資料仍回舊格式。
    globalThis.fetch = async () => new Response(JSON.stringify({ key: "k", data: sample, revision: 3, updatedAt: "t" }), { status: 200, headers: { "Content-Type": "application/json" } });
    assert.equal((await getCloudDocument(session, "k", environment)).revision, 3);

    // 503＋Retry-After（R2 版本名稱暫時被占用）：自動重試後成功。
    let tries = 0;
    globalThis.fetch = async () => {
      tries += 1;
      if (tries === 1) return new Response(JSON.stringify({ error: "Document upload in progress" }), { status: 503, headers: { "Content-Type": "application/json", "Retry-After": "1" } });
      return new Response(JSON.stringify({ key: "k", revision: 4 }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    assert.equal((await putCloudDocument(session, "k", sample, { baseRevision: 3, environment })).revision, 4);
    assert.equal(tries, 2, "a short 503 is retried once");
    // 一般 503（沒有短 Retry-After）不重試。
    tries = 0;
    globalThis.fetch = async () => { tries += 1; return new Response(JSON.stringify({ error: "R2 bucket is not configured" }), { status: 503, headers: { "Content-Type": "application/json" } }); };
    await assert.rejects(() => putCloudDocument(session, "k", sample, { baseRevision: 3, environment }));
    assert.equal(tries, 1);

    globalThis.fetch = async () => new Response(JSON.stringify({ error: "Too many uploads", code: "UPLOAD_RATE_LIMITED", retryAfter: 900 }), { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "900" } });
    await assert.rejects(() => putCloudDocument(session, "k", sample, { baseRevision: 3, environment }), (err) => isCloudUploadRateLimited(err) && err.retryAfter === 900);
  } finally {
    globalThis.fetch = originalFetch2;
  }
  assert.ok(CLOUD_SYNC_REVISION_TEXT.rateLimited, "rate-limit message exists");
}

// 6. 介面文字五語系齊全、占位符一致；不再出現只同步「文字」的說法
const LANGS = ["zh-TW", "zh-CN", "en", "ja", "ko"];
for (const [key, entry] of Object.entries(CLOUD_SYNC_REVISION_TEXT)) {
  const placeholders = (entry["zh-TW"].match(/\{\w+\}/g) || []).sort().join();
  for (const lang of LANGS) {
    assert.ok(entry[lang], `${key} is missing ${lang}`);
    assert.equal((entry[lang].match(/\{\w+\}/g) || []).sort().join(), placeholders, `${key}.${lang} keeps the same placeholders`);
  }
}
for (const key of ["uploadConfirm", "downloadConfirm", "description"]) {
  for (const lang of LANGS) assert.ok(CLOUD_MEDIA_SYNC_TEXT[key][lang], `${key} is missing ${lang}`);
  assert.ok(!/文字資料/.test(CLOUD_MEDIA_SYNC_TEXT[key]["zh-TW"]), `${key} no longer describes sync as text-only`);
}
assert.equal(fillCloudSyncText("第 {revision} 版", { revision: 3 }), "第 3 版");
assert.equal(fillCloudSyncText("{missing}", {}), "{missing}");

// 7. 帳號畫面接上版本檢查、衝突對話框與舊版本
const ui = await readFile(new URL("../components/auth/AccountSettingsSection.jsx", import.meta.url), "utf8");
for (const needle of ["resolveUploadBase(", "isCloudRevisionConflict(error)", "listCloudDocumentHistory(", "getCloudDocumentHistoryVersion(", "metaAfterHistoryRestore(", "textSyncProps.applyTextSyncDocument(version.data", "force: true", "createPortal("]) {
  assert.ok(ui.includes(needle), `AccountSettingsSection must use ${needle}`);
}
assert.ok(!/文字同步測試|上傳此裝置文字|下載雲端文字/.test(ui), "account card no longer labels sync as text-only");

console.log("ok: cloud sync revision checks block stale uploads, keep legacy calls working, restore history safely, and stay localized");
