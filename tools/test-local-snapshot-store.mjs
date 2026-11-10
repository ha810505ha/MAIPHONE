import assert from "node:assert/strict";
import { createSnapshotFileStore, SNAPSHOT_FILE_DIR } from "../services/backup/snapshotFileStore.js";
import {
  collapseLatestSnapshots, configureSnapshotFileStoreForTests, getLocalSnapshot, isLatestSnapshotId, LATEST_SNAPSHOT_IDS,
  listLocalSnapshots, saveLatestSnapshot, saveLocalSnapshot, selectSnapshotsToDelete, shouldWriteLatestSnapshot, SNAPSHOT_REASONS,
} from "../services/backup/localSnapshotService.js";

// MP-090：APK 的快照寫進 App 私有檔案系統。這裡用假的 Filesystem 驗證讀寫、清單、刪除與壞檔容錯。
function fakeFilesystem({ failWrite = false } = {}) {
  const files = new Map();
  const dirs = new Set();
  const notFound = (path) => Object.assign(new Error(`File does not exist: ${path}`), { code: "ENOENT" });
  const calls = [];
  const Filesystem = {
    async writeFile({ path, data, directory, encoding, recursive }) {
      calls.push(["write", path]);
      assert.equal(directory, "DATA", "snapshots must live in the app's private Data directory");
      assert.equal(encoding, "utf8");
      assert.equal(recursive, true);
      if (failWrite) throw new Error("disk full");
      dirs.add(path.split("/")[0]);
      files.set(path, String(data));
      return { uri: `file:///data/${path}` };
    },
    async readFile({ path }) {
      calls.push(["read", path]);
      if (!files.has(path)) throw notFound(path);
      return { data: files.get(path) };
    },
    async deleteFile({ path }) {
      calls.push(["delete", path]);
      if (!files.has(path)) throw notFound(path);
      files.delete(path);
    },
    async readdir({ path }) {
      calls.push(["readdir", path]);
      if (!dirs.has(path)) throw notFound(path);
      const names = [...files.keys()].filter((key) => key.startsWith(`${path}/`)).map((key) => key.slice(path.length + 1));
      // Capacitor 7+ 回傳 FileInfo 物件；舊版回傳字串。兩種都要能讀。
      return { files: names.map((name, index) => (index % 2 ? name : { name, type: "file" })) };
    },
    async stat({ path }) {
      calls.push(["stat", path]);
      if (!files.has(path)) throw notFound(path);
      return { type: "file", size: files.get(path).length };
    },
    async rmdir({ path, recursive }) {
      calls.push(["rmdir", path]);
      assert.equal(recursive, true);
      for (const key of [...files.keys()]) if (key.startsWith(`${path}/`)) files.delete(key);
      dirs.delete(path);
    },
    async mkdir({ path }) { dirs.add(path); },
  };
  return { Filesystem, Directory: { Data: "DATA", Documents: "DOCUMENTS" }, Encoding: { UTF8: "utf8" }, files, calls };
}

const fs = fakeFilesystem();
const store = createSnapshotFileStore(fs);
assert.deepEqual(await store.list(), [], "an app that never saved a snapshot lists nothing");
assert.equal(await store.get("missing"), null);
assert.equal(await store.has("missing"), false);

const meta = (id, createdAt, reason, characters) => ({ id, createdAt, reason, version: "1.5.2", bytes: 10, summary: { characters, chats: characters, messages: characters * 10, posts: 0 } });
const state = (tag) => ({ characters: [{ id: tag }], chatHistory: {}, featureData: { yunyinSave: { coins: 500 }, petHome: { level: 2 } } });
await store.put(meta("snap_a", 100, SNAPSHOT_REASONS.daily, 12), { id: "snap_a", state: state("a") });
assert.deepEqual(fs.calls.filter(([op]) => op === "write").map(([, path]) => path), [`${SNAPSHOT_FILE_DIR}/snap_a.json`, `${SNAPSHOT_FILE_DIR}/snap_a.meta.json`], "the body is written before the list entry");
assert.equal(await store.has("snap_a"), true);
const loaded = await store.get("snap_a");
assert.equal(loaded.id, "snap_a");
assert.equal(loaded.summary.characters, 12);
assert.deepEqual(loaded.state.featureData.petHome, { level: 2 }, "pets and villa travel inside the snapshot");

await store.put(meta("snap_b", 200, SNAPSHOT_REASONS.beforeOverwrite, 0), { id: "snap_b", state: state("b") });
await store.put(meta("snap_c", 300, SNAPSHOT_REASONS.daily, 0), { id: "snap_c", state: state("c") });
fs.files.set(`${SNAPSHOT_FILE_DIR}/broken.meta.json`, "{not json");
fs.files.set(`${SNAPSHOT_FILE_DIR}/notes.txt`, "ignored");
const listed = await store.list();
assert.deepEqual(listed.map((item) => item.id), ["snap_c", "snap_b", "snap_a"], "newest first; a broken list file only hides itself");

await store.removeMany(["snap_b", "never-existed"]);
assert.deepEqual((await store.list()).map((item) => item.id), ["snap_c", "snap_a"]);
assert.equal(fs.files.has(`${SNAPSHOT_FILE_DIR}/snap_b.json`), false, "removing a snapshot deletes both files");

// 保留規則對檔案清單同樣適用：清空後的空快照不能把內容最多的那份擠掉。
const dailies = Array.from({ length: 4 }, (_, index) => meta(`daily_${index}`, 1000 + index, SNAPSHOT_REASONS.daily, 0));
const toDelete = selectSnapshotsToDelete([...dailies, meta("snap_a", 100, SNAPSHOT_REASONS.daily, 12)]);
assert.deepEqual(toDelete.sort(), ["daily_0", "daily_1"], "the richest snapshot survives even when every new daily is empty");

