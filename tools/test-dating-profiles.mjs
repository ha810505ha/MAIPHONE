import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DATING_PROFILES } from "../data/dating/profiles.js";
import { isValidTag } from "../data/dating/interestTags.js";
import { buildDatingSystemPrompt } from "../services/dating/datingChat.js";
import { DATING_OPENING_MESSAGE_MAX } from "../services/dating/datingOpenings.js";

const requiredCharacterFields = [
  "name",
  "description",
  "personality",
  "scenario",
  "initialRealityMessage",
  "messageExamples",
  "systemPrompt",
  "relationshipToUser",
  "creator",
  "creatorNotes",
  "characterVersion",
];

const requiredEmptyCharacterFields = [
  "firstMessage",
  "initialOnlineMessage",
  "privateNotes",
];

const legacyProfileIds = ["lin-yuchen", "zhou-che", "shen-wanning"];

const isValidClockTime = (value) => {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ""));
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
};

const validateOpeningSequence = (value, label, entryId) => {
  assert.ok(Array.isArray(value), `${entryId} ${label} 必須是訊息陣列`);
  assert.ok(value.length >= 1 && value.length <= DATING_OPENING_MESSAGE_MAX, `${entryId} ${label} 必須有 1–${DATING_OPENING_MESSAGE_MAX} 則`);
  value.forEach((message, index) => {
    assert.ok(typeof message === "string" && message.trim(), `${entryId} ${label}[${index}] 不可為空`);
    assert.ok(!/\{\{(?:user|char)\}\}/.test(message), `${entryId} ${label}[${index}] 不可含角色變數`);
  });
  return value;
};

const characterLimits = {
  name: 80,
  description: 8000,
  personality: 8000,
  scenario: 8000,
  firstMessage: 4000,
  initialOnlineMessage: 4000,
  initialRealityMessage: 4000,
  messageExamples: 12000,
  systemPrompt: 8000,
  relationshipToUser: 120,
  creator: 80,
  creatorNotes: 4000,
  characterVersion: 40,
  privateNotes: 4000,
};

if (DATING_PROFILES.length === 0) {
  const featureFlags = await readFile(new URL("../config/featureFlags.js", import.meta.url), "utf8");
  assert.match(
    featureFlags,
    /DATING_ENABLED\s*=\s*readFeatureFlag\("VITE_DATING_ENABLED", false\)/,
    "沒有私有角色資料時，信風必須維持預設關閉",
  );
  console.log("dating profile validation skipped: private profiles are absent and dating is disabled by default");
  process.exit(0);
}

assert.equal(DATING_PROFILES.length, 25, "信風角色池必須正好有 25 位角色");

const ids = new Set();
const canonicalCharacterIds = new Set();
const publicNames = new Set();
const realNames = new Set();
const responseStyleCounts = new Map();
const paceCounts = new Map();
const openingBubbleCounts = [];
const superLikeBubbleCounts = [];

