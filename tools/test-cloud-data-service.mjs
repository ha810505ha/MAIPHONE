import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import {
  CloudDataRequestError,
  CloudDataUnavailableError,
  getCloudDataConfig,
  getCloudDocument,
  isCloudDocumentNotFound,
  putCloudDocument,
  requestCloudData,
  runCloudDatabaseConnectionTest,
} from "../services/cloud/cloudDataService.js";
import { createTextSyncDocument, validateTextSyncDocument } from "../utils/textSyncDocument.js";
import { mergeWalletSyncData } from "../utils/walletSync.js";
import { mergeGameProgressSyncData, mergeTextSyncFeatureData } from "../utils/gameProgressSync.js";
import { NetworkTimeoutError } from "../utils/networkRequest.js";
import { conflictFromError, getDeviceLabel, resolveUploadBase } from "../services/cloud/cloudSyncRevision.js";
import { CLOUD_SYNC_REVISION_TEXT, fillCloudSyncText } from "../constants/cloudSyncRevisionText.js";
import { isCloudRevisionConflict, isCloudUploadRateLimited } from "../services/cloud/cloudDataService.js";

assert.deepEqual(getCloudDataConfig({}), { url: "", configured: false });
assert.deepEqual(
  getCloudDataConfig({ VITE_CLOUDFLARE_DATA_API_URL: "https://worker.example/" }),
  { url: "https://worker.example", configured: true },
);
await assert.rejects(runCloudDatabaseConnectionTest(null, {}), CloudDataUnavailableError);