await store.clear();
assert.deepEqual(await store.list(), [], "clear removes the whole directory");
assert.equal(fs.files.size, 0);

// 寫入失敗要往上拋，讓服務層退回 IndexedDB；不能默默吞掉。
const failing = createSnapshotFileStore(fakeFilesystem({ failWrite: true }));
await assert.rejects(failing.put(meta("snap_x", 1, SNAPSHOT_REASONS.manual, 1), { id: "snap_x", state: {} }), /disk full/);
assert.throws(() => createSnapshotFileStore({}), /unavailable/);


// === 最新存檔鏡像（MP-090）：資料有變動時最多每分鐘寫一份，兩個固定 id 輪流，永不被保留規則刪掉 ===
assert.deepEqual(selectSnapshotsToDelete([
  ...Array.from({ length: 6 }, (_, index) => meta(`daily_${index}`, 2000 + index, SNAPSHOT_REASONS.daily, 3)),
  meta(LATEST_SNAPSHOT_IDS[0], 1, SNAPSHOT_REASONS.latest, 3),
]).filter(isLatestSnapshotId), [], "the latest-save mirror is never pruned, even when it is the oldest entry");
assert.equal(shouldWriteLatestSnapshot({ previous: null, previousJson: null, nextSummary: { characters: 0 }, nextJson: "{}" }), true, "the first mirror is always written");
assert.equal(shouldWriteLatestSnapshot({ previous: meta("x", 1, "latest", 2), previousJson: "{a}", nextSummary: { characters: 2 }, nextJson: "{a}" }), false, "unchanged content is not rewritten");
assert.equal(shouldWriteLatestSnapshot({ previous: meta("x", 1, "latest", 2), previousJson: "{a}", nextSummary: { characters: 0 }, nextJson: "{}" }), false, "an empty state never overwrites a mirror that still has characters");
assert.equal(shouldWriteLatestSnapshot({ previous: meta("x", 1, "latest", 2), previousJson: "{a}", nextSummary: { characters: 1 }, nextJson: "{b}" }), true, "fewer characters is still a legitimate change");

const mirrorFs = fakeFilesystem();
const mirrorStore = createSnapshotFileStore(mirrorFs);
configureSnapshotFileStoreForTests(mirrorStore);
const first = await saveLatestSnapshot({ state: state("v1"), version: "1.5.2" });
assert.equal(first.id, LATEST_SNAPSHOT_IDS[0]);
assert.equal(first.reason, SNAPSHOT_REASONS.latest);
assert.equal(await saveLatestSnapshot({ state: state("v1"), version: "1.5.2" }), null, "same content → no write");
const second = await saveLatestSnapshot({ state: { ...state("v2"), characters: [{ id: "v2" }, { id: "v2b" }] }, version: "1.5.2" });
assert.equal(second.id, LATEST_SNAPSHOT_IDS[1], "the second write goes to the other slot");
assert.equal(mirrorFs.files.has(`${SNAPSHOT_FILE_DIR}/${LATEST_SNAPSHOT_IDS[0]}.json`), false, "the previous slot is removed only after the new one is complete");
const writes = mirrorFs.calls.filter(([op]) => op === "write").map(([, path]) => path);
const deletes = mirrorFs.calls.filter(([op]) => op === "delete").map(([, path]) => path);
assert.ok(mirrorFs.calls.findIndex(([op, path]) => op === "delete" && path.endsWith(`${LATEST_SNAPSHOT_IDS[0]}.json`)) > mirrorFs.calls.findIndex(([op, path]) => op === "write" && path.endsWith(`${LATEST_SNAPSHOT_IDS[1]}.meta.json`)), "delete of the old slot happens after the new slot's list entry is written");
assert.equal(writes.length, 4, "two mirrors → four file writes");
assert.equal(deletes.length, 2);
assert.equal(await saveLatestSnapshot({ state: { ...state("empty"), characters: [] }, version: "1.5.2" }), null, "a wiped/empty state keeps the last good mirror");
const restored = await getLocalSnapshot(LATEST_SNAPSHOT_IDS[1]);
assert.equal(restored.state.characters.length, 2, "the mirror restores through the normal snapshot path");

// 每日快照照常寫入與修剪，不會動到鏡像；清單只列一份「最後一次存檔」。
for (let index = 0; index < 4; index += 1) await saveLocalSnapshot({ reason: SNAPSHOT_REASONS.daily, state: state(`d${index}`), version: "1.5.2" });
const listed2 = await listLocalSnapshots();
assert.equal(listed2.filter((item) => item.reason === SNAPSHOT_REASONS.latest).length, 1, "exactly one latest-save entry is listed");
assert.ok(listed2.some((item) => item.id === LATEST_SNAPSHOT_IDS[1]));
assert.equal(listed2.filter((item) => item.reason === SNAPSHOT_REASONS.daily).length, 2, "daily pruning (2 kept; the richest is one of them here) is unaffected by the mirror");
assert.deepEqual(collapseLatestSnapshots([meta(LATEST_SNAPSHOT_IDS[0], 5, "latest", 1), meta(LATEST_SNAPSHOT_IDS[1], 9, "latest", 1), meta("snap_z", 1, "daily", 1)]).map((item) => item.id), [LATEST_SNAPSHOT_IDS[1], "snap_z"], "when both slots briefly coexist only the newer one is shown");
configureSnapshotFileStoreForTests(null);

console.log("ok: APK snapshots are written to the private file system with list, restore, prune, clear and a latest-save mirror (MP-090)");
