import assert from "node:assert/strict";
import { createTextSyncDocument } from "../utils/textSyncDocument.js";
import { mergeCollectionSyncData, mergeCoupleDaily, mergeTextSyncFeatureData } from "../utils/gameProgressSync.js";

// MP-093（2026-10-29）：正式站所有東西都要上雲端。寵物小屋、卡片背包、特別篇、特別記憶、抽卡進度
// 進帳號雲端文件（純文字／id），下載時依規則合併，雲端空的不能把本機清掉。
const avatar = `data:image/png;base64,${"A".repeat(200)}`;
const state = {
  characters: [{ id: "c1", name: "A", avatar }],
  chatHistory: {},
  featureData: {
    notes: [], calendar: null, loginReward: { day: 1 }, yunyinSave: null, systemMailbox: null, gachaCurrency: 10, gachaCrystalLedger: [],
    gachaInventory: [{ uid: "u1", cardId: "card-1", rarity: "SSR" }],
    gachaEpisodes: [{ id: "ep1", characterId: "c1", characterAvatar: avatar, updatedAt: 10, status: "active", messages: [{ id: "m1", role: "assistant", content: "hi", time: 10 }] }],
    gachaSpecialMemories: [{ id: "sm1", episodeId: "ep1", characterId: "c1", pinned: true, createdAt: 11 }],
    gachaProgress: { totalDrawCount: 30, drawsSinceLastSSR: 12 },
    petHome: { name: "小白", level: 3 },
    coupleDaily: { _promises: { c1: [{ id: "p1", text: "一起看電影", done: false }] }, _peakTemp: { c1: 60 }, store: { c1: { day: "2026-10-29" } } },
    personaFeatures: { persona2: { coupleDaily: { _peakTemp: { c1: 20 } }, dating: { matches: [1] } } },
    petSettings: { desktopPet: true },
    storePurchases: { orders: [{ id: "o1" }] },
    aiUsage: { total: 1 },
    musicPlayer: { volume: 0.5 },
  },
};

const document = createTextSyncDocument(state, { version: "1.5.3" });
const fd = document.state.featureData;
assert.deepEqual(fd.gachaInventory, state.featureData.gachaInventory, "card inventory travels in the account document");
assert.equal(fd.gachaEpisodes.length, 1);
assert.equal(fd.gachaEpisodes[0].characterAvatar, undefined, "the avatar snapshot inside an episode is stripped; only text goes up");
assert.equal(fd.gachaEpisodes[0].messages[0].content, "hi");
assert.deepEqual(fd.gachaSpecialMemories, state.featureData.gachaSpecialMemories);
assert.deepEqual(fd.gachaProgress, { totalDrawCount: 30, drawsSinceLastSSR: 12 });
assert.deepEqual(fd.petHome, { name: "小白", level: 3 });
assert.deepEqual(fd.coupleDaily, state.featureData.coupleDaily, "couple space of the active persona travels");
assert.deepEqual(fd.personaFeatures, { persona2: { coupleDaily: { _peakTemp: { c1: 20 } } } }, "other personas carry only couple space; dating stays local");
for (const key of ["petSettings", "storePurchases", "aiUsage", "musicPlayer"]) assert.equal(fd[key], undefined, `${key} stays on the device`);
assert.ok(!JSON.stringify(document).includes("base64,AAAA"), "no inline image data in the document");
const empty = createTextSyncDocument({ characters: [], chatHistory: {} }).state.featureData;
assert.deepEqual(empty.gachaInventory, []);
assert.equal(empty.petHome, null);

// --- 合併：雲端空的不能清掉本機 ---
const local = state.featureData;
const emptyRemote = { gachaInventory: [], gachaEpisodes: [], gachaSpecialMemories: [], gachaProgress: null, petHome: null, notes: [], calendar: null };
const keptLocal = mergeTextSyncFeatureData(local, emptyRemote);
assert.deepEqual(keptLocal.gachaInventory, local.gachaInventory, "an empty cloud inventory keeps the local cards");
assert.equal(keptLocal.gachaEpisodes.length, 1);
assert.equal(keptLocal.gachaSpecialMemories.length, 1);
assert.deepEqual(keptLocal.gachaProgress, local.gachaProgress);
assert.deepEqual(keptLocal.petHome, local.petHome);
assert.deepEqual(keptLocal.petSettings, local.petSettings, "device-only stores are untouched by a download");
assert.deepEqual(keptLocal.storePurchases, local.storePurchases);

// --- 背包：雲端有東西就以雲端為準（卡片會被消耗，不能聯集） ---
const remote = {
  gachaInventory: [{ uid: "u9", cardId: "card-9" }],
  gachaEpisodes: [
    { id: "ep1", characterId: "c1", updatedAt: 20, status: "completed", messages: [{ id: "m1" }, { id: "m2" }] },
    { id: "ep2", characterId: "c1", updatedAt: 5, status: "active", messages: [] },
  ],
  gachaSpecialMemories: [{ id: "sm2", episodeId: "ep2", characterId: "c1", pinned: false, createdAt: 6 }],
  gachaProgress: { totalDrawCount: 45, drawsSinceLastSSR: 2 },
  petHome: { name: "小黑", level: 1 },
};
const merged = mergeCollectionSyncData(local, remote);
assert.deepEqual(merged.gachaInventory.map((item) => item.uid).sort(), ["u1", "u9"], "cards union by uid: offline draws on this device are not lost");
assert.deepEqual(merged.gachaEpisodes.map((e) => e.id), ["ep1", "ep2"], "episodes union by id, newest first");
assert.equal(merged.gachaEpisodes[0].status, "completed", "the newer version of the same episode wins");
assert.deepEqual(merged.gachaSpecialMemories.map((m) => m.id).sort(), ["sm1", "sm2"], "special memories union by id");
assert.deepEqual(merged.gachaProgress, remote.gachaProgress, "the side with more total draws carries the pity counter");
assert.deepEqual(merged.petHome, remote.petHome, "a non-empty cloud pet home wins");

