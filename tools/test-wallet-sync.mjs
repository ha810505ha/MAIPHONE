import assert from "node:assert/strict";
import { mergeWalletSyncData } from "../utils/walletSync.js";

const local = {
  wallet: {
    balance: 130,
    transactions: [
      { id: "initial", type: "income", amount: 100, time: 1 },
      { id: "local-income", type: "income", amount: 30, time: 3 },
    ],
    assets: [{ id: "asset-local", name: "Flower", qty: 1 }],
  },
  characterWallets: {},
  transfers: [{ id: "transfer-1", status: "pending", createdAt: 2 }],
};
const remote = {
  wallet: {
    balance: 80,
    transactions: [
      { id: "initial", type: "income", amount: 100, time: 1 },
      { id: "remote-expense", type: "expense", amount: 20, time: 4 },
    ],
    assets: [{ id: "asset-remote", name: "Ticket", qty: 1 }],
  },
  characterWallets: {},
  transfers: [{ id: "transfer-1", status: "accepted", createdAt: 2, resolvedAt: 5 }],
};

const merged = mergeWalletSyncData(local, remote);
assert.equal(merged.wallet.balance, 110, "independent income and expense must both be applied once");
assert.deepEqual(merged.wallet.transactions.map((entry) => entry.id), ["remote-expense", "local-income", "initial"]);
assert.equal(merged.wallet.assets.length, 2, "assets from both devices must survive");
assert.equal(merged.transfers[0].status, "accepted", "a resolved transfer must win over pending state");

console.log("ok: wallet sync merges ledger entries and transfer resolution safely");
