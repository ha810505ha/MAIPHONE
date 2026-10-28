import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { upsertNoteDraft } from "../utils/notesPersistence.js";
import { featureDataEventIncludes, FEATURE_DATA_CHANGED_EVENT } from "../services/featureDataLifecycle.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const saveSource = (await read("yunyin/systems/save.js")).replace(/^import[^;]+;\r?\n/gm, "").replace(/export /g, "");
const original = { coins: 975, inventory: { fixture_item: 7 }, mapLayoutVersion: 2, home: { residentLinePacks: {} }, unknownFutureField: "keep" };
function villa({ data = null, legacy = null, readError, legacyError, writeError, onWrite } = {}) {
  const events = [];
  const disk = { data: structuredClone(data), legacy };
  const api = vm.runInNewContext(`${saveSource}\n({loadSave, persistSave, touchSave});`, {
    Date, DOMException, structuredClone, console,
    OUTDOOR_MARGIN: 4, cropById: () => null,
    normalizeHomeState: (value) => ({ ...value, residentLinePacks: value?.residentLinePacks || {} }),
    loadFeatureEntity: async () => { events.push("read"); if (readError) throw readError; return structuredClone(disk.data); },
    saveFeatureEntity: async (_, value) => { events.push("write"); if (writeError) throw writeError; disk.data = structuredClone(value); onWrite?.(); },
    localStorage: {
      getItem() { events.push("legacy-read"); if (legacyError) throw legacyError; return disk.legacy; },
      removeItem() { events.push("legacy-remove"); disk.legacy = null; },
    },
  });
  return { ...api, events, disk };
}

for (const name of ["SecurityError", "VersionError", "UnknownError"]) {
  const test = villa({ data: original, readError: new DOMException("Fixture read failure", name) });
  await assert.rejects(test.loadSave(), { name });
  assert.deepEqual(test.events, ["read"]);
  assert.deepEqual(test.disk.data, original);
}
const loaded = villa({ data: original });
assert.equal((await loaded.loadSave()).coins, 975);
assert.deepEqual(loaded.events, ["read"]);
const fresh = villa();
const freshSave = await fresh.loadSave();
assert.equal(freshSave.coins, 100);
// MP-090：沒有存檔時不立刻寫回預設開局，避免清空後的空檔搶走合併優先權。
assert.deepEqual(fresh.events, ["read", "legacy-read"]);
assert.equal(freshSave.fresh, true);
await fresh.persistSave(freshSave);
assert.deepEqual(fresh.events, ["read", "legacy-read"], "a pristine save must not be written");
assert.equal(fresh.disk.data, null);
fresh.touchSave(freshSave);
await fresh.persistSave(freshSave);
assert.deepEqual(fresh.events, ["read", "legacy-read", "write"], "the save is written once progress exists");
assert.equal(fresh.disk.data.coins, 100);
assert.equal("fresh" in fresh.disk.data, false);
const migrated = villa({ legacy: JSON.stringify(original) });
assert.equal((await migrated.loadSave()).unknownFutureField, "keep");
assert.deepEqual(migrated.events, ["read", "legacy-read", "write", "legacy-remove"]);
assert.equal(migrated.disk.data.coins, 975);
for (const legacy of ["broken fixture", "null", "[]", "false", "0", '"fixture"']) {
  const test = villa({ legacy });
  await assert.rejects(test.loadSave(), { name: "DataError" });
  assert.deepEqual(test.events, ["read", "legacy-read"]);
  assert.equal(test.disk.legacy, legacy);
}
for (const data of [false, 0, [], "fixture"]) {
  const test = villa({ data });
  await assert.rejects(test.loadSave(), { name: "DataError" });
  assert.deepEqual(test.events, ["read"]);
}
const inaccessibleLegacy = villa({ legacyError: new DOMException("Fixture denied", "SecurityError") });
await assert.rejects(inaccessibleLegacy.loadSave(), { name: "SecurityError" });
assert.deepEqual(inaccessibleLegacy.events, ["read", "legacy-read"]);
const failedMigration = villa({ legacy: JSON.stringify(original), writeError: new DOMException("Fixture quota", "QuotaExceededError") });
await assert.rejects(failedMigration.loadSave(), { name: "QuotaExceededError" });
assert.equal(failedMigration.disk.legacy, JSON.stringify(original));
assert.equal(failedMigration.disk.data, null);
const leftBeforeWrite = villa({ legacy: JSON.stringify(original) });
await assert.rejects(leftBeforeWrite.loadSave({ isCurrent: () => false }), { name: "AbortError" });
assert.deepEqual(leftBeforeWrite.events, ["read"]);
let current = true;
const leftDuringWrite = villa({ legacy: JSON.stringify(original), onWrite: () => { current = false; } });
await assert.rejects(leftDuringWrite.loadSave({ isCurrent: () => current }), { name: "AbortError" });
assert.equal(leftDuringWrite.disk.legacy, JSON.stringify(original));
assert.equal(leftDuringWrite.disk.data.coins, 975);

// Exercise the actual Notes loading effect and writers with deferred reads/timers.
// The browser QA additionally covers rendering and user input with real IndexedDB.
const noteSource = await read("components/apps/NotesApp.jsx");
const start = noteSource.indexOf("export default function NotesApp");
const end = noteSource.indexOf("  useEffect(() => {\n    const remember", start) >= 0
  ? noteSource.indexOf("  useEffect(() => {\n    const remember", start)
  : noteSource.indexOf("  useEffect(() => {\r\n    const remember", start);