for (const entry of DATING_PROFILES) {
  assert.ok(entry && typeof entry === "object", "角色資料必須是物件");
  assert.match(entry.id || "", /^[a-z0-9-]+$/, `${entry.id || "未知角色"} 的 id 格式錯誤`);
  assert.ok(!ids.has(entry.id), `角色 id 重複：${entry.id}`);
  ids.add(entry.id);

  assert.ok(["instant", "normal", "slow"].includes(entry.responseStyle), `${entry.id} responseStyle 無效`);
  assert.ok(["fast", "normal", "slow"].includes(entry.pace), `${entry.id} pace 無效`);
  responseStyleCounts.set(entry.responseStyle, (responseStyleCounts.get(entry.responseStyle) || 0) + 1);
  paceCounts.set(entry.pace, (paceCounts.get(entry.pace) || 0) + 1);
  assert.ok(isValidClockTime(entry.onlineHours?.start), `${entry.id} onlineHours.start 格式或範圍錯誤`);
  assert.ok(isValidClockTime(entry.onlineHours?.end), `${entry.id} onlineHours.end 格式或範圍錯誤`);
  assert.match(entry.onlineHours?.start || "", /^\d{2}:\d{2}$/, `${entry.id} 上線開始時間無效`);
  assert.match(entry.onlineHours?.end || "", /^\d{2}:\d{2}$/, `${entry.id} 上線結束時間無效`);
  assert.equal(entry.isScam, undefined, `${entry.id} 目前不應設定為詐騙角色`);

  const profile = entry.profile || {};
  assert.ok(typeof profile.name === "string" && profile.name.trim(), `${entry.id} 缺少公開名稱`);
  assert.ok(!publicNames.has(profile.name), `公開名稱重複：${profile.name}`);
  publicNames.add(profile.name);
  assert.ok(Number.isInteger(profile.age) && profile.age >= 20, `${entry.id} 必須是成年角色`);
  assert.ok(typeof profile.job === "string" && profile.job.trim(), `${entry.id} 缺少職業`);
  assert.ok(Number.isFinite(profile.distance) && profile.distance >= 0, `${entry.id} 距離無效`);
  assert.ok(typeof profile.bio === "string" && profile.bio.trim() && profile.bio.length <= 500, `${entry.id} 公開自介無效`);
  assert.deepEqual(profile.photos, [], `${entry.id} 現階段不應加入照片`);
  assert.ok(Array.isArray(profile.tags) && profile.tags.length > 0 && profile.tags.length <= 12, `${entry.id} 公開標籤數量無效`);
  profile.tags.forEach((tag) => assert.ok(isValidTag(tag), `${entry.id} 使用不存在的公開標籤：${tag}`));
  assert.ok(!profile.bio.includes("{{user}}"), `${entry.id} 的靜態自介不可含 {{user}}`);

  assert.ok(Array.isArray(entry.dislikes), `${entry.id} dislikes 必須是陣列`);
  entry.dislikes.forEach((tag) => assert.ok(isValidTag(tag), `${entry.id} 使用不存在的隱藏雷點：${tag}`));
  const openingMessages = validateOpeningSequence(entry.openingMessage, "openingMessage", entry.id);
  const superLikeOpeningMessages = validateOpeningSequence(entry.superLikeOpeningMessage, "superLikeOpeningMessage", entry.id);
  openingBubbleCounts.push(openingMessages.length);
  superLikeBubbleCounts.push(superLikeOpeningMessages.length);
  assert.notDeepEqual(superLikeOpeningMessages, openingMessages, `${entry.id} Super Like 開場必須是獨立內容`);

  assert.deepEqual(
    profile.tags.filter((tag) => entry.dislikes.includes(tag)),
    [],
    `${entry.id} 公開喜好與隱藏雷點不可重疊`,
  );
  const character = entry.character || {};
  const expectedCharacterId = `dating-${entry.id}`;
  assert.equal(entry.characterId, expectedCharacterId, `${entry.id} characterId 必須使用永久 canonical ID`);
  assert.equal(character.id, expectedCharacterId, `${entry.id} character.id 必須與 characterId 一致`);
  assert.equal(character.datingProfileId, entry.id, `${entry.id} character.datingProfileId 必須回指 profile id`);
  assert.ok(!canonicalCharacterIds.has(expectedCharacterId), `canonical character id 重複：${expectedCharacterId}`);
  canonicalCharacterIds.add(expectedCharacterId);
  openingMessages.forEach((message) => assert.ok(!message.includes(character.name), `${entry.id} 公開開場不可提前揭露完整本名`));
  superLikeOpeningMessages.forEach((message) => assert.ok(!message.includes(character.name), `${entry.id} Super Like 開場不可提前揭露完整本名`));
  assert.ok(!/\{\{(?:user|char)\}\}/.test(character.initialRealityMessage || ""), `${entry.id} 現實模式開場不可顯示未替換變數`);
  for (const field of requiredEmptyCharacterFields) {
    assert.ok(Object.hasOwn(character, field), `${entry.id} 缺少 character.${field}`);
    assert.equal(character[field], "", `${entry.id} character.${field} 必須明確留空`);
  }
  assert.equal(character.creator, "MAIPHONE", `${entry.id} creator 必須一致`);
  assert.equal(character.characterVersion, "1.1.0", `${entry.id} characterVersion 必須一致`);
  for (const field of requiredCharacterFields) {
    assert.ok(typeof character[field] === "string" && character[field].trim(), `${entry.id} 缺少完整角色卡欄位 character.${field}`);
  }
  assert.notEqual(character.name, profile.name, `${entry.id} 的公開網名與本名必須分層`);
  assert.ok(!realNames.has(character.name), `角色本名重複：${character.name}`);
  realNames.add(character.name);
  assert.equal(character.avatar, "", `${entry.id} 現階段不應加入頭像`);
  assert.equal(character.firstMessage || "", "", `${entry.id} 加入聯絡人時會搬移信風歷史，不應另塞線上開場`);
  assert.equal(character.initialOnlineMessage || "", "", `${entry.id} 加入聯絡人時會搬移信風歷史，不應另塞線上開場`);
  assert.equal(character.privateNotes || "", "", `${entry.id} 內建卡不應寫入玩家私人備註`);
  assert.match(character.description, /成年男性/, `${entry.id} description 必須明示成年男性`);
  assert.match(character.description, /成年女性/, `${entry.id} description 必須明示對成年女性的戀愛取向`);
  assert.match(character.description, /身高/, `${entry.id} description 缺少身高外貌設定`);
  assert.match(character.description, /(體重|公斤)/, `${entry.id} description 缺少體重體態設定`);
  assert.ok(character.description.length >= 1800, `${entry.id} description 尚未達到深化角色卡的背景密度`);
  assert.match(character.description, /【[^】]*(外貌|身形|體態)[^】]*】/, `${entry.id} description 缺少可辨識的外貌分段`);
  assert.match(character.description, /【[^】]*(背景|成長|家庭)[^】]*】/, `${entry.id} description 缺少成長／家庭背景分段`);
  assert.match(character.description, /【[^】]*(生活|場景|居住)[^】]*】/, `${entry.id} description 缺少可演出的生活場景分段`);
  assert.ok(character.personality.length >= 1600, `${entry.id} personality 尚未達到深化人格密度`);
  assert.match(character.personality, /【[^】]*(恐懼|弱點|盲點)[^】]*】/, `${entry.id} personality 缺少恐懼／弱點分段`);
  assert.match(character.personality, /【[^】]*(戀愛觀|對.*user|關係)[^】]*】/i, `${entry.id} personality 缺少戀愛／對玩家態度分段`);
  assert.match(character.personality, /【[^】]*(成人|親密)[^】]*】/, `${entry.id} personality 缺少成人親密設定分段`);
  assert.match(character.personality, /(明確同意|清楚同意|持續同意|可撤回|安全詞)/, `${entry.id} 成人親密設定缺少同意或撤回界線`);
  assert.ok(character.scenario.length >= 800, `${entry.id} scenario 尚未達到分階段劇情密度`);
  assert.match(character.scenario, /(信風|交換聯絡)/, `${entry.id} scenario 必須連接信風與聯絡人階段`);
  assert.match(character.scenario, /(階段|門檻|解鎖|揭露)/, `${entry.id} scenario 缺少關係階段或秘密揭露門檻`);
  assert.ok(character.relationshipToUser.includes("{{user}}"), `${entry.id} 關係欄必須使用 {{user}}`);
  assert.ok(character.scenario.includes("{{user}}"), `${entry.id} scenario 必須使用 {{user}}`);
  assert.ok(character.systemPrompt.includes("{{user}}"), `${entry.id} systemPrompt 必須使用 {{user}}`);
  assert.ok((character.messageExamples.match(/\{\{user\}\}[：:]/g) || []).length >= 10, `${entry.id} 至少需要 10 組玩家對話範例`);
  assert.ok((character.messageExamples.match(/\{\{char\}\}[：:]/g) || []).length >= 10, `${entry.id} 至少需要 10 組角色對話範例`);
  assert.ok(Array.isArray(character.tags) && character.tags.length > 0 && character.tags.length <= 20, `${entry.id} 角色標籤數量無效`);
  character.tags.forEach((tag) => assert.ok(typeof tag === "string" && tag.trim() && tag.length <= 30, `${entry.id} 角色標籤無效`));
  for (const [field, limit] of Object.entries(characterLimits)) {
    assert.ok(String(character[field] || "").length <= limit, `${entry.id} character.${field} 超過 ${limit} 字`);
  }

  const datingPrompt = buildDatingSystemPrompt(entry, { bio: "", tags: [] }, "測試玩家");
  assert.ok(datingPrompt.includes(profile.name), `${entry.id} 的信風 prompt 必須使用公開網名`);
  assert.ok(!datingPrompt.includes(character.name), `${entry.id} 的信風 prompt 不可提前洩漏角色本名`);
  assert.ok(datingPrompt.includes("不得把配對視為性同意"), `${entry.id} 的信風 prompt 必須封鎖角色卡成人設定提前外洩`);
}

