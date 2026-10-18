import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { runDataRestoreTransaction } from "../services/backup/dataRestoreTransaction.js";
import { createTextSyncDocument, validateTextSyncDocument } from "../utils/textSyncDocument.js";
import { mergeWalletSyncData } from "../utils/walletSync.js";
import { mergeGameProgressSyncData } from "../utils/gameProgressSync.js";
import { preserveMissingDeviceSecrets, stripDeviceSecrets } from "../utils/deviceSecrets.js";
import { preserveLocalMedia, stripTextSyncMedia } from "../utils/textSyncDocument.js";
import { compactActivePersona, compactLegacyLocalData, packBackupMedia, restoreActivePersona, unpackBackupMedia } from "../utils/backupMediaAssets.js";
import { capturePersonaData, serializePersonas } from "../services/persona/personaModel.js";
import { compactActiveRoomMirrors, compactCharacterImages, compactGroupMessageImages, compactSocialPostImages } from "../utils/persistedMediaCleanup.js";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const source = await read("hooks/data/useGlobalDataSnapshot.js");
const expression = (name, nextName) => {
  const marker = `  const ${name} = `;
  const start = source.indexOf(marker);
  const end = source.indexOf(nextName ? `\n  const ${nextName}` : "\n  return {", start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start + marker.length, end).trim().replace(/;$/, "");
};
const applyExpression = expression("applyAppState", "applyImportedAppState");
const protectedExpression = expression("runProtectedRestore", "restoreLocalSnapshot");
const importExpression = expression("applyImportedAppState", "applyTextSyncDocument");
const textExpression = expression("applyTextSyncDocument");
const restoreExpression = expression("restoreLocalSnapshot", "getTextSyncDocument");
const localExpression = expression("applyLocalAppDataSnapshot", "persistenceSnapshot");
const image = "data:image/png;base64,YWJjZA==";
const original = {
  characters: [{ id: "a", name: "Fixture", avatar: image }],
  chatHistory: { a: [{ id: "m", content: "Current", image }] },
  wallet: { balance: 777 }, chatRooms: {}, localAppData: { "maliphone-pet-home": "{\"level\":7}", "maliphone-pet-cooldown-until": null },
  customPrompts: { memoryCompress: "Fixture custom prompt" },
  apiConfig: { apiKey: "fixture-only", openRouterManagementKey: "fixture-only" },
  apiPresets: [{ id: "p", apiKey: "fixture-only" }],
  ttsConfig: { elevenlabs: { apiKey: "fixture-only" }, minimax: { apiKey: "fixture-only" } },
  personas: { "persona-default": { id: "persona-default", name: "Fixture persona", data: {} } }, activePersonaId: "persona-default",
  featureData: { notes: [{ id: "n", content: "Original" }], personaFeatures: { "persona-default": { coupleDaily: { day: 7 } } } },
  customCss: ".fixture { color: red; }", customCssEnabled: true, customFontName: "Fixture Font", themeName: "fixture-theme",
};
const saved = stripTextSyncMedia(stripDeviceSecrets(structuredClone(original)));
saved.wallet.balance = 111;
saved.chatHistory.a[0].content = "Earlier";
saved.featureData.notes[0].content = "Earlier note";