const originalFetch = globalThis.fetch;
try {
  let call = 0;
  let testedAt = "";
  globalThis.fetch = async (input, init) => {
    call += 1;
    assert.equal(String(input), "https://worker.example/v1/documents/d1-connection-test");
    assert.equal(init.headers.Authorization, "Bearer test-access-token");
    assert.equal(init.cache, "no-store");
    if (call === 1) {
      assert.equal(init.method, "PUT");
      testedAt = JSON.parse(init.body).testedAt;
      return Response.json({ key: "d1-connection-test", revision: 1 });
    }
    assert.equal(init.method, "GET");
    return Response.json({ key: "d1-connection-test", data: { message: "MaliPhone D1 connection test", testedAt } });
  };
  const document = await runCloudDatabaseConnectionTest(
    { access_token: "test-access-token" },
    { VITE_CLOUDFLARE_DATA_API_URL: "https://worker.example" },
  );
  assert.equal(document.data.testedAt, testedAt);
  assert.equal(call, 2);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("ok: cloud database test requires an authenticated user and verifies a private D1 document");

const environment = { VITE_CLOUDFLARE_DATA_API_URL: "https://worker.example" };
const session = { access_token: "test-access-token" };
const key = "app-text-sync-v1";
const source = await readFile(new URL("../components/auth/AccountSettingsSection.jsx", import.meta.url), "utf8");
const start = source.indexOf("const uploadTextSync = async ({ force = false } = {}) => {");
const end = source.indexOf("\n  const downloadTextSync", start);
assert.ok(start >= 0 && end > start);
const uploadExpression = source.slice(start, end).replace("const uploadTextSync = ", "").trim().replace(/;$/, "");

function fixtureDocument(remote = false) {
  return createTextSyncDocument({
    wallet: {
      balance: remote ? 80 : 130,
      transactions: [
        { id: "initial", type: "income", amount: 100, time: 1 },
        { id: remote ? "remote-expense" : "local-income", type: remote ? "expense" : "income", amount: remote ? 20 : 30, time: remote ? 4 : 3 },
      ],
      assets: [{ id: remote ? "remote-asset" : "local-asset", qty: 1 }],
    },
    featureData: {
      notes: [{ id: remote ? "remote-note" : "local-note", content: "Synthetic fixture" }],
      gachaCurrency: remote ? 80 : 150,
      gachaCrystalLedger: [
        { id: "initial", type: "initial", amount: 100, time: 1, balanceAfter: 100 },
        { id: remote ? "remote-spend" : "local-login", type: remote ? "expense" : "income", amount: remote ? 20 : 50, time: remote ? 4 : 3, balanceAfter: remote ? 80 : 150 },
      ],
      loginReward: { cycle: 1, day: remote ? 3 : 2, lastClaimDate: remote ? "2026-08-13" : "2026-08-12", claimedDates: remote ? ["2026-08-12", "2026-08-13"] : ["2026-08-11", "2026-08-12"] },
      yunyinSave: { coins: remote ? 140 : 120, lastSeenAt: remote ? 7 : 5 },
      systemMailbox: { readMailIds: [remote ? "mail-2" : "mail-1"], claimedGrantIds: [remote ? "grant-2" : "grant-1"] },
    },
  });
}
const local = fixtureDocument(), remote = fixtureDocument(true);
const remoteEnvelope = { key, data: remote, revision: 7, updatedAt: "2026-08-13T00:00:00.000Z" };

// v3 上傳格式：一行中繼資料 JSON ＋ "\n" ＋ payload（可能 gzip）。
async function decodeSyncUpload(init) {
  assert.equal(init.headers["Content-Type"], "application/x-maliphone-sync");
  assert.equal(init.headers["X-Mali-Client"], "2");
  const bytes = init.body;
  const newline = bytes.indexOf(0x0a);
  assert.ok(newline > 0, "upload body starts with a metadata line");
  const meta = JSON.parse(new TextDecoder().decode(bytes.subarray(0, newline)));
  assert.ok(Array.isArray(meta.mediaRefs));
  let payload = bytes.subarray(newline + 1);
  if (init.headers["X-Mali-Payload-Encoding"] === "gzip") {
    payload = new Uint8Array(await new Response(new Blob([payload]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
  }
  return JSON.parse(new TextDecoder().decode(payload));
}

async function runUpload(readResponse, { cancel = false, captureFails = false, putFails = false, putConflict = false, localRevision = 7, force = false } = {}) {
  const outcome = { requests: [], statuses: [], failed: [], busy: [], meta: [], notifications: [], captures: 0, conflicts: [], putHeaders: [], cloud: structuredClone(remoteEnvelope), local: structuredClone(local) };
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), `${environment.VITE_CLOUDFLARE_DATA_API_URL}/v1/documents/${key}`);
    assert.equal(init.headers.Authorization, "Bearer test-access-token");
    outcome.requests.push(init.method);
    if (init.method === "GET") return readResponse();
    assert.equal(init.method, "PUT");
    outcome.putHeaders.push(init.headers);
    if (putFails) return Response.json({ error: "Fixture write failure" }, { status: 503 });
    if (putConflict) return Response.json({ error: "Revision conflict", code: "REVISION_CONFLICT", currentRevision: 9, updatedAt: "2026-08-15T00:00:00.000Z", updatedBy: "Android" }, { status: 409 });
    outcome.cloud = { key, data: await decodeSyncUpload(init), revision: 8, updatedAt: "2026-08-14T00:00:00.000Z" };
    return Response.json(outcome.cloud);
  };
  const upload = vm.runInNewContext(`(${uploadExpression})`, {
    window: { confirm: () => !cancel }, auth: { session, user: { id: "fixture-user" } },
    TEXT_SYNC_DOCUMENT_KEY: key, text: (zh) => zh,
    // Cloud media (MP-024): confirm text is a locale map and the summary is appended to the status.
    tr: (value) => (value && typeof value === "object" ? value["zh-TW"] : value),
    CLOUD_MEDIA_SYNC_TEXT: { uploadConfirm: { "zh-TW": "confirm" } }, cloudMediaSyncSummary: () => "",
    textSyncProps: { getTextSyncDocument: async () => { outcome.captures++; if (captureFails) throw new Error("Fixture capture failure"); return structuredClone(outcome.local); } },
    getCloudDocument: (value, docKey) => getCloudDocument(value, docKey, environment),
    putCloudDocument: (value, docKey, data, options = {}) => putCloudDocument(value, docKey, data, { ...options, environment }),
    isCloudDocumentNotFound, validateTextSyncDocument, mergeWalletSyncData, mergeGameProgressSyncData, mergeTextSyncFeatureData,
    // MP-032 P2：本機上次同步的版號與衝突處理。
    readTextSyncMeta: () => (localRevision ? { revision: localRevision } : null),
    resolveUploadBase, conflictFromError, isCloudRevisionConflict, isCloudUploadRateLimited, getDeviceLabel: () => "Fixture",
    CLOUD_SYNC_REVISION_TEXT, fillCloudSyncText,
    setSyncConflict: (value) => outcome.conflicts.push(value), setHistoryState() {}, setHistoryOpen() {},
    setTextSyncBusy: (value) => outcome.busy.push(value), setTextSyncStatus: (value) => outcome.statuses.push(value),
    setTextSyncFailed: (value) => outcome.failed.push(value),
    saveTextSyncMeta: (id, value) => outcome.meta.push({ id, value }),
    setTextSyncMeta: (value) => outcome.meta.push(value), setRemoteTextSyncMeta: (value) => outcome.meta.push(value),
    notify: (value) => outcome.notifications.push(value),
  });
  await upload(force ? { force: true } : undefined);
  assert.deepEqual(outcome.local, local, "upload must not mutate device data");
  if (!cancel) assert.deepEqual(outcome.busy, [true, false], "failure and success must release the busy state");
  return outcome;
}

try {
  for (const [path, method, response, missing] of [
    [`/v1/documents/${key}`, "GET", () => Response.json({ error: "Document not found" }, { status: 404 }), true],
    [`/v1/documents/${key}`, "PUT", () => Response.json({ error: "Document not found" }, { status: 404 }), false],
    ["/missing-route", "GET", () => Response.json({ error: "Document not found" }, { status: 404 }), false],
    [`/v1/documents/${key}`, "GET", () => new Response("Document not found", { status: 404 }), false],
    [`/v1/documents/${key}`, "GET", () => Response.json({ error: "Route not found" }, { status: 404 }), false],
  ]) {
    globalThis.fetch = async () => response();
    await assert.rejects(requestCloudData(path, { session, method, environment }), (error) => {
      assert.ok(error instanceof CloudDataRequestError);
      assert.equal(error.status, 404);
      assert.equal(isCloudDocumentNotFound(error), missing);
      return true;
    });
  }
  for (const status of [401, 403, 429, 500, 503]) {
    globalThis.fetch = async () => Response.json({ error: "Fixture read failure" }, { status });
    await assert.rejects(getCloudDocument(session, key, environment), (error) => error.status === status && !isCloudDocumentNotFound(error));
  }

  const failures = [
    ...[401, 403, 429, 500, 503].map((status) => [`HTTP ${status}`, () => Response.json({ error: "Document not found" }, { status })]),
    ["404 HTML", () => new Response("<h1>Not found</h1>", { status: 404 })],
    ["404 wrong route", () => Response.json({ error: "Route not found" }, { status: 404 })],
    ["404 malformed JSON", () => new Response("{bad", { status: 404, headers: { "Content-Type": "application/json" } })],
    ["200 null", () => Response.json(null)],
    ["200 wrong key", () => Response.json({ ...remoteEnvelope, key: "unexpected-document" })],
    ["200 invalid format", () => Response.json({ ...remoteEnvelope, data: { ...remote, format: "unexpected" } })],
    ["200 invalid state", () => Response.json({ ...remoteEnvelope, data: { ...remote, state: [] } })],
    ["200 malformed JSON", () => new Response("{bad", { headers: { "Content-Type": "application/json" } })],
    ["timeout", () => { throw new NetworkTimeoutError(20000); }],
    ["network", () => { throw new TypeError("Fixture network failure"); }],
    ["cancelled request", () => { throw new DOMException("Fixture cancellation", "AbortError"); }],
  ];
  for (const [name, response] of failures) {
    const outcome = await runUpload(response);
    assert.deepEqual(outcome.requests, ["GET"], `${name}: no PUT after an uncertain read`);
    assert.equal(outcome.captures, 0, `${name}: do not prepare an upload before the read is safe`);
    assert.deepEqual(outcome.cloud, remoteEnvelope, `${name}: retain existing cloud data`);
    assert.deepEqual(outcome.meta, [], `${name}: do not record success`);
    assert.deepEqual(outcome.notifications, []);
    assert.match(outcome.statuses.at(-1), /已停止上傳/);
    assert.equal(outcome.failed.at(-1), true);
  }
  const first = await runUpload(() => Response.json({ error: "Document not found" }, { status: 404 }));
  assert.deepEqual(first.requests, ["GET", "PUT"]);
  assert.deepEqual(first.cloud.data, local, "explicit absence permits a first upload without inventing remote state");
  assert.equal(first.notifications.length, 1);
  const merged = await runUpload(() => Response.json(remoteEnvelope));
  assert.deepEqual(merged.requests, ["GET", "PUT"]);
  assert.equal(merged.cloud.data.state.walletData.wallet.balance, 110);
  assert.equal(merged.cloud.data.state.walletData.wallet.transactions.length, 3);
  assert.equal(merged.cloud.data.state.walletData.wallet.assets.length, 2);
  assert.equal(merged.cloud.data.state.featureData.gachaCurrency, 130);
  assert.equal(merged.cloud.data.state.featureData.gachaCrystalLedger.length, 3);
  assert.deepEqual(merged.cloud.data.state.featureData.loginReward.claimedDates, ["2026-08-11", "2026-08-12", "2026-08-13"]);
  assert.equal(merged.cloud.data.state.featureData.yunyinSave.coins, 140);
  assert.deepEqual(merged.cloud.data.state.featureData.systemMailbox.readMailIds, ["mail-1", "mail-2"]);
  assert.equal(merged.cloud.data.state.featureData.notes[0].id, "local-note", "manual text overwrite remains unchanged");
  assert.equal(merged.meta.length, 3);
  assert.equal(merged.meta[0].value.revision, 8);
  assert.equal(merged.failed.at(-1), false);
  assert.equal(merged.putHeaders[0]["X-Mali-Base-Revision"], "7", "upload sends the revision this device last synced");
  assert.equal(merged.putHeaders[0]["X-Mali-Device"], "Fixture");
  assert.equal(first.putHeaders[0]["X-Mali-Base-Revision"], "0", "first upload expects no cloud copy");

  // P2：雲端比這台新（或這台沒有同步紀錄）時，不準備也不送出上傳，改顯示衝突選擇。
  for (const [name, localRevision, reason] of [["remote newer", 5, "remote-newer"], ["never synced", 0, "never-synced"]]) {
    const blocked = await runUpload(() => Response.json(remoteEnvelope), { localRevision });
    assert.deepEqual(blocked.requests, ["GET"], `${name}: no PUT when the cloud may be newer`);
    assert.equal(blocked.captures, 0, `${name}: do not prepare an upload`);
    assert.deepEqual(blocked.cloud, remoteEnvelope, `${name}: cloud data is untouched`);
    assert.deepEqual(blocked.meta, [], `${name}: do not record success`);
    assert.equal(blocked.conflicts.length, 1);
    assert.equal(blocked.conflicts[0].reason, reason);
    assert.equal(blocked.conflicts[0].currentRevision, 7);
  }
  // 玩家確認「仍要用這台覆蓋」：略過比對但送 force，被蓋掉的版本由 worker 保留。
  const forced = await runUpload(() => Response.json(remoteEnvelope), { localRevision: 5, force: true });
  assert.deepEqual(forced.requests, ["GET", "PUT"]);
  assert.equal(forced.putHeaders[0]["X-Mali-Base-Revision-Force"], "1");
  assert.equal(forced.putHeaders[0]["X-Mali-Base-Revision"], undefined);
  assert.equal(forced.conflicts.length, 0);
  // 兩台幾乎同時上傳：worker 回 409，後到的那台顯示衝突、不記成功。
  const raced = await runUpload(() => Response.json(remoteEnvelope), { putConflict: true });
  assert.deepEqual(raced.requests, ["GET", "PUT"]);
  assert.deepEqual(raced.meta, []);
  assert.deepEqual(raced.notifications, []);
  assert.equal(raced.conflicts.length, 1);
  assert.equal(raced.conflicts[0].currentRevision, 9);
  assert.equal(raced.conflicts[0].updatedBy, "Android");

  const writeFailure = await runUpload(() => Response.json(remoteEnvelope), { putFails: true });
  assert.deepEqual(writeFailure.requests, ["GET", "PUT"]);
  assert.deepEqual(writeFailure.cloud, remoteEnvelope);
  assert.deepEqual(writeFailure.meta, []);
  assert.deepEqual(writeFailure.notifications, []);
  assert.match(writeFailure.statuses.at(-1), /Fixture write failure/);
  const captureFailure = await runUpload(() => Response.json(remoteEnvelope), { captureFails: true });
  assert.deepEqual(captureFailure.requests, ["GET"]);
  assert.deepEqual(captureFailure.meta, []);
  const cancelled = await runUpload(() => Response.json(remoteEnvelope), { cancel: true });
  assert.deepEqual(cancelled.requests, []);
  assert.deepEqual(cancelled.meta, []);
} finally {
  globalThis.fetch = originalFetch;
}
console.log("ok: account upload stops on uncertain reads; only confirmed document absence permits creation; existing ledgers and game progress survive merging");
