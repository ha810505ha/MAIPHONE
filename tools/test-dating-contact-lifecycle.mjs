import assert from "node:assert/strict";

import { promoteDatingContact } from "../services/dating/datingMatchApply.js";
import { chooseDatingContactId, normalizeDatingState } from "../services/dating/datingMatching.js";

const profileId = "fixture-profile";
const canonicalId = `dating-${profileId}`;
const entry = {
  id: profileId,
  characterId: canonicalId,
  profile: {
    name: "公開帳號",
    photos: ["https://example.invalid/avatar.webp"],
  },
  character: {
    id: canonicalId,
    datingProfileId: profileId,
    name: "測試角色",
    avatar: "",
    description: "完整角色卡",
  },
};

const sourceMessages = [
  { id: "dating-message-1", role: "assistant", content: "第一則信風訊息", time: 1_000 },
  { id: "dating-message-2", role: "user", content: "第二則信風訊息", time: 3_000 },
];
const existingMessage = {
  id: "normal-chat-message",
  role: "assistant",
  content: "既有正常聊天室訊息",
  time: 2_000,
};

let chatHistory = { [canonicalId]: [existingMessage] };
const addCharacterCalls = [];
const addCharacter = (character, options) => {
  addCharacterCalls.push({ character, options });
  return { ...character, id: options.id };
};
const setChatHistory = (updater) => {
  chatHistory = typeof updater === "function" ? updater(chatHistory) : updater;
};
let generatedId = 0;
const createId = () => `migrated-${++generatedId}`;

const firstResult = promoteDatingContact({
  entry,
  messages: sourceMessages,
  addCharacter,
  setChatHistory,
  createId,
});

assert.equal(firstResult, canonicalId, "交換聯絡方式後必須回傳永久角色 ID");
assert.equal(addCharacterCalls.length, 1, "第一次交換應呼叫一次 addCharacter");
assert.equal(addCharacterCalls[0].options.id, canonicalId, "addCharacter 必須收到永久角色 ID");
assert.equal(addCharacterCalls[0].options.source, "dating", "addCharacter 必須標示來源為 dating");
assert.equal(addCharacterCalls[0].options.silent, true, "信風解鎖不應觸發一般新增角色提示");
assert.equal(addCharacterCalls[0].options.initialMessages.length, sourceMessages.length, "建立第一個 room 時必須直接注入信風歷史");
assert.equal(addCharacterCalls[0].character.id, canonicalId, "送入 addCharacter 的完整角色卡必須保留 canonical ID");
assert.equal(addCharacterCalls[0].character.datingProfileId, profileId, "完整角色卡必須保留 datingProfileId");
assert.equal(addCharacterCalls[0].character.avatar, entry.profile.photos[0], "空白角色頭像應回退到信風公開照片");

const firstHistory = chatHistory[canonicalId];
assert.equal(firstHistory.length, 3, "第一次交換應保留既有訊息並加入兩則信風歷史");
assert.deepEqual(
  firstHistory.find((message) => message.id === existingMessage.id),
  existingMessage,
  "交換不得覆蓋既有正常聊天室訊息",
);
for (const source of sourceMessages) {
  const migrated = firstHistory.find((message) => message.datingMessageId === source.id);
  assert.ok(migrated, `缺少來源信風訊息 ${source.id}`);
  assert.equal(migrated.fromDating, true, `${source.id} 必須標記 fromDating`);
  assert.equal(migrated.datingMessageId, source.id, `${source.id} 必須保留 datingMessageId`);
  assert.equal(migrated.role, source.role, `${source.id} role 必須保留`);
  assert.equal(migrated.content, source.content, `${source.id} content 必須保留`);
  assert.equal(migrated.time, source.time, `${source.id} time 必須保留`);
}
assert.deepEqual(firstHistory.map((message) => message.time), [1_000, 2_000, 3_000], "合併後歷史應依時間排序");