// 已被特別篇用掉的卡不會因為另一邊的背包還留著而復活。
const consumedMerge = mergeCollectionSyncData(
  { gachaInventory: [{ uid: "u1", cardId: "card-1" }, { uid: "u2", cardId: "card-2" }], gachaEpisodes: [] },
  { gachaInventory: [{ uid: "u2", cardId: "card-2" }], gachaEpisodes: [{ id: "ep9", item: { uid: "u1", cardId: "card-1" }, updatedAt: 5, messages: [] }] },
);
assert.deepEqual(consumedMerge.gachaInventory.map((item) => item.uid), ["u2"], "a card spent on an episode stays spent");
// 本機抽得比雲端多（例如雲端是舊備份）：保底計數留本機。
const olderCloud = mergeCollectionSyncData({ gachaProgress: { totalDrawCount: 80, drawsSinceLastSSR: 70 } }, { gachaProgress: { totalDrawCount: 45, drawsSinceLastSSR: 2 } });
assert.deepEqual(olderCloud.gachaProgress, { totalDrawCount: 80, drawsSinceLastSSR: 70 });
// 同一段特別篇本機較新（還沒上傳的進度）：留本機那份。
const localNewer = mergeCollectionSyncData({ gachaEpisodes: [{ id: "ep1", updatedAt: 99, messages: [1, 2, 3] }] }, { gachaEpisodes: [{ id: "ep1", updatedAt: 20, messages: [1] }] });
assert.equal(localNewer.gachaEpisodes[0].messages.length, 3);
// 沒有時間欄位的舊資料：同 id 取雲端。
const noTime = mergeCollectionSyncData({ gachaSpecialMemories: [{ id: "x", pinned: true }] }, { gachaSpecialMemories: [{ id: "x", pinned: false }] });
assert.equal(noTime.gachaSpecialMemories[0].pinned, false);
// 壞資料不炸。
assert.deepEqual(mergeCollectionSyncData(null, undefined), { gachaInventory: [], gachaEpisodes: [], gachaSpecialMemories: [], gachaProgress: null, petHome: null, coupleDaily: null, personaFeatures: {} });

// --- 情侶空間：依角色聯集，另一邊少的不會掉 ---
const coupleMerged = mergeCoupleDaily(
  { _promises: { c1: [{ id: "p1", text: "A", done: false }, { id: "p2", text: "B", done: false }] }, _anniversaries: { c1: [{ id: "a1", title: "初見" }] }, _peakTemp: { c1: 60, c2: 10 }, _nicknames: { c1: "小寶" }, store: { c1: { day: "old" } } },
  { _promises: { c1: [{ id: "p1", text: "A", done: true, doneAt: 5 }], c2: [{ id: "p9", text: "Z" }] }, _peakTemp: { c1: 40, c2: 30 }, _nicknames: { c2: "親愛的" }, store: { c1: { day: "new" } } },
);
assert.deepEqual(coupleMerged._promises.c1.map((p) => [p.id, p.done]), [["p1", true], ["p2", false]], "promises union by id; the cloud's completed state wins for the same promise");
assert.deepEqual(coupleMerged._promises.c2.map((p) => p.id), ["p9"]);
assert.deepEqual(coupleMerged._anniversaries.c1.map((a) => a.id), ["a1"], "anniversaries only on this device are kept");
assert.deepEqual(coupleMerged._peakTemp, { c1: 60, c2: 30 }, "peak temperature takes the max per character");
assert.deepEqual(coupleMerged._nicknames, { c1: "小寶", c2: "親愛的" });
assert.equal(coupleMerged.store.c1.day, "new", "daily store follows the cloud");
assert.equal(mergeCoupleDaily({ _peakTemp: { c1: 1 } }, null)._peakTemp.c1, 1, "no cloud copy keeps local");
assert.equal(mergeCoupleDaily(undefined, undefined), null);
const personaMerged = mergeCollectionSyncData(
  { personaFeatures: { p2: { coupleDaily: { _peakTemp: { c1: 50 } }, dating: { keep: true } } } },
  { personaFeatures: { p2: { coupleDaily: { _peakTemp: { c1: 70 } } }, p3: { coupleDaily: { _peakTemp: { c9: 5 } } } } },
);
assert.deepEqual(personaMerged.personaFeatures.p2, { coupleDaily: { _peakTemp: { c1: 70 } }, dating: { keep: true } }, "per-persona couple space merges; local dating untouched");
assert.deepEqual(personaMerged.personaFeatures.p3, { coupleDaily: { _peakTemp: { c9: 5 } } }, "a persona only known to the cloud is added");
assert.deepEqual(mergeCollectionSyncData({ gachaEpisodes: "nope" }, { gachaEpisodes: [null, 3, { id: "ok" }] }).gachaEpisodes.map((e) => e.id), ["ok"]);

console.log("ok: pets, cards, episodes, memories and gacha progress ride in the account document and merge without an empty cloud wiping the device (MP-093)");