// The actual capture contract must include custom prompts and exact local data
// for rollback, while ordinary exports still compact duplicated legacy values.
const captureLocal = new Map([["maliphone-pet-home", '{"level":7}'], ["maliphone-pet-cooldown-until", "7"]]);
const captureFeatures = { ...original.featureData, petHome: { level: 7 }, petSettings: { cooldownUntil: 7 } };
const fullHook = vm.runInNewContext(source.replace(/^import[\s\S]*?;\r?\n/gm, "").replace("export const LOCAL_APP_DATA_KEYS", "const LOCAL_APP_DATA_KEYS").replace("export default function", "function") + "\nuseGlobalDataSnapshot;", {
  useRef: (current) => ({ current }), useState: (value) => [value, () => {}],
  VERSION: "fixture", compactActivePersona, compactLegacyLocalData, packBackupMedia, unpackBackupMedia, serializePersonas,
  compactActiveRoomMirrors, compactCharacterImages, compactGroupMessageImages, compactSocialPostImages,
  loadFeatureBackup: async () => structuredClone(captureFeatures),
  localStorage: { getItem: (key) => captureLocal.get(key) ?? null },
});
const captureState = { ...original, groupChats: [], posts: [], activeRoomIds: {}, notificationCenter: { persisted: {} }, personaController: { personas: original.personas, activePersonaId: original.activePersonaId }, captureCurrentPersona: () => capturePersonaData(original, {}) };
const captured = fullHook({ defaultAppState: {}, state: captureState, setters: {}, tr: (zh) => zh });
assert.equal(captured.persistenceSnapshot.customPrompts.memoryCompress, original.customPrompts.memoryCompress);
const capturedRollback = await captured.getRollbackAppState();
assert.equal(capturedRollback.state.customPrompts.memoryCompress, original.customPrompts.memoryCompress);
assert.equal(capturedRollback.state.localAppData["maliphone-pet-cooldown-until"], "7");
assert.equal(capturedRollback.state.localAppData["maliphone-pet-settings"], null);
assert.equal(capturedRollback.state.apiConfig.apiKey, original.apiConfig.apiKey);
const capturedExport = await captured.getExportableAppState();
assert.equal(capturedExport.state.apiConfig.apiKey, "");
assert.equal(capturedExport.state.localAppData["maliphone-pet-home"], undefined);

function harness({ stage = null, rollbackFails = false, snapshotSaved = true, missing = false, invalid = false, captureFails = false } = {}) {
  let visible = structuredClone(original), features = structuredClone(original.featureData), disk = structuredClone(original);
  let paused = false, recovery = null;
  const events = [];
  const local = new Map(Object.entries(original.localAppData).filter(([, value]) => value !== null));
  local.set("mali_custom_css", original.customCss);
  const guard = { active: false, blocked: false, pending: null, epoch: 0 };
  const context = {
    defaultAppState: { wallet: {}, socialSettings: {}, apiConfig: {}, apiPresets: [], playerProfile: {}, ttsConfig: { elevenlabs: {}, minimax: {} }, fontName: "default", uiLanguage: "zh-TW" },
    apiConfig: original.apiConfig, apiPresets: original.apiPresets, ttsConfig: original.ttsConfig,
    DOCK_APPS: [], HOME_SLOT_COUNT: 2, FONT_PRESETS: { default: {} }, SNAPSHOT_REASONS: { beforeOverwrite: "before-overwrite" },
    LOCAL_APP_DATA_KEYS: ["maliphone-pet-home", "maliphone-pet-cooldown-until"],
    tr: (zh) => zh, normalizeCharacterBlockStates: (value) => value || {}, normalizeUiLanguage: (value, fallback) => value || fallback,
    restoreActivePersona, capturePersonaData, preserveMissingDeviceSecrets, sanitizeFontName: (value) => value, sanitizeCustomCss: (value) => value,
    notificationCenter: { hydrate() {} },
    applyLoadedAppState(next) { visible = structuredClone(next); events.push("apply-visible"); },
    takeLocalSnapshotSafely: async () => { events.push("safety-snapshot"); return snapshotSaved ? { id: "before" } : null; },
    restoreFeatureBackup: async (next, { reason }) => {
      events.push(`features:${reason}`);
      features = structuredClone(next.featureData);
      if ((stage === "feature" && reason !== "rollback") || (rollbackFails && reason === "rollback")) throw new Error("Fixture feature write failure");
    },
    saveAppState: async (next) => {
      events.push("main-write");
      if (stage === "main" && events.filter((event) => event === "main-write").length === 1) throw new Error("Fixture main write failure");
      disk = structuredClone(next);
    },
    getLocalSnapshot: async () => { events.push("read-snapshot"); return missing ? null : { state: structuredClone(saved) }; },
    getRollbackAppState: async () => { events.push("capture-original"); if (captureFails) throw new Error("Fixture capture failed"); return { format: "maliphone-app-state", formatVersion: 1, state: structuredClone(original) }; },
    unpackBackupMedia, preserveLocalMedia, stripDeviceSecrets, runDataRestoreTransaction,
    // Cloud media (MP-024): no session here, so downloads reduce to keeping this device's media.
    downloadTextSyncMedia: async (remote, local) => ({ state: preserveLocalMedia(remote, local), downloaded: 0, failed: 0 }),
    validateTextSyncDocument, mergeWalletSyncData, mergeGameProgressSyncData,
    validateImportedAppState() { if (invalid) throw new Error("Fixture invalid snapshot"); },
    localStorage: { setItem(key, value) { local.set(key, value); }, removeItem(key) { local.delete(key); } },
    window: { dispatchEvent() {} }, Event: class {},
    persistenceWriteGuard: guard,
    recordRuntimeDiagnostic(record) { events.push(`diagnostic:${record.kind}`); },
  };
  for (const name of new Set(source.match(/\bset[A-Z]\w*/g))) context[name] = () => {};
  context.setPersistencePaused = (value) => { paused = value; };
  context.setRestoreRecovery = (value) => { recovery = value; };
  context.setCustomFontName = (value) => { visible.customFontName = value; };
  context.setCustomCss = (value) => { visible.customCss = value; };
  context.setCustomCssEnabled = (value) => { visible.customCssEnabled = value; };
  const sandbox = vm.createContext(context);
  vm.runInContext(`globalThis.applyLocalAppDataSnapshot = (${localExpression}); globalThis.applyAppState = (${applyExpression}); globalThis.runProtectedRestore = (${protectedExpression}); globalThis.applyImportedAppState = (${importExpression}); globalThis.applyTextSyncDocument = (${textExpression}); globalThis.restore = (${restoreExpression});`, sandbox);
  return { restore: sandbox.restore, apply: sandbox.applyImportedAppState, text: sandbox.applyTextSyncDocument, guard, events, local, get visible() { return visible; }, get disk() { return disk; }, get features() { return features; }, get paused() { return paused; }, get recovery() { return recovery; } };
}

