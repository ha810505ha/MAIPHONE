import assert from "node:assert/strict";
import {
  createTextSyncDocument,
  preserveLocalMedia,
  stripTextSyncMedia,
  validateTextSyncDocument,
} from "../utils/textSyncDocument.js";
import { readFile } from "node:fs/promises";

const image = "data:image/png;base64,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const local = {
  characters: [{ id: "char-1", name: "Before", avatar: image, heroImage: image }],
  chatHistory: { "char-1": [{ id: "message-1", content: "before", image: "A".repeat(128) }] },
  featureData: {
    notes: [{ id: "note-1", text: "local note", image: image }],
    calendar: { events: [{ id: "calendar-1", title: "Dinner", date: "2026-08-13", note: "Bring flowers" }] },
    loginReward: { cycle: 1, day: 2, lastClaimDate: "2026-08-13", claimedDates: ["2026-08-12", "2026-08-13"] },
    yunyinSave: { coins: 120, lastSeenAt: 100 },
    systemMailbox: { readMailIds: ["welcome"], claimedGrantIds: ["welcome-crystals"] },
    gachaCurrency: 250,
    gachaCrystalLedger: [{ id: "crystal-1", type: "income", amount: 250, time: 100, balanceAfter: 250 }],
    wallet: { balance: 99 },
  },
  localAppData: { keep: "local" },
};
const remote = {
  characters: [{ id: "char-1", name: "After" }],
  chatHistory: { "char-1": [{ id: "message-1", content: "after" }] },
};

const stripped = stripTextSyncMedia(local);
assert.equal("avatar" in stripped.characters[0], false, "text sync must omit character avatars");
assert.equal("image" in stripped.chatHistory["char-1"][0], false, "text sync must omit raw chat images");

const document = createTextSyncDocument(local, { version: "test" });
assert.equal(document.format, "maliphone-text-sync");
assert.deepEqual(document.state.featureData, {
  notes: [{ id: "note-1", text: "local note" }],
  calendar: { events: [{ id: "calendar-1", title: "Dinner", date: "2026-08-13", note: "Bring flowers" }] },
  loginReward: { cycle: 1, day: 2, lastClaimDate: "2026-08-13", claimedDates: ["2026-08-12", "2026-08-13"] },
  yunyinSave: { coins: 120, lastSeenAt: 100 },
  systemMailbox: { readMailIds: ["welcome"], claimedGrantIds: ["welcome-crystals"] },
  gachaCurrency: 250,
  gachaCrystalLedger: [{ id: "crystal-1", type: "income", amount: 250, time: 100, balanceAfter: 250 }],
}, "text sync includes the selected text and game-progress stores");
assert.equal(document.state.wallet, undefined, "wallet must use the dedicated ledger payload");
assert.equal(document.state.walletData.wallet.balance, 0, "wallet ledger payload is included");
assert.equal("localAppData" in document.state, false, "local browser data is local-only in v1");
assert.equal(validateTextSyncDocument(document), document);

const accountSettingsSource = await readFile(
  new URL("../components/auth/AccountSettingsSection.jsx", import.meta.url),
  "utf8",
);
assert.doesNotMatch(
  accountSettingsSource,
  /480\s*\*\s*1024|480\s*KB|TextEncoder\(\).*JSON\.stringify\(document\)/,
  "account text sync must not impose a client-side payload-size cap",
);

const merged = preserveLocalMedia(remote, local);
assert.equal(merged.characters[0].name, "After");
assert.equal(merged.characters[0].avatar, image, "local avatar must survive text download");
assert.equal(merged.chatHistory["char-1"][0].content, "after");
assert.equal(merged.chatHistory["char-1"][0].image, "A".repeat(128), "local chat image must survive text download");

console.log("ok: text sync excludes media and keeps local media on download");
