import assert from "node:assert/strict";

// MP-090：Android WebView 清掉整個 IndexedDB 但留下 localStorage 時，開機不能用空資料當成第一次使用。
// 每次存檔後在 localStorage 留「上次有幾位角色／幾則訊息」的標記，開機四種格式都讀不到時就發出通知。
const records = new Map();
globalThis.localStorage = {
  values: new Map([["mali_device_id", "test-device"]]),
  getItem(key) { return this.values.get(key) ?? null; },
  setItem(key, value) { this.values.set(key, String(value)); },
  removeItem(key) { this.values.delete(key); },
};

function requestFor(result) {
  const request = { result: undefined, error: null, onsuccess: null, onerror: null };
  queueMicrotask(() => {
    request.result = result;
    request.onsuccess?.();
  });
  return request;
}

globalThis.IDBKeyRange = { bound: (lower, upper) => ({ lower, upper }) };
globalThis.indexedDB = {
  open() {
    const request = { result: null, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
    queueMicrotask(() => {
      request.result = {
        objectStoreNames: { contains: () => true },
        close() {},
        transaction() {
          const staged = [];
          const transaction = {
            error: null,
            oncomplete: null,
            onerror: null,
            objectStore: () => ({
              get: (key) => requestFor(records.get(key)),
              getAllKeys: (range) => requestFor([...records.keys()].filter((key) => key >= range.lower && key <= range.upper)),
              getAll: (range) => requestFor([...records.entries()].filter(([key]) => key >= range.lower && key <= range.upper).map(([, value]) => value)),
              put: (value, key) => staged.push(["put", key, value]),
              delete: (key) => staged.push(["delete", key]),
            }),
          };
          queueMicrotask(() => queueMicrotask(() => {
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
  loadAppState, saveAppState, getStorageWipeNotice, acknowledgeStorageWipe, clearStorageMarker, resetLocalEntities,
} = await import("../utils/indexedDbStorage.js");

const defaults = { characters: [], chatHistory: {}, chatBackgrounds: {}, posts: [], phoneInboxCache: {}, phoneAppCache: {}, apiConfig: {}, ttsConfig: {} };
const MARKER = "mali_storage_marker_v1";

// 第一次使用：沒有標記、沒有資料 → 正常用預設開機，沒有通知。
await loadAppState(defaults);
assert.equal(getStorageWipeNotice(), null, "a brand new install has nothing to warn about");

const played = {
  ...defaults,
  characters: [{ id: "c1", name: "A" }, { id: "c2", name: "B" }],
  chatHistory: { c1: [{ id: "m1" }, { id: "m2" }, { id: "m3" }], c2: [{ id: "m4" }] },
};
await saveAppState(played);
const marker = JSON.parse(localStorage.getItem(MARKER));
assert.equal(marker.characters, 2, "the marker records how many characters were last saved");
assert.equal(marker.messages, 4, "the marker records how many messages were last saved");
assert.ok(marker.savedAt > 0);

// 資料還在：開機讀到實體，沒有通知。
const reloaded = await loadAppState(defaults);
assert.equal(reloaded.characters.length, 2);
assert.equal(getStorageWipeNotice(), null);

// 系統清掉整個 IndexedDB（localStorage 還在）→ 開機必須發出通知，而不是當成全新安裝。
records.clear();
const afterWipe = await loadAppState(defaults);
assert.equal(afterWipe.characters.length, 0, "the app still boots with defaults so the rescue screen can run restores");
assert.deepEqual({ characters: getStorageWipeNotice()?.characters, messages: getStorageWipeNotice()?.messages }, { characters: 2, messages: 4 });

// 通知還在時，空資料的存檔不能把標記蓋成 0（玩家可能下次才還原）。
await saveAppState({ ...defaults, characters: [], chatHistory: {} });
assert.equal(JSON.parse(localStorage.getItem(MARKER)).characters, 2, "an empty save must not erase the marker while the notice is pending");

// 玩家從快照還原後：解除通知，之後的存檔照常更新標記。
acknowledgeStorageWipe();
assert.equal(getStorageWipeNotice(), null);
await saveAppState({ ...played, characters: [...played.characters, { id: "c3", name: "C" }] });
assert.equal(JSON.parse(localStorage.getItem(MARKER)).characters, 3);

// 玩家自己清空／換帳號：標記一起清掉，下次空的開機不會被誤報。
await resetLocalEntities();
assert.equal(localStorage.getItem(MARKER), null, "a deliberate reset clears the marker");
await loadAppState(defaults);
assert.equal(getStorageWipeNotice(), null);

// 「先進入 App」也會清掉標記。
localStorage.setItem(MARKER, JSON.stringify({ characters: 5, messages: 9, savedAt: 1 }));
records.clear();
await loadAppState(defaults);
assert.equal(getStorageWipeNotice()?.characters, 5);
clearStorageMarker();
assert.equal(getStorageWipeNotice(), null);
assert.equal(localStorage.getItem(MARKER), null);

// 壞掉的標記不會讓開機失敗。
localStorage.setItem(MARKER, "{broken");
records.clear();
await loadAppState(defaults);
assert.equal(getStorageWipeNotice(), null);

console.log("ok: a wiped IndexedDB with a surviving marker triggers the rescue notice instead of a silent empty boot (MP-090)");