for (const id of legacyProfileIds) {
  assert.ok(ids.has(id), `既有存檔相容 ID 不可移除：${id}`);
}
assert.equal(canonicalCharacterIds.size, 25, "25 位信風角色必須各自擁有唯一 canonical character ID");

assert.equal(Math.min(...openingBubbleCounts), 1, "至少一位寡言角色的普通開場應只有 1 則");
assert.equal(Math.max(...openingBubbleCounts), DATING_OPENING_MESSAGE_MAX, "至少一位健談角色的普通開場應使用 5 則");
assert.ok(new Set(openingBubbleCounts).size >= 4, "普通開場泡泡數需要有明顯差異");
assert.ok(new Set(superLikeBubbleCounts).size >= 3, "Super Like 開場泡泡數需要有差異");

for (const entry of DATING_PROFILES) {
  const prompt = buildDatingSystemPrompt(entry, { bio: "", tags: [] }, "測試玩家");
  assert.ok(!/\{\{[^}]+\}\}/.test(prompt), `${entry.id} 信風 prompt 不可殘留角色變數`);
  assert.ok(!prompt.includes(entry.character.name), `${entry.id} 信風 prompt 不可提早揭露本名`);
}

for (const style of ["instant", "normal", "slow"]) {
  assert.ok((responseStyleCounts.get(style) || 0) >= 5, `${style} 回覆型角色至少需要 5 位`);
}
for (const pace of ["fast", "normal", "slow"]) {
  assert.ok((paceCounts.get(pace) || 0) >= 5, `${pace} 關係節奏角色至少需要 5 位`);
}

console.log(`dating profile validation passed: ${DATING_PROFILES.length} complete profiles`);
