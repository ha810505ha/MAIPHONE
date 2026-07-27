import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { appendGroupMessages, appendUniqueMessages, removeGroupMessage } from "../utils/messageState.js";
import { extractPseudoVoiceDirectives, normalizePersistedPseudoVoiceMessages } from "../utils/pseudoVoice.js";
import { messagePreviewText } from "../utils/pseudoImage.js";
import { inferCoupleInviteState } from "../utils/coupleInviteState.js";

const original = [{ id: "m1", content: "before request" }];
const userMessage = { id: "m2", content: "request" };
const concurrentMessage = { id: "m3", content: "arrived while AI was waiting" };
const assistantMessage = { id: "m4", content: "AI reply" };

let groups = [{ id: "g1", messages: original, updatedAt: 1 }];
groups = appendGroupMessages(groups, "g1", [userMessage], 2);
groups = appendGroupMessages(groups, "g1", [concurrentMessage], 3);
groups = appendGroupMessages(groups, "g1", [assistantMessage], 4);

assert.deepEqual(groups[0].messages.map((message) => message.id), ["m1", "m2", "m3", "m4"]);
assert.equal(groups[0].updatedAt, 4);

const sameGroups = appendGroupMessages(groups, "g1", [assistantMessage], 5);
assert.equal(sameGroups, groups, "duplicate async replies should not create a new state");

groups = appendGroupMessages(groups, "g1", [{ id: "notice", role: "system_notice" }], 5);
groups = removeGroupMessage(groups, "g1", "notice", 6);
assert.deepEqual(groups[0].messages.map((message) => message.id), ["m1", "m2", "m3", "m4"]);

assert.deepEqual(
  appendUniqueMessages([{ id: "a" }], [{ id: "a" }, { id: "b" }]).map((message) => message.id),
  ["a", "b"],
);

const canonicalVoice = extractPseudoVoiceDirectives("等等\n[[VOICE_MESSAGE]]我很快就到。[[/VOICE_MESSAGE]]");
assert.equal(canonicalVoice.text, "等等");
assert.equal(canonicalVoice.voices.length, 1);
assert.equal(canonicalVoice.voices[0].transcript, "我很快就到。");

// Gemini 等模型可能把 VOICE 誤拼成 COICE；不能讓內部格式原樣出現在聊天氣泡。
const misspelledVoice = extractPseudoVoiceDirectives("[[COICE_MESSAGE]]妳這語氣是在敷衍我嗎？[[/COICE_MESSAGE]]");
assert.equal(misspelledVoice.text, "");
assert.equal(misspelledVoice.voices.length, 1);
assert.equal(misspelledVoice.voices[0].transcript, "妳這語氣是在敷衍我嗎？");

const mixedVoiceTags = extractPseudoVoiceDirectives("[[VOICE MESSAGE]]開頭正確，結尾拼錯。[[/COICE-MESSAGE]]");
assert.equal(mixedVoiceTags.text, "");
assert.equal(mixedVoiceTags.voices[0].transcript, "開頭正確，結尾拼錯。");

const orphanVoiceTag = extractPseudoVoiceDirectives("普通訊息 [[COICE_MESSAGE]] 不完整但不能洩漏標記");
assert.equal(orphanVoiceTag.text, "普通訊息 不完整但不能洩漏標記");
assert.deepEqual(orphanVoiceTag.voices, []);

const recoveredHistory = normalizePersistedPseudoVoiceMessages([
  { id: "old-ai", role: "assistant", content: "先說一句。\n[[COICE_MESSAGE]]再用語音說。[[/COICE_MESSAGE]]", mode: "online", time: 1 },
  { id: "player", role: "user", content: "[[COICE_MESSAGE]]玩家原文不應被改寫", time: 2 },
]);
assert.equal(recoveredHistory.length, 3);
assert.equal(recoveredHistory[0].content, "先說一句。");
assert.equal(recoveredHistory[1].id, "old-ai_recovered_voice_1");
assert.equal(recoveredHistory[1].pseudoVoice.transcript, "再用語音說。");
assert.equal(recoveredHistory[2].content, "[[COICE_MESSAGE]]玩家原文不應被改寫");

const pseudoImagePreview = messagePreviewText(
  { role: "assistant", content: "", pseudoImage: { desc: "不能顯示在列表裡的備註", hue: 20 } },
  { imageText: "小明傳送了圖片", fallback: "目前沒有訊息" },
);
assert.equal(pseudoImagePreview, "小明傳送了圖片");
assert.equal(pseudoImagePreview.includes("備註"), false);
assert.equal(
  messagePreviewText({ role: "user", content: "", image: "base64" }, { imageText: "玩家傳送了圖片" }),
  "玩家傳送了圖片",
);

assert.equal(inferCoupleInviteState("好啊，我願意跟你一起開啟。"), "accepted");
assert.equal(inferCoupleInviteState("那就一起吧。"), "accepted");
assert.equal(inferCoupleInviteState("我不願意接受這份邀請。"), "declined");
assert.equal(inferCoupleInviteState("讓我再想想，晚點回覆你。"), null);
assert.equal(inferCoupleInviteState("我不確定自己是否願意。"), null);
assert.equal(inferCoupleInviteState("今天心情很好。"), null);

// 靜態護欄：群聊 AI hook 不可再把 request 開始時捕獲的整包訊息寫回 state。
const groupHook = await readFile(new URL("../hooks/chat/useGroupChatAI.js", import.meta.url), "utf8");
const stateWriteLines = groupHook.split("\n").filter((line) => line.includes("setGroups")).join("\n");
for (const staleWrite of [
  /messages\s*:\s*working\b/,
  /messages\s*:\s*\[\s*\.\.\.baseMessages\b/,
  /messages\s*:\s*baseMessages\b/,
]) {
  assert.equal(staleWrite.test(stateWriteLines), false, `stale group-message write returned: ${staleWrite}`);
}

const chatListView = await readFile(new URL("../components/chat/ChatListView.jsx", import.meta.url), "utf8");
assert.match(chatListView, /messagePreviewText\(lastMessage/);
assert.equal(/lastMessage\?\.pseudoImage\?\.desc/.test(chatListView), false, "chat list must never reveal mock-image notes");

console.log("ok: async message state and model directive parsing stay safe");
