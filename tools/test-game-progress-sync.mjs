import assert from "node:assert/strict";
import { mergeGameProgressSyncData } from "../utils/gameProgressSync.js";

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
