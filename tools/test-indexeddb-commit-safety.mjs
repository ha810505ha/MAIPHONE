import assert from "node:assert/strict";

const records = new Map();
let failOnKey = null;

globalThis.localStorage = {
  values: new Map([["mali_device_id", "test-device"]]),
  getItem(key) { return this.values.get(key) ?? null; },
  setItem(key, value) { this.values.set(key, String(value)); },
};

function requestFor(result) {
  const request = { result: undefined, error: null, onsuccess: null, onerror: null };
  queueMicrotask(() => {
    request.result = result;
    request.onsuccess?.();
  });
  return request;
}

globalThis.indexedDB = {
  open() {
    const request = { result: null, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
    queueMicrotask(() => {
      request.result = {
        objectStoreNames: { contains: () => true },
        close() {},
        transaction(_storeName, mode) {
          const staged = [];
          let failed = false;
          const transaction = {
            error: null,
            oncomplete: null,
            onerror: null,
            objectStore: () => ({
              get: (key) => requestFor(records.get(key)),
              put: (value, key) => {
                if (mode === "readwrite" && key === failOnKey) failed = true;
                staged.push(["put", key, value]);
              },
              delete: (key) => {
                if (mode === "readwrite" && key === failOnKey) failed = true;
                staged.push(["delete", key]);
              },
            }),
          };
          queueMicrotask(() => queueMicrotask(() => {
            if (failed) {
              transaction.error = new Error("simulated transaction failure");
              transaction.onerror?.();
              return;
            }
            for (const [operation, key, value] of staged) {
              if (operation === "put") records.set(key, value);
              else records.delete(key);
            }
            transaction.oncomplete?.();
          }));
          return transaction;
        },
      };
      request.onsuccess?.();
    });
    return request;
  },
};

const {
  applyRemoteEntities,
  getSyncOutbox,
  readEntity,
  saveAppState,
} = await import("../utils/indexedDbStorage.js");

const snapshot = {
  characters: [],
  chatHistory: {},
  chatBackgrounds: {},
  posts: [],
  phoneInboxCache: {},
  phoneAppCache: {},
  apiConfig: {},
  ttsConfig: {},
  marker: "retry-me",
};

failOnKey = "ent_core";
await assert.rejects(() => saveAppState(snapshot));
assert.equal(await readEntity("ent_core"), null);

// 完全相同的物件參照也必須重試；失敗交易不可先污染 lastSaved/revision。
failOnKey = null;
await saveAppState(snapshot);
const retried = await readEntity("ent_core");
assert.equal(retried.data.marker, "retry-me");
assert.equal(retried.rev, 1);
assert.equal(typeof (await getSyncOutbox()).ent_core, "number");

// 遠端套用失敗也不可先提高 lastRevs，否則重試會被當成本機 echo 跳過。
const remote = {
  key: "ent_core",
  data: { ...retried.data, marker: "remote-retry" },
  updatedAt: Date.now() + 10_000,
  rev: 9,
  deviceId: "test-device",
  deleted: false,
};
failOnKey = "ent_core";
await assert.rejects(() => applyRemoteEntities([remote]));
assert.equal((await readEntity("ent_core")).data.marker, "retry-me");

failOnKey = null;
assert.equal(await applyRemoteEntities([remote]), 1);
assert.equal((await readEntity("ent_core")).data.marker, "remote-retry");

// 同時抵達的本機存檔必須依呼叫順序執行，最後一份 snapshot 留在資料庫。
const second = { ...snapshot, marker: "second" };
const third = { ...snapshot, marker: "third" };
await Promise.all([saveAppState(second), saveAppState(third)]);
const finalEntity = await readEntity("ent_core");
assert.equal(finalEntity.data.marker, "third");
assert.equal(finalEntity.rev, 11);

console.log("ok: failed IndexedDB writes keep memory clean, retry, and serialize later snapshots");