assert.ok(start >= 0 && end > start);
const functionSource = noteSource.slice(start, end).replace("export default ", "") + `
  return { write, persistCurrentDraft, saveDraft, readyRef, notesRef, draftRef, reloadRef, loadEpochRef };
}`;
const turn = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };
const noteData = [{ id: "old-note", title: "Old fixture", content: "Keep old fixture", updatedAt: 1 }];
function notes({ load = async () => structuredClone(noteData), save } = {}) {
  const events = [], timers = new Map(), listeners = new Map(), state = [], cleanups = [];
  let sequence = 0, stateIndex = 0;
  const disk = { notes: structuredClone(noteData) };
  const app = vm.runInNewContext(`${functionSource}\nNotesApp;`, {
    KEY: "ent_notes", NOTE_UI_TEXT: {}, DOMException, Promise, upsertNoteDraft, console,
    FEATURE_DATA_CHANGED_EVENT, featureDataEventIncludes,
    useLargeTitle: () => ({}), useLocalizedStaticText() {},
    useState(value) { const index = stateIndex++; state[index] = value; return [value, (next) => { state[index] = next; }]; },
    useRef: (current) => ({ current }), useEffect: (fn) => { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); },
    setTimeout(fn) { const token = ++sequence; timers.set(token, fn); return token; }, clearTimeout: (token) => timers.delete(token),
    window: { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name) },
    loadFeatureEntity: () => { events.push("read"); return load(); },
    saveFeatureEntity: async (_, next) => { events.push("write"); if (save) await save(next); disk.notes = structuredClone(next); },
    recordRuntimeDiagnostic: () => events.push("diagnostic"),
  })({ tr: (zh) => zh });
  return { app, events, state, disk, timers, unmount: () => cleanups.forEach((fn) => fn()), reload: () => app.reloadRef.current() };
}
const rejected = notes({ load: async () => { throw new Error("Fixture read failed"); } });
rejected.app.draftRef.current = { id: "new-note", content: "New fixture" };
await rejected.app.write([]);
await rejected.app.persistCurrentDraft();
assert.equal(rejected.events.includes("write"), false, "startup is not writable");
await turn();
assert.equal(rejected.app.readyRef.current, false);
await rejected.app.write([]);
await rejected.app.persistCurrentDraft();
rejected.unmount();
assert.equal(rejected.events.includes("write"), false);
assert.deepEqual(rejected.disk.notes, noteData);
const invalid = notes({ load: async () => ({ fixture: true }) });
await turn();
assert.equal(invalid.app.readyRef.current, false);
assert.equal(invalid.state[2]?.name, "DataError");
const missing = notes({ load: async () => [] });
await turn();
assert.equal(missing.app.readyRef.current, true);
missing.app.draftRef.current = { id: "first", title: "First" };
await missing.app.persistCurrentDraft();
assert.equal(missing.disk.notes.length, 1);

let first = true;
const retried = notes({ load: async () => { if (first) { first = false; throw new Error("Fixture temporary read failure"); } return structuredClone(noteData); } });
await turn();
retried.reload();
await turn();
assert.equal(retried.app.readyRef.current, true);
retried.app.draftRef.current = { id: "new", title: "Second", content: "New fixture" };
await retried.app.persistCurrentDraft();
assert.equal(retried.disk.notes.length, 2);
assert.equal(retried.disk.notes.find((note) => note.id === "old-note").content, noteData[0].content);

let reads = [deferred(), deferred()];
let readIndex = 0;
const racing = notes({ load: () => reads[readIndex++].promise });
await turn();
racing.reload();
await turn();
reads[1].resolve([{ ...noteData[0], title: "Latest fixture" }]);
await turn();
reads[0].reject(new Error("Fixture stale failure"));
await turn();
assert.equal(racing.app.notesRef.current[0].title, "Latest fixture");
assert.equal(racing.app.readyRef.current, true);
assert.equal(racing.state[2], null);

const waiting = deferred();
const left = notes({ load: () => waiting.promise });
await turn();
left.unmount();
waiting.resolve(noteData);
await turn();
assert.equal(left.app.readyRef.current, false);
assert.equal(left.events.includes("write"), false);

const timer = notes();
await turn();
timer.app.draftRef.current = { ...noteData[0], title: "Edited fixture" };
timer.app.saveDraft("Unsaved fixture");
const staleTimer = [...timer.timers.values()][0];
timer.reload();
await turn();
timer.app.draftRef.current = { id: "new", content: "New fixture" };
staleTimer();
await turn();
assert.equal(timer.events.includes("write"), false, "old timer stays invalid after successful reload");

const commit = deferred();
const drain = notes({ save: () => commit.promise });
await turn();
const pending = drain.app.write([{ ...noteData[0], title: "Committed fixture" }]);
drain.reload();
await turn();
assert.equal(drain.events.filter((event) => event === "read").length, 1);
commit.resolve();
await pending;
await turn();
assert.equal(drain.events.filter((event) => event === "read").length, 2, "reload waits for a queued note write");
const exit = notes();
await turn();
exit.app.draftRef.current = { ...noteData[0], title: "Last fixture edit" };
exit.unmount();
await turn();
assert.equal(exit.disk.notes[0].title, "Last fixture edit", "normal exit still flushes a loaded draft");
assert.equal(exit.app.readyRef.current, false);
console.log("ok: villa/notes failed reads preserve data; retry, migration, cancellation, stale timers and pending commits are protected");