for (const stage of ["feature", "main"]) {
  const test = harness({ stage });
  await assert.rejects(test.restore("fixture"), { restoreStatus: "rolled-back" });
  assert.equal(test.visible.wallet.balance, 777);
  assert.equal(test.disk.wallet.balance, 777);
  assert.deepEqual(test.features, original.featureData);
  assert.equal(test.visible.chatHistory.a[0].content, "Current");
  assert.equal(test.visible.characters[0].avatar, image);
  assert.equal(test.visible.apiConfig.apiKey, original.apiConfig.apiKey);
  assert.equal(test.visible.apiPresets[0].apiKey, original.apiPresets[0].apiKey);
  assert.equal(test.visible.ttsConfig.elevenlabs.apiKey, original.ttsConfig.elevenlabs.apiKey);
  assert.equal(test.visible.activePersonaId, original.activePersonaId);
  assert.equal(test.visible.customCss, original.customCss);
  assert.equal(test.visible.customFontName, original.customFontName);
  assert.equal(test.visible.customPrompts.memoryCompress, original.customPrompts.memoryCompress);
  assert.equal(test.local.get("mali_custom_css"), original.customCss);
  assert.equal(test.local.get("maliphone-pet-home"), original.localAppData["maliphone-pet-home"]);
  assert.equal(test.local.has("maliphone-pet-cooldown-until"), false);
  assert.equal(test.events.filter((event) => event === "safety-snapshot").length, 1, "rollback must not snapshot partial data");
  assert.equal(test.paused, false);
  assert.equal(test.guard.blocked, false);
  assert.equal(test.recovery, null);
}

const success = harness();
assert.equal((await success.restore("fixture")).snapshotCreated, true);
assert.equal(success.disk.wallet.balance, 111);
assert.equal(success.visible.characters[0].avatar, image);
assert.equal(success.visible.chatHistory.a[0].image, image);
assert.equal(success.visible.apiConfig.apiKey, original.apiConfig.apiKey);
assert.equal(success.paused, false);
assert.equal((await harness({ snapshotSaved: false }).restore("fixture")).snapshotCreated, false);

for (const options of [{ missing: true }, { invalid: true }]) {
  const test = harness(options);
  await assert.rejects(test.restore("fixture"));
  assert.equal(test.visible.wallet.balance, 777);
  assert.equal(test.events.includes("apply-visible"), false);
  assert.equal(test.paused, false);
}

