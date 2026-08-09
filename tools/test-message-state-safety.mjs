import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { appendGroupMessages, appendUniqueMessages, removeGroupMessage } from "../utils/messageState.js";
import { estimatePseudoVoiceDuration, extractPseudoVoiceDirectives, normalizePersistedPseudoVoiceMessages } from "../utils/pseudoVoice.js";
import { messagePreviewText } from "../utils/pseudoImage.js";
import { inferCoupleInviteState } from "../utils/coupleInviteState.js";
import { reviewCoupleInviteReplies } from "../utils/coupleInviteReview.js";
import {
  selectDirectChatThoughts,
  selectMessageRangeIds,
  selectVisibleChatMessages,
} from "../utils/chatViewSelectors.js";
import {
  ONLINE_CHAT_TEXT_LIMIT,
  REALITY_CHAT_TEXT_LIMIT,
  displayWalletText,
  estimateTokens,
  extractTransferDirective,
  extractTransferResponseDirective,
  getChatTextLimit,
  getLastCommittedChatMode,
  getMessageMode,
  getSelectedChatMode,
  isChatMode,
  isGemmaModel,
  normalizeAssistantReply,
  normalizeRealityReply,
  parseShareEventNotice,
  splitAssistantBubbles,
  stripInternalBlocks,
  stripModeLabel,
  stripUserPlaceholder,
} from "../utils/chatMessageUtils.js";
import { sortChatThreads, sortGroupChats } from "../utils/chatSorting.js";
import {
  appendAssistantSwipeGroup,
  findTailAssistantSwipeAnchor,
  replaceAssistantSwipeGroup,
} from "../utils/assistantSwipeGroups.js";

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

const selectorMessages = Array.from({ length: 60 }, (_, index) => ({
  id: `selector-${index}`,
  role: index > 56 ? "assistant" : "user",
  replyGroupId: index === 57 || index === 58 ? "reply-group" : undefined,
  replyGroupIndex: index === 57 ? 0 : index === 58 ? 1 : undefined,
  replyGroupSize: index === 57 || index === 58 ? 2 : undefined,
  innerThought: index === 57
    ? { content: "older", generatedAt: 1 }
    : index === 59
      ? { content: "newer", generatedAt: 2 }
      : undefined,
}));
const visibleSelector = selectVisibleChatMessages(selectorMessages, 50);
assert.equal(visibleSelector.visibleMessages.length, 50);
assert.equal(visibleSelector.hasEarlier, true);
assert.equal(visibleSelector.nextVisibleCount, 60);
assert.deepEqual(
  selectMessageRangeIds(selectorMessages, "selector-59", "selector-57"),
  ["selector-57", "selector-58", "selector-59"],
);
const thoughtSelector = selectDirectChatThoughts(selectorMessages, 0, false);
assert.deepEqual(thoughtSelector.records.map((message) => message.id), ["selector-59", "selector-57"]);
assert.equal(thoughtSelector.canRender(selectorMessages[57]), false);
assert.equal(thoughtSelector.canRender(selectorMessages[58]), false);
assert.equal(thoughtSelector.canRender(selectorMessages[59]), true);

assert.equal(estimateTokens("你好ab"), 3);
assert.equal(isChatMode("reality"), true);
assert.equal(isChatMode("invalid"), false);
assert.equal(getMessageMode({ mode: "reality" }), "reality");
assert.equal(getMessageMode({ mode: "invalid" }), "online");
const modeHistory = {
  c1: [
    { role: "user", mode: "reality" },
    { role: "mode_transition", toMode: "online" },
  ],
  c2: [{ role: "mode_transition", toMode: "invalid" }],
};
assert.equal(getLastCommittedChatMode(modeHistory, "c1"), "online");
assert.equal(getLastCommittedChatMode(modeHistory, "c2"), "online");
assert.equal(getSelectedChatMode({ c1: "reality" }, modeHistory, "c1"), "reality");
assert.equal(getChatTextLimit("online"), ONLINE_CHAT_TEXT_LIMIT);
assert.equal(getChatTextLimit("reality"), REALITY_CHAT_TEXT_LIMIT);

assert.equal(stripModeLabel("【目前互動模式：線上聊天】 早安"), "早安");
assert.equal(stripInternalBlocks("前面 <think>不顯示</think> 後面"), "前面 後面");
assert.equal(stripUserPlaceholder("嗨， {{USER}} ！", "Mali"), "嗨， Mali！");
assert.equal(displayWalletText("玩家 轉帳給 {{user}}", "Mali"), "Mali 轉帳給 Mali");
assert.equal(normalizeAssistantReply("【線上聊天】 *揮手* 嗨"), "嗨");
assert.equal(normalizeRealityReply("第一行\\n第二行"), "第一行\n第二行");
assert.deepEqual(
  splitAssistantBubbles("1\n2\n3\n4\n5\n6\n7"),
  ["1", "2", "3", "4", "5", "6\n7"],
);
assert.equal(isGemmaModel("gemma-3-27b"), true);
assert.equal(isGemmaModel("gpt-5"), false);

