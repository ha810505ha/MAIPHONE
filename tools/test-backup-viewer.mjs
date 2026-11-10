import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isRescueFile, readBackupForViewing, rescueToAppState, summarizeBackupContent } from "../utils/backupInspect.js";
import { buildViewModel } from "../viewer/viewModel.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tr = (zh) => zh;
const wrap = (data, extra = {}) => ({ data, updatedAt: 1, rev: 1, ...extra });

const rescue = {
  format: "maliphone-rescue",
  formatVersion: 1,
  appVersion: "1.4.0",
  exportedAt: "2026-10-11T01:00:00.000Z",
  skipped: [{ key: "ent_chat_broken", error: "DataError" }],
  entries: {
    ent_core: wrap({ charOrder: ["b", "a"], playerProfile: { name: "玩家A" }, uiLanguage: "zh-TW", groupChats: [{ id: "g1", name: "咖啡團", messages: [{ id: "gm1", role: "assistant", content: "早安", speakerName: "阿澈", time: 5 }] }], chatRooms: { a: [{ id: "r1", title: "原本的聊天室", activeDataInTopLevel: true }, { id: "r2", title: "分支", messages: [{ id: "x", role: "user", content: "分支訊息", time: 9 }] }] }, activeRoomIds: { a: "r1" } }),
    ent_char_a: wrap({ id: "a", name: "小雪", avatar: "" }),
    ent_char_b: wrap({ id: "b", name: "阿澈" }),
    ent_char_gone: wrap({ id: "gone", name: "已刪除" }, { deleted: true }),
    ent_chat_a: wrap([{ id: "m1", role: "assistant", content: "<think>內心</think>今天過得怎麼樣？", time: 10 }, { id: "m2", role: "user", content: "還不錯", time: 20 }]),
    ent_chatbg_a: wrap({ image: "" }),
    ent_posts: wrap([{ id: "p1", authorType: "character", charId: "a", content: "貼文", time: 3, comments: [] }]),
    ent_apiConfig: wrap({ provider: "openai", apiKey: "" }),
    ent_notes: wrap([{ id: "n1", title: "筆記", content: "內容", updatedAt: 4 }]),
    ent_yunyinSave: wrap({ coins: 120, farm: { plots: [{ cropId: "x" }, { cropId: null }] }, inventory: { a: 2, b: 3 } }),
    "ent_persona_persona-default_dating": wrap({ swipes: [] }),
    "ent_persona_p_2_coupleDaily": wrap({ day: 1 }),
  },
};

assert.equal(isRescueFile(rescue), true);
const converted = rescueToAppState(rescue);
assert.equal(converted.format, "maliphone-app-state");
assert.equal(converted.source, "maliphone-rescue");
const state = converted.state;
assert.deepEqual(state.characters.map((item) => item.name), ["阿澈", "小雪"], "characters follow charOrder and skip deleted");
assert.equal(state.charOrder, undefined, "charOrder is an internal storage field");
assert.equal(state.chatHistory.a.length, 2);
assert.ok(state.chatBackgrounds.a, "chat backgrounds are kept separately from chats");
assert.equal(state.chatHistory.bg_a, undefined);
assert.equal(state.posts.length, 1);
assert.equal(state.featureData.notes.length, 1);
assert.equal(state.featureData.yunyinSave.coins, 120);
assert.deepEqual(Object.keys(state.featureData.personaFeatures).sort(), ["p_2", "persona-default"], "persona ids may contain underscores and dashes");
assert.ok(state.featureData.personaFeatures["persona-default"].dating);
assert.ok(state.featureData.personaFeatures.p_2.coupleDaily);

// 舊格式救援檔
const legacy = rescueToAppState({ format: "maliphone-rescue", entries: { app_state: { characters: [{ id: "z", name: "舊角色" }], chatHistory: {} } } });
assert.equal(legacy.state.characters[0].name, "舊角色");
assert.throws(() => rescueToAppState({ format: "maliphone-rescue", entries: {} }));

const summary = summarizeBackupContent(state);
assert.deepEqual(summary.characterNames, ["阿澈", "小雪"]);
assert.equal(summary.totalMessages, 4, "active room, other rooms, and group messages are counted");
assert.equal(summary.recentChats[0].name, "小雪");

const viewing = readBackupForViewing(rescue);
assert.equal(viewing.kind, "rescue");
assert.equal(viewing.skipped, 1);
assert.equal(readBackupForViewing(converted).kind, "rescue", "a converted rescue file is still labeled as rescue");
assert.equal(readBackupForViewing({ format: "maliphone-app-state", formatVersion: 1, state: { characters: [] } }).kind, "backup");
assert.throws(() => readBackupForViewing({ hello: "world" }));