const fatal = harness({ stage: "main", rollbackFails: true });
await assert.rejects(fatal.restore("fixture"), { restoreStatus: "rollback-failed" });
assert.equal(fatal.guard.blocked, true);
assert.equal(fatal.paused, true);
assert.equal(fatal.recovery.backup.state.wallet.balance, 777);
assert.equal(fatal.recovery.backup.state.apiConfig.apiKey, "");
assert.equal(fatal.recovery.backup.state.apiConfig.openRouterManagementKey, "");
assert.equal(fatal.recovery.backup.state.apiPresets[0].apiKey, "");
assert.equal(fatal.recovery.backup.state.ttsConfig.minimax.apiKey, "");
await assert.rejects(fatal.restore("fixture"), { restoreStatus: "blocked" });

const concurrent = harness();
let releaseSave;
concurrent.guard.pending = new Promise((resolve) => { releaseSave = resolve; });
const restoring = concurrent.restore("fixture");
assert.equal(concurrent.guard.active, true);
assert.equal(concurrent.paused, true);
await assert.rejects(concurrent.restore("fixture"), { restoreStatus: "busy" });
assert.equal(concurrent.events.length, 0, "the outstanding autosave must settle before backup capture");
releaseSave();
await restoring;

const fullSaved = structuredClone(saved);
fullSaved.characters[0].avatar = image;
fullSaved.chatHistory.a[0].image = image;
const entryPoints = {
  file: (test) => test.apply(fullSaved),
  google: (test) => test.apply(fullSaved, { source: "google-drive" }),
  github: (test) => test.apply(fullSaved, { source: "github" }),
  account: (test) => test.text(createTextSyncDocument(saved)),
};
for (const [name, apply] of Object.entries(entryPoints)) {
  for (const stage of ["feature", "main"]) {
    const test = harness({ stage });
    await assert.rejects(apply(test), { restoreStatus: "rolled-back" }, name);
    assert.equal(test.disk.wallet.balance, 777);
    assert.equal(test.visible.chatHistory.a[0].content, "Current");
    assert.equal(test.visible.chatHistory.a[0].image, image);
    assert.equal(test.visible.apiConfig.apiKey, original.apiConfig.apiKey);
    assert.equal(test.visible.customPrompts.memoryCompress, original.customPrompts.memoryCompress);
    assert.deepEqual(test.features, original.featureData);
    assert.equal(test.events.filter((event) => event === "capture-original").length, 1);
    assert.equal(test.events.filter((event) => event === "features:rollback").length, 1);
    assert.equal(test.events.filter((event) => event === "safety-snapshot").length, 1);
    assert.equal(test.paused, false);
  }
  const fatal = harness({ stage: "main", rollbackFails: true });
  await assert.rejects(apply(fatal), { restoreStatus: "rollback-failed" }, name);
  assert.equal(fatal.guard.blocked, true);
  assert.equal(fatal.paused, true);
  assert.equal(fatal.recovery.backup.state.wallet.balance, 777);
  assert.equal(fatal.recovery.backup.state.apiConfig.apiKey, "");
  assert.equal(fatal.recovery.backup.state.featureData.notes[0].content, "Original");
  assert.equal(fatal.events.filter((event) => event === "features:rollback").length, 1);
  await assert.rejects(fatal.text(createTextSyncDocument(saved)), { restoreStatus: "blocked" });
  await assert.rejects(fatal.apply(saved), { restoreStatus: "blocked" });
  const untouched = harness({ captureFails: true });
  await assert.rejects(apply(untouched), { restoreStatus: "not-started" }, name);
  assert.equal(untouched.events.includes("apply-visible"), false);
  assert.equal(untouched.paused, false);
  assert.equal(untouched.guard.blocked, false);
  const success = harness();
  const result = await apply(success);
  assert.equal(result.snapshotCreated, true);
  assert.equal(success.visible.chatHistory.a[0].content, "Earlier");
  assert.equal(success.visible.characters[0].avatar, image);
  assert.equal(success.visible.apiConfig.apiKey, original.apiConfig.apiKey);
  assert.equal(success.paused, false);
  assert.equal(success.events.filter((event) => event === "capture-original").length, 1);
  assert.equal(success.events.includes("features:rollback"), false);
}
const crossSource = harness();
let releasePending;
crossSource.guard.pending = new Promise((resolve) => { releasePending = resolve; });
const importing = crossSource.apply(saved);
await assert.rejects(crossSource.text(createTextSyncDocument(saved)), { restoreStatus: "busy" });
await assert.rejects(crossSource.restore("fixture"), { restoreStatus: "busy" });
assert.equal(crossSource.events.length, 0);
releasePending();
await importing;

