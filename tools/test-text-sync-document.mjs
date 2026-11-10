import assert from "node:assert/strict";
import {
  collectTextSyncMedia,
  createTextSyncDocument,
  hydrateTextSyncMedia,
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
  // MP-093：卡片背包、特別篇、特別記憶、抽卡進度、寵物小屋也進雲端文件；fixture 沒給就是空值。
  gachaInventory: [],
  gachaEpisodes: [],
  gachaSpecialMemories: [],
  gachaProgress: null,
  petHome: null,
  coupleDaily: null,
  personaFeatures: {},
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

// 玩家自己的大頭貼（playerProfile.avatar，以及其他人格的 personas[id].data.playerProfile.avatar）
// 跟角色頭像一樣當 "avatar" 收進雲端媒體，上傳時換成 ref、下載時只補空欄位（2026-10-29 確認）。
const playerAvatar = "data:image/jpeg;base64,BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const personaAvatar = "data:image/jpeg;base64,CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const profileState = {
  characters: [{ id: "char-1", avatar: image }],
  playerProfile: { name: "Mia", avatar: playerAvatar },
  personas: { "persona-2": { id: "persona-2", data: { playerProfile: { name: "Alt", avatar: personaAvatar } } } },
  featureData: {},
};
const profileMedia = collectTextSyncMedia(profileState);
assert.equal(profileMedia.get(playerAvatar), "avatar", "the player's own avatar is uploaded like a character avatar");
assert.equal(profileMedia.get(personaAvatar), "avatar", "other personas' avatars are uploaded too");
assert.equal(profileMedia.get(image), "avatar");
const playerRef = `maliphone-media:sha256-${"a".repeat(64)}.jpg`;
const personaRef = `maliphone-media:sha256-${"b".repeat(64)}.jpg`;
const characterRef = `maliphone-media:sha256-${"c".repeat(64)}.png`;
const profileDocument = createTextSyncDocument(profileState, { version: "test", mediaRefs: new Map([[playerAvatar, playerRef], [personaAvatar, personaRef], [image, characterRef]]) });
assert.equal(profileDocument.state.playerProfile.avatar, playerRef, "the cloud document carries the player avatar as a media ref");
assert.equal(profileDocument.state.playerProfile.name, "Mia");
assert.equal(profileDocument.state.personas["persona-2"].data.playerProfile.avatar, personaRef);
assert.equal("avatar" in createTextSyncDocument(profileState, { version: "test" }).state.playerProfile, false, "without uploaded media the avatar is left out, never inlined");
const emptyDevice = await hydrateTextSyncMedia(profileDocument.state, { playerProfile: { name: "", avatar: "" } }, async (ref) => (ref === playerRef ? playerAvatar : personaAvatar));
assert.equal(emptyDevice.state.playerProfile.avatar, playerAvatar, "a new device gets the player avatar back from the cloud");
const keptDevice = await hydrateTextSyncMedia(profileDocument.state, { playerProfile: { avatar: personaAvatar } }, async () => { throw new Error("must not download over a local avatar"); });
assert.equal(keptDevice.state.playerProfile.avatar, personaAvatar, "an existing local player avatar is kept");

console.log("ok: text sync excludes media, keeps local media on download, and carries the player avatar as a media ref");