const groupedReply = [
  { id: "swipe-user", role: "user", content: "hello" },
  { id: "swipe-a1", role: "assistant", replyGroupId: "swipe-group", replyGroupIndex: 0, replyGroupSize: 2, content: "first bubble" },
  { id: "swipe-a2", role: "assistant", replyGroupId: "swipe-group", replyGroupIndex: 1, replyGroupSize: 2, content: "second bubble" },
  { id: "swipe-notice", role: "system_notice", content: "metadata notice" },
];
assert.equal(findTailAssistantSwipeAnchor(groupedReply), "swipe-a2", "a trailing notice must not hide the response swipe control");
const refreshedGroupedReply = appendAssistantSwipeGroup(groupedReply, "swipe-a2", ["new first", "new second", "new third"], 99, () => "swipe-new");
assert.deepEqual(refreshedGroupedReply.filter((message) => message.replyGroupId === "swipe-group").map((message) => message.content), ["new first", "new second", "new third"]);
assert.equal(refreshedGroupedReply.find((message) => message.id === "swipe-a2")?.swipes?.length, 2);
const restoredGroupedReply = replaceAssistantSwipeGroup(refreshedGroupedReply, "swipe-a2", 0, () => "swipe-new");
assert.deepEqual(restoredGroupedReply.filter((message) => message.replyGroupId === "swipe-group").map((message) => message.content), ["first bubble", "second bubble"]);
assert.equal(findTailAssistantSwipeAnchor([...restoredGroupedReply, { id: "swipe-next-user", role: "user", content: "continue" }]), null, "continuing the story must hide old swipe choices");

const transferDirective = extractTransferDirective("給你 [[TRANSFER:amount=120;note=午餐]]");
assert.equal(transferDirective.text, "給你");
assert.deepEqual(transferDirective.transfer, { amount: 120, note: "午餐" });
const responseDirective = extractTransferResponseDirective(
  "收到 [[TRANSFER_RESPONSE:id=tx-1;decision=RETURN]]",
);
assert.equal(responseDirective.text, "收到");
assert.deepEqual(responseDirective.response, { transferId: "tx-1", decision: "return" });

assert.deepEqual(
  parseShareEventNotice("[APP_SHARE_EVENT]\napp=social\npostId=p1\n分享內容"),
  { meta: { app: "social", postId: "p1" }, body: "分享內容" },
);
assert.equal(parseShareEventNotice("一般訊息"), null);

const unsortedThreads = [
  { id: "older", name: "Older" },
  { id: "new", name: "New", chatOpenedAt: 20 },
  { id: "pinned", name: "Pinned", pinned: true },
  { id: "recent", name: "Recent" },
];
const sortedThreads = sortChatThreads(unsortedThreads, {
  older: [{ time: 1 }],
  recent: [{ time: 10 }],
});
assert.deepEqual(sortedThreads.map((character) => character.id), ["pinned", "new", "recent", "older"]);
assert.deepEqual(unsortedThreads.map((character) => character.id), ["older", "new", "pinned", "recent"]);
assert.deepEqual(
  sortGroupChats([
    { id: "unranked", createdAt: 100 },
    { id: "second", displayOrder: 2 },
    { id: "pinned", pinned: true },
    { id: "first", displayOrder: 1 },
  ]).map((group) => group.id),
  ["pinned", "first", "second", "unranked"],
);

const canonicalVoice = extractPseudoVoiceDirectives("等等\n[[VOICE_MESSAGE]]我很快就到。[[/VOICE_MESSAGE]]");
assert.equal(canonicalVoice.text, "等等");
assert.equal(canonicalVoice.voices.length, 1);
assert.equal(canonicalVoice.voices[0].transcript, "我很快就到。");
assert.equal(estimatePseudoVoiceDuration("a".repeat(100)), 8);

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

const correctedVoiceDuration = normalizePersistedPseudoVoiceMessages([
  { id: "old-player-voice", role: "user", content: "", pseudoVoice: { transcript: "a".repeat(100), duration: 2 } },
]);
assert.equal(correctedVoiceDuration[0].pseudoVoice.duration, 8);

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

const inviteTime = 1720000000000;
const reviewedInvite = reviewCoupleInviteReplies([
  { id: "older", role: "assistant", content: "我願意。", time: inviteTime - 1 },
  { id: `couple_invite_${inviteTime}`, role: "system_notice", content: "情侶空間邀請", time: inviteTime },
  { id: "u1", role: "user", content: "你覺得呢？" },
  { id: "a1", role: "assistant", replyGroupId: "r1", content: "讓我想想。" },
  { id: "u2", role: "user", content: "不用急。" },
  { id: "a2-1", role: "assistant", replyGroupId: "r2", content: "好啊，" },
  { id: "a2-2", role: "assistant", replyGroupId: "r2", content: "那我們就一起吧。" },
  { id: "u3", role: "user", content: "太好了。" },
  { id: "a3", role: "assistant", content: "今天天氣很好。" },
  { id: "u4", role: "user", content: "第四輪不應納入。" },
  { id: "a4", role: "assistant", content: "我不願意。" },
], inviteTime);
assert.equal(reviewedInvite.rounds.length, 3);
assert.equal(reviewedInvite.decision, "accepted");
assert.equal(reviewedInvite.matchedRound, 2);
assert.match(reviewedInvite.matchedText, /一起吧/);

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