// Invoke the real calling functions: UI layers must apply once and must never
// attempt their own second rollback or publish success after a failed apply.
const importSource = (await read("hooks/data/useDataImportExport.js")).replace(/^import[^;]+;\r?\n/gm, "").replace("export default function", "function");
const cloudSource = await read("components/settings/CloudBackupSettings.jsx");
const accountSource = await read("components/auth/AccountSettingsSection.jsx");
const arrow = (text, name, next) => {
  const marker = `  const ${name} = `;
  const start = text.indexOf(marker), end = text.indexOf(next, start);
  assert.ok(start >= 0 && end > start);
  return text.slice(start + marker.length, end).trim().replace(/;$/, "");
};
const cloudMethods = {
  google: arrow(cloudSource, "restoreGoogleBackup", "\n  const showError"),
  github: arrow(cloudSource, "restoreBackup", "\n  return <div"),
};
const accountMethod = arrow(accountSource, "downloadTextSync", "\n  const loadSyncHistory");
const { dataRestoreFailureMessage } = await import("../services/backup/dataRestoreTransaction.js");
for (const status of ["rolled-back", "rollback-failed", "not-started", "busy", "blocked"]) {
  const error = Object.assign(new Error("Fixture apply failure"), { restoreStatus: status });
  let applies = 0, success = 0;
  const messages = [], tr = (zh) => zh;
  const apply = async () => { applies++; throw error; };
  const dataStates = [], context = {
    useRef: () => ({ current: null }),
    useCallback: (fn) => fn, dataRestoreFailureMessage,
    window: { confirm: () => true }, isRescueFile: () => false,
  };
  let hookIndex = 0;
  context.useState = (value) => { const index = hookIndex++; if (!(index in dataStates)) dataStates[index] = value; return [dataStates[index], (next) => { dataStates[index] = next; }]; };
  const hook = vm.runInNewContext(`${importSource}\nuseDataImportExport;`, context);
  const props = { tr, applyImportedState: apply, validateImportedState() {}, summarizeImportedData: () => ({}), showToast: (message) => messages.push(message), sanitizeText: String };
  await hook(props).importAllData({ target: { files: [{ name: "fixture.json", size: 100, text: async () => JSON.stringify(saved) }] } });
  hookIndex = 0;
  await hook(props).confirmImport();
  assert.equal(applies, 1);
  assert.equal(messages.at(-1), dataRestoreFailureMessage(error, tr));
  for (const method of Object.values(cloudMethods)) {
    applies = success = 0;
    const fn = vm.runInNewContext(`(${method})`, {
      googleSession: { accessToken: "fixture-only" }, googleBackupId: "fixture", accessToken: "fixture-only", repository: {}, githubBackupPath: "fixture",
      getGoogleDriveBackup: async () => ({ content: JSON.stringify(saved) }), getGitHubBackupFile: async () => ({ content: JSON.stringify(saved) }),
      validateImportedState() {}, summarizeImportedData: () => ({}), window: { confirm: () => true }, tr,
      getRollbackState: () => { throw new Error("UI must not capture a second backup"); },
      applyImportedState: apply, setBusy() {}, setNotice: () => { success++; }, showToast: () => { success++; }, showError: (error) => messages.push(dataRestoreFailureMessage(error, tr)),
    });
    await fn();
    assert.equal(applies, 1);
    assert.equal(success, 0);
    assert.equal(messages.at(-1), dataRestoreFailureMessage(error, tr));
  }
  applies = success = 0;
  const download = vm.runInNewContext(`(${accountMethod})`, {
    auth: { session: {}, user: { id: "fixture" } }, textSyncProps: { applyTextSyncDocument: apply },
    window: { confirm: () => true }, text: tr, TEXT_SYNC_DOCUMENT_KEY: "fixture", getCloudDocument: async () => ({ data: {} }),
    tr: (value) => (value && typeof value === "object" ? value["zh-TW"] : value),
    CLOUD_MEDIA_SYNC_TEXT: { downloadConfirm: { "zh-TW": "confirm" } }, cloudMediaSyncSummary: () => "",
    CLOUD_SYNC_REVISION_TEXT: { downloadedRevision: { "zh-TW": "applied {revision}" } }, fillCloudSyncText: (value) => String(value),
    dataRestoreFailureMessage, setTextSyncBusy() {}, setTextSyncFailed() {}, setTextSyncStatus: (message) => messages.push(message),
    saveTextSyncMeta: () => { success++; }, setTextSyncMeta: () => { success++; }, setRemoteTextSyncMeta: () => { success++; }, notify: () => { success++; },
  });
  await download();
  assert.equal(applies, 1);
  assert.equal(success, 0);
  assert.equal(messages.at(-1), dataRestoreFailureMessage(error, tr));
}

