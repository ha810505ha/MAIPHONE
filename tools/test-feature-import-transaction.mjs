import assert from "node:assert/strict";

const records = new Map();
let failOnKey = null;

globalThis.localStorage = {
  values: new Map(),
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
              delete: (key) => staged.push(["delete", key]),
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

const { readEntity, saveFeatureEntities } = await import("../utils/indexedDbStorage.js");

await saveFeatureEntities([
  ["ent_notes", [{ id: "old-note" }]],
  ["ent_calendar", { events: [{ id: "old-event" }] }],
]);

failOnKey = "ent_calendar";
await assert.rejects(() => saveFeatureEntities([
  ["ent_notes", [{ id: "new-note" }]],
  ["ent_calendar", { events: [{ id: "new-event" }] }],
]));

assert.equal((await readEntity("ent_notes")).data[0].id, "old-note");
assert.equal((await readEntity("ent_calendar")).data.events[0].id, "old-event");
console.log("ok: feature backup writes roll back as one IndexedDB transaction");
