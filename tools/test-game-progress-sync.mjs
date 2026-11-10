import assert from "node:assert/strict";
import { mergeCrystalSyncData, mergeGameProgressSyncData } from "../utils/gameProgressSync.js";

const local = {
  gachaCurrency: 150,
  gachaCrystalLedger: [
    { id: "initial", type: "initial", amount: 100, time: 1, balanceAfter: 100 },
    { id: "local-login", type: "income", amount: 50, time: 3, balanceAfter: 150 },
  ],
  loginReward: { cycle: 1, day: 2, lastClaimDate: "2026-08-12", claimedDates: ["2026-08-11", "2026-08-12"] },
  yunyinSave: { coins: 120, lastSeenAt: 5 },
  systemMailbox: { readMailIds: ["mail-1"], claimedGrantIds: ["grant-1"] },
};
const remote = {
  gachaCurrency: 80,
  gachaCrystalLedger: [
    { id: "initial", type: "initial", amount: 100, time: 1, balanceAfter: 100 },
    { id: "remote-spend", type: "expense", amount: 20, time: 4, balanceAfter: 80 },
  ],
  loginReward: { cycle: 1, day: 3, lastClaimDate: "2026-08-13", claimedDates: ["2026-08-12", "2026-08-13"] },
  yunyinSave: { coins: 140, lastSeenAt: 7 },
  systemMailbox: { readMailIds: ["mail-2"], claimedGrantIds: ["grant-1", "grant-2"] },
};

const merged = mergeGameProgressSyncData(local, remote);
assert.equal(merged.gachaCurrency, 130, "crystal transactions from both devices must apply exactly once");
assert.deepEqual(merged.gachaCrystalLedger.map((entry) => entry.id), ["remote-spend", "local-login", "initial"]);
assert.deepEqual(merged.loginReward.claimedDates, ["2026-08-11", "2026-08-12", "2026-08-13"], "claimed dates must be retained");
assert.equal(merged.loginReward.lastClaimDate, "2026-08-13");
assert.equal(merged.yunyinSave.coins, 140, "the last played Yunyin save must win");
assert.deepEqual(merged.systemMailbox, { readMailIds: ["mail-1", "mail-2"], claimedGrantIds: ["grant-1", "grant-2"] }, "mail read and claimed flags must merge");

console.log("ok: game progress sync merges crystals and login rewards, and selects the newest Yunyin save");

// MP-090：被系統清掉資料庫的裝置會重建一份空的進度；合併時它不能贏過有進度的那邊。
import { hasYunyinProgress, mergeTextSyncFeatureData, newestYunyinSave } from "../utils/gameProgressSync.js";

const playedVilla = { coins: 860, cultivation: { realmIdx: 2, exp: 40 }, inventory: { herb: 3 }, lastSeenAt: 100 };
const pristineVilla = { coins: 100, cultivation: { realmIdx: 0, exp: 0 }, inventory: {}, farm: { plots: [{ id: 0, cropId: null }] }, createdAt: 900, lastSeenAt: 900 };
assert.equal(hasYunyinProgress(playedVilla), true);
assert.equal(hasYunyinProgress(pristineVilla), false);
assert.equal(hasYunyinProgress({ coins: 100, farm: { plots: [{ id: 0, cropId: "herb", plantedAt: 1 }] } }), true, "a planted field counts as progress");
assert.equal(hasYunyinProgress({ coins: 100, settings: { bindings: { npc1: "char-1" } } }), true, "a bound resident counts as progress");
assert.equal(newestYunyinSave(playedVilla, pristineVilla), playedVilla, "a newer pristine save must not beat a played save");
assert.equal(newestYunyinSave(pristineVilla, playedVilla), playedVilla);
assert.equal(newestYunyinSave(pristineVilla, { ...pristineVilla, lastSeenAt: 950 }).lastSeenAt, 950, "two pristine saves still pick the newest");