// Run the actual persistence hook with controlled React effects and timers.
const persistenceSource = (await read("hooks/data/useAppPersistence.js")).replace(/^import .*;\r?\n/gm, "").replace("export default function", "function");
const states = [], refs = [], effects = [], cleanups = [], timers = new Map();
let stateIndex, refIndex, effectIndex, timerId = 0, current = { wallet: { balance: 0 } }, writes = 0, pushes = 0, output;
const guard = { active: false, blocked: false, epoch: 0, pending: null };
let paused = false, saveResolve;
const saveState = () => { writes++; return new Promise((resolve) => { saveResolve = resolve; }); };
const schedulePush = () => { pushes++; };
const hook = vm.runInNewContext(`${persistenceSource}\nuseAppPersistence;`, {
  useState(initial) { const i = stateIndex++; if (!(i in states)) states[i] = initial; return [states[i], (value) => { states[i] = value; }]; },
  useRef(initial) { const i = refIndex++; return refs[i] ||= { current: initial }; },
  useEffect(run, deps) { const i = effectIndex++; if (!effects[i] || deps.some((value, index) => value !== effects[i].deps[index])) effects[i] = { deps, run }; },
  recordRuntimeDiagnostic() {},
  setTimeout(callback, ms) { const id = ++timerId; timers.set(id, { callback, ms }); return id; },
  clearTimeout(id) { timers.delete(id); },
});
function render() {
  stateIndex = refIndex = effectIndex = 0;
  output = hook({ defaults: {}, snapshot: current, loadState: async () => ({ wallet: { balance: 777 } }), syncOnBoot: async () => {}, onLoad: (value) => { current = value; }, saveState, schedulePush, writeGuard: guard, paused });
  effects.forEach((effect, i) => { if (!effect.run) return; cleanups[i]?.(); const run = effect.run; effect.run = null; cleanups[i] = run(); });
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function fireSaveTimer() { const found = [...timers].find(([, timer]) => timer.ms === 180); assert.ok(found); timers.delete(found[0]); found[1].callback(); }
render();
await flush();
render();
assert.equal(output.hydrated, true);
guard.active = true;
guard.epoch++;
fireSaveTimer();
await flush();
assert.equal(writes, 0, "a timer queued before the pause must not write");
guard.active = false;
current = { wallet: { balance: 111 } };
render();
const staleTimer = [...timers.values()].find((timer) => timer.ms === 180).callback;
guard.epoch++;
staleTimer();
await flush();
assert.equal(writes, 0, "a pre-restore timer must stay invalid even after the pause ends");
current = { wallet: { balance: 222 } };
render();
fireSaveTimer();
await flush();
assert.equal(writes, 1);
assert.ok(guard.pending, "in-flight save must be available to the restore guard");
guard.active = true;
guard.epoch++;
saveResolve();
await guard.pending;
assert.equal(pushes, 0, "an in-flight pre-restore save must not start a sync push");
guard.active = false;
guard.blocked = true;
paused = true;
current = { wallet: { balance: 333 } };
render();
assert.equal([...timers.values()].filter((timer) => timer.ms === 180).length, 0, "rollback failure must leave autosave paused");
assert.equal(writes, 1);
cleanups.forEach((cleanup) => cleanup?.());

console.log("ok: every import/download/restore shares rollback, autosave pause and sanitized recovery; callers never roll back twice or report false success");