const snapshotAfterFirstPromotion = structuredClone(chatHistory);
const secondResult = promoteDatingContact({
  entry,
  messages: sourceMessages,
  addCharacter,
  setChatHistory,
  createId,
});

assert.equal(secondResult, canonicalId, "重跑仍應回傳同一永久角色 ID");
assert.equal(addCharacterCalls.length, 2, "重跑可交由 addCharacter 以 canonical ID 做既有角色解析");
assert.equal(addCharacterCalls[1].options.id, canonicalId, "重跑不可改用隨機角色 ID");
assert.deepEqual(chatHistory, snapshotAfterFirstPromotion, "重跑不得重複匯入相同信風訊息");
assert.equal(chatHistory[canonicalId].filter((message) => message.fromDating).length, sourceMessages.length);
assert.equal(chatHistory[canonicalId].filter((message) => message.id === existingMessage.id).length, 1);

let atomicHistory = {};
let firstRoomMessages = null;
let atomicId = 0;
promoteDatingContact({
  entry,
  messages: sourceMessages,
  addCharacter: (character, options) => {
    firstRoomMessages = options.initialMessages;
    atomicHistory = { ...atomicHistory, [options.id]: firstRoomMessages };
    return { ...character, id: options.id };
  },
  setChatHistory: (updater) => {
    atomicHistory = typeof updater === "function" ? updater(atomicHistory) : updater;
  },
  createId: () => `atomic-${++atomicId}`,
});
assert.strictEqual(
  atomicHistory[canonicalId],
  firstRoomMessages,
  "新解鎖的 first room 與 chatHistory 必須在同一同步時點共用完整信風歷史",
);
assert.equal(firstRoomMessages.some((message) => message.openingMessage), false, "信風解鎖不得額外插入角色卡 opening");

const legacyProfileId = "lin-yuchen";
const stableLegacyCharacterId = `dating-${legacyProfileId}`;
const normalizedLockedState = normalizeDatingState({
  relations: { [legacyProfileId]: { messages: [], unread: 0 } },
});
assert.equal(normalizedLockedState.relations[legacyProfileId].characterId, stableLegacyCharacterId);
assert.equal(normalizedLockedState.relations[legacyProfileId].contactState, "locked");
assert.equal(normalizedLockedState.relations[legacyProfileId].contactCharId, null);

const normalizedLegacyUnlockedState = normalizeDatingState({
  relations: { [legacyProfileId]: { messages: [], contactCharId: "legacy-b", promotedAt: 10 } },
});
assert.equal(normalizedLegacyUnlockedState.relations[legacyProfileId].characterId, stableLegacyCharacterId);
assert.equal(normalizedLegacyUnlockedState.relations[legacyProfileId].contactState, "unlocked");
assert.equal(normalizedLegacyUnlockedState.relations[legacyProfileId].contactCharId, "legacy-b");

const duplicateLegacyContacts = [
  { id: "legacy-a", datingProfileId: legacyProfileId, createdAt: 100 },
  { id: "legacy-b", datingProfileId: legacyProfileId, createdAt: 200 },
  { id: stableLegacyCharacterId, datingProfileId: legacyProfileId, createdAt: 300 },
];
assert.equal(
  chooseDatingContactId(duplicateLegacyContacts, legacyProfileId, { contactCharId: "legacy-b" }),
  "legacy-b",
  "舊 relation 正在使用的角色必須優先，不能把後續聊天室藏到另一張重複卡後面",
);
assert.equal(
  chooseDatingContactId(duplicateLegacyContacts, legacyProfileId, {}),
  stableLegacyCharacterId,
  "relation 沒有有效指向時應優先採用新版永久角色 ID",
);
assert.equal(
  chooseDatingContactId(duplicateLegacyContacts.slice(0, 2), legacyProfileId, {}),
  "legacy-a",
  "沒有永久 ID 時應以最早建立的舊角色作穩定 fallback",
);

console.log("dating contact lifecycle: ok");
