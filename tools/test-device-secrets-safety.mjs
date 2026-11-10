import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const records = new Map();

globalThis.localStorage = {
  values: new Map([["mali_device_id", "device-secrets-test"]]),
  getItem(key) { return this.values.get(key) ?? null; },
  setItem(key, value) { this.values.set(key, String(value)); },
  removeItem(key) { this.values.delete(key); },
};

globalThis.IDBKeyRange = {
  bound(lower, upper) {
    return { lower, upper };
  },
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
          const transaction = {
            error: null,
            oncomplete: null,
            onerror: null,
            objectStore: () => ({
              get: (key) => requestFor(records.get(key)),
              getAllKeys: (range) => requestFor(
                [...records.keys()].filter((key) => (
                  typeof key === "string" && key >= range.lower && key <= range.upper
                )),
              ),
              getAll: (range) => requestFor(
                [...records.entries()]
                  .filter(([key]) => typeof key === "string" && key >= range.lower && key <= range.upper)
                  .map(([, value]) => value),
              ),
              put: (value, key) => staged.push(["put", key, value]),
              delete: (key) => staged.push(["delete", key]),
            }),
          };
          queueMicrotask(() => queueMicrotask(() => {
            if (mode === "readwrite") {
              for (const [operation, key, value] of staged) {
                if (operation === "put") records.set(key, value);
                else records.delete(key);
              }
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
  clearDeviceSecrets,
  getSyncOutbox,
  loadAppState,
  readEntity,
  resetLocalEntities,
  saveAppState,
} = await import("../utils/indexedDbStorage.js");
const {
  extractDeviceSecrets,
  hydrateDeviceSecrets,
  mergeDeviceSecrets,
  preserveMissingDeviceSecrets,
  stripDeviceSecrets,
} = await import("../utils/deviceSecrets.js");

const secrets = {
  main: "main-device-only-key",
  openRouterManagement: "openrouter-management-device-only-key",
  preset1: "preset-one-device-only-key",
  preset2: "preset-two-device-only-key",
  elevenlabs: "elevenlabs-device-only-key",
  minimax: "minimax-device-only-key",
};
const defaultState = {
  characters: [],
  chatHistory: {},
  chatBackgrounds: {},
  posts: [],
  phoneInboxCache: {},
  phoneAppCache: {},
  marker: "default",
  apiPresets: [
    { id: "preset-1", name: "Preset 1", apiKey: "" },
    { id: "preset-2", name: "Preset 2", apiKey: "" },
  ],
  apiConfig: { provider: "openai", apiKey: "", openRouterManagementKey: "" },
  ttsConfig: {
    provider: "elevenlabs",
    elevenlabs: { apiKey: "" },
    minimax: { apiKey: "" },
  },
};
const legacyState = {
  ...defaultState,
  marker: "legacy",
  apiPresets: [
    { ...defaultState.apiPresets[0], apiKey: secrets.preset1 },
    { ...defaultState.apiPresets[1], apiKey: secrets.preset2 },
  ],
  apiConfig: {
    ...defaultState.apiConfig,
    apiKey: secrets.main,
    openRouterManagementKey: secrets.openRouterManagement,
  },
  ttsConfig: {
    ...defaultState.ttsConfig,
    elevenlabs: { apiKey: secrets.elevenlabs },
    minimax: { apiKey: secrets.minimax },
  },
};

const extracted = extractDeviceSecrets(legacyState);
const stripped = stripDeviceSecrets(legacyState);
assert.equal(stripped.apiConfig.apiKey, "");
assert.equal(stripped.apiConfig.openRouterManagementKey, "");
assert.deepEqual(stripped.apiPresets.map((preset) => preset.apiKey), ["", ""]);
assert.equal(stripped.ttsConfig.elevenlabs.apiKey, "");
assert.deepEqual(hydrateDeviceSecrets(stripped, extracted), legacyState);

const emptyPlaceholderSecrets = {
  version: 1,
  apiKey: "",
  openRouterManagementKey: "",
  apiPresetKeys: { "preset-1": "", "preset-2": "" },
  ttsApiKeys: { elevenlabs: "", minimax: "" },
};
assert.deepEqual(
  mergeDeviceSecrets(emptyPlaceholderSecrets, extracted),
  extracted,
  "1.2.7 的空密鑰占位不得覆蓋可遷移的舊 Key",
);

const importedWithoutSecrets = stripDeviceSecrets({
  ...legacyState,
  marker: "imported-without-secrets",
});
assert.deepEqual(
  extractDeviceSecrets(preserveMissingDeviceSecrets(importedWithoutSecrets, legacyState)),
  extracted,
  "匯入一般備份時應保留本裝置現有 Key",
);
const importedWithAnotherKey = {
  ...importedWithoutSecrets,
  apiPresets: importedWithoutSecrets.apiPresets.map((preset, index) => ({
    ...preset,
    apiKey: index === 0 ? "imported-preset-key" : "",
  })),
};
const preservedImport = preserveMissingDeviceSecrets(importedWithAnotherKey, legacyState);
assert.equal(preservedImport.apiPresets[0].apiKey, "imported-preset-key");
assert.equal(preservedImport.apiPresets[1].apiKey, secrets.preset2);

const wrap = (data, rev = 1) => ({
  data,
  updatedAt: Date.now(),
  rev,
  deviceId: "legacy-device",
  deleted: false,
});
records.set("ent_core", wrap({
  marker: legacyState.marker,
  charOrder: [],
  apiPresets: legacyState.apiPresets,
}));
records.set("ent_apiConfig", wrap(legacyState.apiConfig));
records.set("ent_ttsConfig", wrap(legacyState.ttsConfig));
records.set("sync_outbox", { ent_core: Date.now() });

// Legacy entity records are migrated in place without changing their sync metadata.
const loadedLegacy = await loadAppState(defaultState);
assert.equal(loadedLegacy.apiConfig.apiKey, secrets.main);
assert.deepEqual(loadedLegacy.apiPresets.map((preset) => preset.apiKey), [secrets.preset1, secrets.preset2]);
assert.equal(loadedLegacy.ttsConfig.elevenlabs.apiKey, secrets.elevenlabs);
assert.equal(records.get("ent_core").data.apiPresets[0].apiKey, "");
assert.equal(records.get("ent_apiConfig").data.apiKey, "");
assert.equal(records.get("ent_ttsConfig").data.elevenlabs.apiKey, "");
assert.equal(records.get("device_secrets_v1").apiKey, secrets.main);
assert.equal(records.get("device_secrets_v1").openRouterManagementKey, secrets.openRouterManagement);

const rotatedMainKey = "rotated-main-device-only-key";
await saveAppState({
  ...loadedLegacy,
  marker: "saved",
  apiConfig: { ...loadedLegacy.apiConfig, apiKey: rotatedMainKey },
});
assert.equal(records.get("device_secrets_v1").apiKey, rotatedMainKey);
assert.equal(records.get("device_secrets_v1").openRouterManagementKey, secrets.openRouterManagement);
const syncedEntities = [
  await readEntity("ent_core"),
  await readEntity("ent_apiConfig"),
  await readEntity("ent_ttsConfig"),
];
const serializedEntities = JSON.stringify(syncedEntities);
for (const secret of Object.values(secrets)) {
  assert.equal(serializedEntities.includes(secret), false);
}
assert.equal(serializedEntities.includes(rotatedMainKey), false);
const outbox = await getSyncOutbox();
assert.equal(typeof outbox.ent_core, "number");
assert.equal(outbox.ent_apiConfig, undefined);
assert.equal(outbox.ent_ttsConfig, undefined);

// Old or malicious cloud data cannot put a key back into a synchronizable entity.
const currentCore = await readEntity("ent_core");
await applyRemoteEntities([{
  key: "ent_core",
  data: {
    ...currentCore.data,
    marker: "remote",
    apiPresets: [{ id: "preset-1", name: "Remote", apiKey: "remote-injected-key" }],
  },
  updatedAt: Date.now() + 10_000,
  rev: currentCore.rev + 10,
  deviceId: "other-device",
  deleted: false,
}]);
const remoteCore = await readEntity("ent_core");
assert.equal(remoteCore.data.apiPresets[0].apiKey, "");
assert.equal(JSON.stringify(records.get("ent_core")).includes("remote-injected-key"), false);
const reloaded = await loadAppState(defaultState);
assert.equal(reloaded.apiPresets[0].apiKey, secrets.preset1);

// Switching account workspaces clears entities but preserves device-only keys.
await resetLocalEntities();
const afterWorkspaceSwitch = await loadAppState(defaultState);
assert.equal(afterWorkspaceSwitch.apiConfig.apiKey, rotatedMainKey);
assert.equal(afterWorkspaceSwitch.apiPresets[0].apiKey, secrets.preset1);

// Explicit "clear all data" removes the device-only record too.
await clearDeviceSecrets();
const afterClearAll = await loadAppState(defaultState);
assert.equal(records.has("device_secrets_v1"), false);
assert.equal(afterClearAll.apiConfig.apiKey, "");
assert.equal(afterClearAll.apiConfig.openRouterManagementKey, "");
assert.deepEqual(afterClearAll.apiPresets.map((preset) => preset.apiKey), ["", ""]);
assert.equal(afterClearAll.ttsConfig.elevenlabs.apiKey, "");

const galleryStorageSource = await readFile(
  new URL("../services/images/galleryImageStorage.js", import.meta.url),
  "utf8",
);
assert.match(galleryStorageSource, /const IMAGE_API_KEY = "imageApi"/);
assert.match(galleryStorageSource, /const DB_NAME = "maliphone_gallery"/);
assert.match(galleryStorageSource, /export async function clearImageApiConfig/);
assert.doesNotMatch(galleryStorageSource, /from\s+["'][^"']*indexedDbStorage/);

console.log("ok: API keys stay device-only, migrate safely, and never enter sync entities");