// Missing/deleted/malformed core is viewable only, never a complete import.
for (const core of [undefined, wrap({}, { deleted: true }), wrap("broken")]) {
  const partialFile = structuredClone(rescue);
  if (core === undefined) delete partialFile.entries.ent_core;
  else partialFile.entries.ent_core = core;
  partialFile.entries.ent_chat_orphan = wrap([{ role: "user", content: "Orphan chat", time: 100 }]);
  partialFile.entries.ent_char_bad = wrap(null);
  partialFile.entries.ent_chat_bad = wrap("bad");
  partialFile.entries.ent_chat_deleted = wrap([{ content: "deleted" }], { deleted: true });
  partialFile.entries.ent_notes_bad = wrap("bad");
  const partial = readBackupForViewing(partialFile);
  assert.equal(partial.partial, true);
  assert.equal(partial.state.characters.length, 2);
  assert.equal(partial.state.chatHistory.orphan.length, 1);
  assert.equal(partial.state.chatHistory.bad, undefined);
  assert.equal(partial.state.chatHistory.deleted, undefined);
  assert.equal(partial.state.featureData.notes.length, 1);
  assert.equal(partial.state.featureData.personaFeatures.p_2.coupleDaily.day, 1);
  assert.ok(buildViewModel(partial.state, tr).chats.some((chat) => chat.id === "orphan" && chat.name === "未知角色"));
  assert.throws(() => rescueToAppState(partialFile), { code: "RESCUE_CORE_MISSING" });
}
assert.equal(viewing.partial, false);
const v2 = { format: "maliphone-rescue", entries: { part_core: { characters: [{ id: "v2" }] }, part_chatHistory: { v2: [{ content: "Legacy" }] } } };
assert.equal(readBackupForViewing(v2).partial, false);
assert.equal(rescueToAppState(v2).state.chatHistory.v2.length, 1);
delete v2.entries.part_core;
assert.equal(readBackupForViewing(v2).partial, true);
assert.equal(buildViewModel(readBackupForViewing(v2).state, tr).chats[0].count, 1);
assert.throws(() => rescueToAppState(v2), { code: "RESCUE_CORE_MISSING" });
const featureOnly = readBackupForViewing({ format: "maliphone-rescue", entries: { ent_notes: wrap([{ title: "Surviving note", content: "Read only" }]) } });
assert.equal(featureOnly.partial, true);
assert.equal(buildViewModel(featureOnly.state, tr).notes.length, 1);
for (const entries of [{}, { unknown: wrap({ value: 1 }) }, { ent_notes: wrap("broken"), ent_chat_x: wrap(null), ent_char_x: wrap(null) }]) {
  assert.throws(() => readBackupForViewing({ format: "maliphone-rescue", entries }));
}

const model = buildViewModel(viewing.state, tr);
assert.equal(model.playerName, "玩家A");
assert.equal(model.chats[0].name, "小雪");
assert.deepEqual(model.chats[0].rooms.map((room) => room.title), ["原本的聊天室", "分支"]);
assert.equal(model.groups[0].messages.length, 1);
assert.equal(model.posts[0].author, "小雪");
assert.equal(model.yunyin.planted, 1);
assert.equal(model.yunyin.items, 5);

// 檢視頁與其共用工具不得引用存檔或聊天執行期模組。
const FORBIDDEN = /indexedDbStorage|syncService|featureBackupService|hooks\/|services\/(?!diagnostics\/errorExplain)|MaliPhone\.jsx|localStorage|indexedDB/;
const viewerFiles = (await readdir(resolve(projectRoot, "viewer"))).filter((name) => /\.(jsx?|mjs)$/.test(name)).map((name) => `viewer/${name}`);
for (const file of [...viewerFiles, "utils/backupInspect.js", "utils/backupMediaAssets.js", "constants/featureStoreKeys.js"]) {
  const source = await readFile(resolve(projectRoot, file), "utf8");
  const imports = [...source.matchAll(/(?:import|from)\s*\(?\s*["']([^"']+)["']/g)].map((match) => match[1]);
  for (const target of imports) assert.doesNotMatch(target, FORBIDDEN, `${file} must not import ${target}`);
  assert.doesNotMatch(source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""), /\b(localStorage|indexedDB)\b/, `${file} must not touch browser storage`);
}

const viteConfig = await readFile(resolve(projectRoot, "vite.config.js"), "utf8");
assert.match(viteConfig, /viewer\.html/, "viewer.html must be a build entry");
assert.match(viteConfig, /"backup-inspect"/, "viewer shared helpers must stay out of mali-runtime");

console.log("ok: rescue files convert to backups and the read-only viewer never touches saved data");
