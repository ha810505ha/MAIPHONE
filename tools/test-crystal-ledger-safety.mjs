import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CRYSTAL_LEDGER_LIMIT,
  applyCrystalTransaction,
  createInitialCrystalLedger,
} from "../utils/crystalLedger.js";

const initial = createInitialCrystalLedger(15178, 1000);
assert.equal(initial.length, 1);
assert.equal(initial[0].type, "initial");
assert.equal(initial[0].balanceAfter, 15178);
assert.equal(initial[0].note, "初始結晶餘額");

let account = { balance: 15178, ledger: initial };
for (let index = 1; index <= 35; index += 1) {
  account = applyCrystalTransaction(account, index, {
    id: `income-${index}`,
    source: "test",
    note: `測試獲得 ${index}`,
  }, 1000 + index).account;
}
assert.equal(account.ledger.length, CRYSTAL_LEDGER_LIMIT);
assert.equal(account.ledger[0].id, "income-35");
assert.equal(account.ledger.at(-1).id, "income-6");
assert(!account.ledger.some((entry) => entry.type === "initial"), "the oldest initial entry should age out normally");

const spent = applyCrystalTransaction({ balance: 50, ledger: [] }, -80, {
  id: "expense",
  source: "furniture",
  note: "購買家具",
}, 2000);
assert.equal(spent.account.balance, 0);
assert.equal(spent.transaction.amount, 50);
assert.equal(spent.transaction.type, "expense");
assert.equal(spent.transaction.balanceAfter, 0);

const source = async (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [context, wallet, storage, backup, couple, login, mailbox, yunyin, dungeon, shop, resident, furniture] = await Promise.all([
  source("contexts/GachaContext.jsx"),
  source("components/wallet/WalletLedgerView.jsx"),
  source("utils/indexedDbStorage.js"),
  source("services/featureBackupService.js"),
  source("components/apps/CoupleApp.jsx"),
  source("components/apps/LoginRewardApp.jsx"),
  source("components/settings/SystemMailboxSettings.jsx"),
  source("yunyin/YunyinGame.jsx"),
  source("yunyin/ui/DungeonPanel.jsx"),
  source("yunyin/ui/ShopPanel.jsx"),
  source("yunyin/ui/ResidentPanel.jsx"),
  source("yunyin/ui/FurnitureShopPanel.jsx"),
]);

assert(context.includes("applyCrystalTransaction"), "all balance changes must pass through the shared crystal ledger");
assert(context.includes("ent_gachaCrystalLedger"), "the crystal ledger must be persisted");
assert(wallet.includes('tab==="crystals"'), "the player wallet must expose a crystal field");
assert(wallet.includes("最多保留 30 筆"), "the wallet must explain the visible history limit");
assert(storage.includes('"ent_gachaCrystalLedger"'), "the new feature entity must be allowed by storage");
assert(backup.includes('gachaCrystalLedger: ["ent_gachaCrystalLedger", null]'), "crystal history must be included in backups");

for (const [name, code, marker] of [
  ["couple task", couple, 'source: "couple"'],
  ["login reward", login, 'source: "login"'],
  ["system mailbox", mailbox, 'source: "mailbox"'],
  ["Yunyin default", yunyin, 'source: "yunyin"'],
  ["Yunyin dungeon", dungeon, "雲隱山莊・秘境"],
  ["Yunyin order", shop, "雲隱山莊・行商訂單"],
  ["Yunyin resident request", resident, "雲隱山莊・完成"],
  ["furniture purchase", furniture, 'source: "furniture"'],
]) {
  assert(code.includes(marker), `${name} must identify its crystal transaction`);
}

console.log("ok: crystal balance migration, 30-entry cap, wallet history, and all reward sources stay connected");