const wiped = {
  gachaCurrency: 0,
  gachaCrystalLedger: [{ id: "initial-wiped", type: "initial", amount: 0, time: 900, balanceAfter: 0 }],
  loginReward: { cycle: 1, day: 1, lastClaimDate: "2026-10-27", claimedDates: ["2026-10-27"] },
  yunyinSave: pristineVilla,
  systemMailbox: null,
};
const played = {
  gachaCurrency: 1000,
  // 30 筆上限：帳本已被截斷，只剩最後兩筆，看不到更早的 800。
  gachaCrystalLedger: [
    { id: "p-income", type: "income", amount: 150, time: 50, balanceAfter: 950 },
    { id: "p-spend", type: "expense", amount: 100, time: 60, balanceAfter: 850 },
    { id: "p-income-2", type: "income", amount: 150, time: 70, balanceAfter: 1000 },
  ],
  loginReward: { cycle: 3, day: 5, lastClaimDate: "2026-10-25", claimedDates: ["2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"] },
  yunyinSave: playedVilla,
  systemMailbox: { readMailIds: ["mail-1"], claimedGrantIds: [] },
};
for (const [label, result] of [["local wiped", mergeGameProgressSyncData(wiped, played)], ["remote wiped", mergeGameProgressSyncData(played, wiped)]]) {
  assert.equal(result.gachaCurrency, 1000, `${label}: an empty crystal account must not zero the other side`);
  assert.equal(result.yunyinSave, playedVilla, `${label}: the played villa wins`);
  assert.equal(result.loginReward.cycle, 3, `${label}: login cycle keeps the longer streak`);
  assert.equal(result.loginReward.day, 5, `${label}: login day keeps the longer streak`);
  assert.deepEqual(result.loginReward.claimedDates.at(-1), "2026-10-27", `${label}: the date claimed after the wipe stays claimed`);
}

// 清空後又領了一次登入獎勵：帳本只有一筆 +50，基底必須沿用有歷史那邊的 850，不能歸零。
const wipedThenClaimed = {
  gachaCurrency: 50,
  gachaCrystalLedger: [
    { id: "initial-wiped", type: "initial", amount: 0, time: 900, balanceAfter: 0 },
    { id: "w-login", type: "income", amount: 50, time: 910, balanceAfter: 50 },
  ],
};
assert.equal(mergeCrystalSyncData(wipedThenClaimed, played).gachaCurrency, 1050, "truncated history is kept and the new income is added once");
assert.equal(mergeCrystalSyncData(played, wipedThenClaimed).gachaCurrency, 1050);

// 兩邊帳本都被截斷時維持舊規則：取較低的基底，舊裝置不能憑空變出結晶。
const stale = { gachaCurrency: 1000, gachaCrystalLedger: [{ id: "s-income", type: "income", amount: 10, time: 10, balanceAfter: 1000 }] };
const spent = { gachaCurrency: 100, gachaCrystalLedger: [{ id: "s-income", type: "income", amount: 10, time: 10, balanceAfter: 1000 }, { id: "spend", type: "expense", amount: 900, time: 20, balanceAfter: 100 }] };
assert.equal(mergeCrystalSyncData(stale, spent).gachaCurrency, 100, "a stale device must not manufacture crystals");

// 雲端文件固定帶 notes: []／calendar: null；那代表沒上傳過，不是刪除。
const localFeatures = { notes: [{ id: "n1", text: "keep me" }], calendar: { events: [{ id: "e1" }] }, petHome: { level: 3 }, gachaInventory: [{ uid: "c1" }] };
const emptyCloud = { notes: [], calendar: null, loginReward: null, yunyinSave: null, systemMailbox: null, gachaCurrency: 0, gachaCrystalLedger: [] };
const afterDownload = mergeTextSyncFeatureData(localFeatures, emptyCloud);
assert.deepEqual(afterDownload.notes, localFeatures.notes, "empty cloud notes keep local notes");
assert.deepEqual(afterDownload.calendar, localFeatures.calendar, "null cloud calendar keeps local calendar");
assert.deepEqual(afterDownload.petHome, localFeatures.petHome, "pets are never part of the cloud document");
assert.deepEqual(afterDownload.gachaInventory, localFeatures.gachaInventory);
const richCloud = { ...emptyCloud, notes: [{ id: "n2", text: "cloud" }], calendar: { events: [{ id: "e2" }] } };
const afterRichDownload = mergeTextSyncFeatureData(localFeatures, richCloud);
assert.deepEqual(afterRichDownload.notes, richCloud.notes, "cloud notes with content replace local notes as before");
assert.deepEqual(afterRichDownload.calendar, richCloud.calendar);

console.log("ok: a wiped device never overrides played villa, login streak, crystals, notes or calendar (MP-090)");
