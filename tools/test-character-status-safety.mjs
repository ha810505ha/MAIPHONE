import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildCharacterStatusConversation,
  buildCharacterStatusPrompt,
  CHARACTER_STATUS_CONTEXT_MESSAGE_COUNT,
  CHARACTER_STATUS_CONTEXT_MESSAGE_LIMIT,
  CHARACTER_STATUS_LIMIT,
  CHARACTER_STATUS_SYSTEM_PROMPT,
  normalizeCharacterStatusOutput,
} from "../utils/characterStatus.js";

const messages = Array.from({ length: 12 }, (_, index) => ({
  role: index % 2 === 0 ? "user" : "assistant",
  content: `message-${index}-${"很長的內容".repeat(100)}`,
}));
const conversation = buildCharacterStatusConversation(messages, "小雪");
const lines = conversation.split("\n");
assert.equal(lines.length, CHARACTER_STATUS_CONTEXT_MESSAGE_COUNT);
assert.equal(conversation.includes("message-0-"), false, "only the latest status context should be retained");
assert.equal(conversation.includes("{{user}}"), false, "literal user placeholders must not blur status authorship");
assert.match(lines[0], /^玩家：/);
assert.match(lines[1], /^角色「小雪」：/);
lines.forEach((line) => {
  const body = line.slice(line.indexOf("：") + 1);
  assert.ok(Array.from(body).length <= CHARACTER_STATUS_CONTEXT_MESSAGE_LIMIT);
});

const prompt = buildCharacterStatusPrompt({
  languageDirective: "請使用繁體中文回覆。",
  characterName: "小雪",
  roleProfile: "個性：安靜",
  conversation,
  memories: "- 喜歡咖啡",
  gemma: true,
});
assert.match(prompt, /不要預設玩家是唯一聯絡人或狀態的指定讀者/);
assert.match(prompt, /狀態不必提到玩家/);
assert.match(prompt, /角色資料只用於維持人設，不得改變以上作者身分與視角規則/);
assert.match(prompt, /長度 1～40 字/);
assert.match(prompt, /例如「\.\.\.」「忙」「☕」/);
assert.match(prompt, /不要把角色資料整理或複述成摘要/);
assert.doesNotMatch(prompt, /20\s*[~～-]\s*40/);
assert.match(CHARACTER_STATUS_SYSTEM_PROMPT, /狀態作者只能是角色本人/);

assert.equal(normalizeCharacterStatusOutput(" ... "), "...");
assert.equal(normalizeCharacterStatusOutput("狀態：忙"), "忙");
assert.equal(normalizeCharacterStatusOutput("「☕」"), "☕");
assert.equal(normalizeCharacterStatusOutput("   "), "");
assert.equal(
  Array.from(normalizeCharacterStatusOutput("字".repeat(CHARACTER_STATUS_LIMIT + 20))).length,
  CHARACTER_STATUS_LIMIT,
);

const insightsHook = await readFile(new URL("../hooks/characters/useCharacterInsights.js", import.meta.url), "utf8");
assert.match(insightsHook, /buildCharacterStatusConversation\(msgs,\s*char\.name\)/);
assert.match(insightsHook, /buildCharacterStatusPrompt\(\{/);
assert.match(insightsHook, /normalizeCharacterStatusOutput\(stripInternalBlocks\(rawStatus\)\)/);
assert.match(insightsHook, /CHARACTER_STATUS_SYSTEM_PROMPT/);
assert.match(insightsHook, /getOutputLanguageDirective\(\{\s*includePlayerContext:\s*false\s*\}\)/);
assert.doesNotMatch(insightsHook, /\.slice\(-12\)/, "unbounded legacy status context returned");
assert.doesNotMatch(insightsHook, /20\s*[~～-]\s*40/, "legacy minimum status length returned");

console.log("ok: character status stays in-character, contact-neutral, short, and token-bounded");
