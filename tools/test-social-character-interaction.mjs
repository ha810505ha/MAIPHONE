import assert from "node:assert/strict";
import fs from "node:fs";
import { DEFAULT_NOTIFICATION_SETTINGS } from "../constants/notifications.js";
import {
  buildBadgeCounts,
  collectNotifications,
  collectSocialActivities,
  selectLockNotifications,
} from "../services/notifications/notificationSources.js";
import {
  CHARACTER_INTERACTION_MAX_DELAY_MS,
  CHARACTER_INTERACTION_MAX_PARTICIPANTS,
  CHARACTER_INTERACTION_MIN_DELAY_MS,
  SOCIAL_COMMENT_INPUT_TOKEN_LIMIT,
  SOCIAL_COMMENT_OUTPUT_TOKEN_LIMIT,
  SOCIAL_POST_INPUT_TOKEN_LIMIT,
  SOCIAL_POST_OUTPUT_TOKEN_LIMIT,
  deletePlayerSocialComment,
  editPlayerSocialComment,
  estimateSocialInputTokens,
  fitSocialInputTokenLimit,
  getSocialAutoPostDailyLimit,
  normalizeCharacterInteractionChance,
  rollCharacterInteractionCount,
  rollCharacterInteractionDelay,
  selectCharacterInteractionParticipants,
  shouldStartCharacterInteraction,
  withSocialOutputTokenLimit,
} from "../services/social/characterInteraction.js";

assert.equal(normalizeCharacterInteractionChance(undefined), 50);
assert.equal(normalizeCharacterInteractionChance(-20), 0);
assert.equal(normalizeCharacterInteractionChance(140), 100);
assert.equal(shouldStartCharacterInteraction(25, () => 0.24), true);
assert.equal(shouldStartCharacterInteraction(25, () => 0.25), false);
assert.equal(getSocialAutoPostDailyLimit("occasional"), 1);
assert.equal(getSocialAutoPostDailyLimit("normal"), 3);
assert.equal(getSocialAutoPostDailyLimit("active"), 5);
assert.equal(SOCIAL_POST_INPUT_TOKEN_LIMIT, 4000);
assert.equal(SOCIAL_COMMENT_INPUT_TOKEN_LIMIT, 3000);
assert.equal(SOCIAL_POST_OUTPUT_TOKEN_LIMIT, 1000);
assert.equal(SOCIAL_COMMENT_OUTPUT_TOKEN_LIMIT, 800);
assert.equal(
  withSocialOutputTokenLimit({ maxTokens: 4000 }, SOCIAL_POST_OUTPUT_TOKEN_LIMIT).maxTokens,
  1000,
);
assert.equal(
  withSocialOutputTokenLimit({ maxTokens: 320 }, SOCIAL_COMMENT_OUTPUT_TOKEN_LIMIT).maxTokens,
  320,
);
assert.equal(
  withSocialOutputTokenLimit({}, SOCIAL_COMMENT_OUTPUT_TOKEN_LIMIT).maxTokens,
  800,
);
const smallSocialInput = fitSocialInputTokenLimit({
  messages: [{ role: "user", content: "短提示" }],
  systemPrompt: "短人設",
  maxInputTokens: SOCIAL_COMMENT_INPUT_TOKEN_LIMIT,
});
assert.equal(smallSocialInput.truncated, false);
assert.equal(smallSocialInput.messages[0].content, "短提示");
const largeSocialInput = fitSocialInputTokenLimit({
  messages: [{
    role: "user",
    content: `PROMPT_START${"近期對話".repeat(3000)}PROMPT_END`,
  }],
  systemPrompt: `SYSTEM_START${"核心人設".repeat(300)}SYSTEM_END`,
  maxInputTokens: SOCIAL_COMMENT_INPUT_TOKEN_LIMIT,
});
assert.equal(largeSocialInput.truncated, true);
assert.ok(largeSocialInput.estimatedTokens <= SOCIAL_COMMENT_INPUT_TOKEN_LIMIT);
assert.ok(
  estimateSocialInputTokens(
    largeSocialInput.messages,
    largeSocialInput.systemPrompt,
  ) <= SOCIAL_COMMENT_INPUT_TOKEN_LIMIT,
);
assert.match(largeSocialInput.messages[0].content, /^PROMPT_START/);
assert.match(largeSocialInput.messages[0].content, /PROMPT_END$/);

const playerComment = {
  id: "player-comment",
  role: "user",
  content: "原本的留言",
  time: 100,
};
const characterComment = {
  id: "character-comment",
  role: "assistant",
  charId: "c1",
  content: "角色留言",
  time: 110,
};
const editedComments = editPlayerSocialComment(
  [playerComment, characterComment],
  playerComment.id,
  "修改後的留言",
  200,
);
assert.equal(editedComments[0].content, "修改後的留言");
assert.equal(editedComments[0].editedAt, 200);
assert.equal(editedComments[1], characterComment);
assert.equal(
  editPlayerSocialComment(editedComments, characterComment.id, "不應修改"),
  editedComments,
);
assert.deepEqual(
  deletePlayerSocialComment([playerComment, characterComment], playerComment.id, 300),
  [characterComment],
);
const characterReply = {
  id: "character-reply",
  role: "assistant",
  charId: "c1",
  parentId: playerComment.id,
  content: "回覆玩家",
};
const tombstonedComments = deletePlayerSocialComment(
  [playerComment, characterReply],
  playerComment.id,
  400,
);
assert.equal(tombstonedComments.length, 2);
assert.equal(tombstonedComments[0].deleted, true);
assert.equal(tombstonedComments[0].deletedAt, 400);
assert.equal(tombstonedComments[0].content, "");
assert.equal(tombstonedComments[1], characterReply);
const protectedCharacterComments = [characterComment];
assert.equal(
  deletePlayerSocialComment(
    protectedCharacterComments,
    characterComment.id,
  ),
  protectedCharacterComments,
);

assert.equal(rollCharacterInteractionCount(20, () => 0), 1);
assert.equal(
  rollCharacterInteractionCount(20, () => 0.999),
  CHARACTER_INTERACTION_MAX_PARTICIPANTS,
);
assert.equal(rollCharacterInteractionCount(2, () => 0.999), 2);
assert.equal(
  rollCharacterInteractionDelay({ random: () => 0 }),
  CHARACTER_INTERACTION_MIN_DELAY_MS,
);
assert.equal(
  rollCharacterInteractionDelay({ random: () => 1 }),
  CHARACTER_INTERACTION_MAX_DELAY_MS,
);

const characters = Array.from({ length: 20 }, (_, index) => ({
  id: `c${index + 1}`,
  name: `角色 ${index + 1}`,
}));
const maximumParticipants = selectCharacterInteractionParticipants({
  characters,
  authorId: "c1",
  recentPosts: [],
  random: () => 0.999,
});
assert.equal(maximumParticipants.length, 5);
assert.equal(new Set(maximumParticipants.map((character) => character.id)).size, 5);

const recentCommentPost = {
  id: "recent",
  authorType: "character",
  charId: "c1",
  time: Date.now() - 1000,
  comments: [{
    id: "comment",
    role: "assistant",
    charId: "c2",
    interactionSource: "character-to-character",
  }],
};
const avoidsRecentCommenter = selectCharacterInteractionParticipants({
  characters: characters.slice(0, 4),
  authorId: "c3",
  recentPosts: [recentCommentPost],
  random: () => 0,
  scoreCharacter: (character) => (character.id === "c2" ? 100 : 0),
});
assert.equal(avoidsRecentCommenter.some((character) => character.id === "c2"), false);

const avoidsRecentPair = selectCharacterInteractionParticipants({
  characters: characters.slice(0, 3),
  authorId: "c2",
  recentPosts: [recentCommentPost],
  random: () => 0,
  scoreCharacter: (character) => (character.id === "c1" ? 100 : character.id === "c3" ? 10 : 0),
});
assert.equal(avoidsRecentPair.some((character) => character.id === "c1"), false);
assert.equal(avoidsRecentPair[0]?.id, "c3");

const notificationNow = 100_000;
const socialNotificationPosts = [{
  id: "player-post",
  authorType: "player",
  time: 10_000,
  content: "玩家貼文",
  comments: [
    { id: "visible", role: "assistant", charId: "c1", charName: "角色 1", content: "已顯示留言", time: 90_000 },
    { id: "player-comment", role: "user", content: "玩家留言", time: 95_000 },
    { id: "future", role: "assistant", charId: "c2", charName: "角色 2", content: "延遲留言", time: 120_000 },
  ],
}];
const visibleSocialNotifications = collectNotifications({
  characters,
  posts: socialNotificationPosts,
  socialSeenAt: 80_000,
  socialNow: notificationNow,
});
assert.equal(visibleSocialNotifications.length, 1);
assert.equal(visibleSocialNotifications[0].appId, "social");
assert.equal(visibleSocialNotifications[0].count, 1);
assert.equal(visibleSocialNotifications[0].body, "已顯示留言");
assert.equal(
  buildBadgeCounts(visibleSocialNotifications, DEFAULT_NOTIFICATION_SETTINGS).social,
  1,
);
assert.equal(selectLockNotifications(
  visibleSocialNotifications,
  DEFAULT_NOTIFICATION_SETTINGS,
).length, 0);
const visibleSocialActivities = collectSocialActivities({
  characters,
  posts: socialNotificationPosts,
  socialSeenAt: 80_000,
  socialNow: notificationNow,
});
assert.equal(visibleSocialActivities.length, 1);
assert.equal(visibleSocialActivities[0].kind, "comment");
assert.equal(visibleSocialActivities[0].actorName, "角色 1");
assert.equal(visibleSocialActivities[0].targetKind, "post");
assert.equal(visibleSocialActivities[0].isUnread, true);
const futureSocialNotifications = collectNotifications({
  characters,
  posts: socialNotificationPosts,
  socialSeenAt: 80_000,
  socialNow: 130_000,
});
assert.equal(futureSocialNotifications[0].count, 2);
assert.equal(futureSocialNotifications[0].body, "延遲留言");

const hookSource = fs.readFileSync(
  new URL("../hooks/social/useSocialFeed.js", import.meta.url),
  "utf8",
);
const socialAppSource = fs.readFileSync(
  new URL("../components/apps/SocialApp.jsx", import.meta.url),
  "utf8",
);
const socialHelperSource = fs.readFileSync(
  new URL("../services/social/socialFeedHelpers.js", import.meta.url),
  "utf8",
);
const mainSource = fs.readFileSync(
  new URL("../MaliPhone.jsx", import.meta.url),
  "utf8",
);
assert.match(hookSource, /characterInteractionsEnabled/);
assert.match(hookSource, /interactionKind: isSelfComment \? "self-comment" : "comment"/);
assert.match(hookSource, /interactionKind: "author-reply"/);
assert.match(hookSource, /generationSource === "auto"/);
assert.match(hookSource, /正在準備貼文/);
assert.match(hookSource, /submitPlayerPost[\s\S]*generatePlayerPostReplies/);
assert.match(socialAppSource, /getVisibleComments/);
assert.match(socialAppSource, /characterInteractionChance/);
assert.match(socialAppSource, /characterPostRefreshing/);
assert.match(socialAppSource, /frequency: event\.target\.value/);
assert.match(socialAppSource, /mp-social-notification-bell/);
assert.match(socialAppSource, /markSocialReadThrough/);
assert.match(socialAppSource, /c\.role === "assistant" && c\.charId/);
assert.match(socialAppSource, /editPlayerComment\(p\.id, c\.id/);
assert.match(socialAppSource, /deletePlayerComment\(p\.id, c\.id\)/);
assert.match(socialAppSource, /c\.deleted/);
assert.match(socialAppSource, /c\.editedAt/);
assert.match(hookSource, /depth: target \? parentDepth \+ 1 : 1/);
assert.match(hookSource, /depth: userComment\.depth \+ 1/);
assert.match(hookSource, /liveUserComment\.deleted/);
assert.match(hookSource, /liveUserComment\.content !== text/);
assert.doesNotMatch(hookSource, /userComment\.depth >= 3/);
assert.doesNotMatch(hookSource, /buildSystemPrompt/);
assert.doesNotMatch(hookSource, /getPlayerContextBlock/);
assert.match(hookSource, /socialPostApiConfig/);
assert.match(hookSource, /socialCommentApiConfig/);
assert.match(hookSource, /SOCIAL_POST_INPUT_TOKEN_LIMIT/);
assert.match(hookSource, /SOCIAL_COMMENT_INPUT_TOKEN_LIMIT/);
assert.equal((hookSource.match(/callSocialAI\(\[\{/g) || []).length, 5);
assert.doesNotMatch(hookSource, /\}\], apiConfig, (?:sysP|buildCharacterInteractionSystemPrompt)/);
assert.match(hookSource, /mode: "社群貼文",\s+includePlayerRelationship: false/);
assert.match(hookSource, /mode: "回覆玩家貼文",\s+includePlayerRelationship: true/);
assert.match(hookSource, /mode: "回覆玩家留言",\s+includePlayerRelationship: true/);
assert.match(socialHelperSource, /const buildSocialSystemPrompt/);
assert.match(socialHelperSource, /\.slice\(-8\)/);
assert.match(socialHelperSource, /messagePlainText\(m, "\[圖片\]"\), 120/);
assert.equal((socialHelperSource.match(/getOutputLanguageDirective\(/g) || []).length, 1);
assert.match(socialHelperSource, /getOutputLanguageDirective\(\{ includePlayerContext: includePlayerRelationship \}\)/);
const socialSystemPromptSource = socialHelperSource.slice(
  socialHelperSource.indexOf("const buildSocialSystemPrompt"),
  socialHelperSource.indexOf("const buildSocialPostPrompt"),
);
assert.match(socialSystemPromptSource, /relationshipToUser/);
assert.doesNotMatch(socialSystemPromptSource, /messageExamples/);
assert.doesNotMatch(socialSystemPromptSource, /scenario/);
const playerPostReplyPromptSource = socialHelperSource.slice(
  socialHelperSource.indexOf("const buildPlayerPostReplyPrompt"),
  socialHelperSource.indexOf("\n\n  return {"),
);
assert.doesNotMatch(playerPostReplyPromptSource, /buildRecentChatForSocialPost/);
assert.doesNotMatch(playerPostReplyPromptSource, /memories/);
assert.doesNotMatch(playerPostReplyPromptSource, /近期聊天參考|記憶參考/);
assert.match(mainSource, /socialNow: socialTick/);
assert.match(mainSource, /post\.comments \|\| \[\]/);
assert.match(mainSource, /socialActivities: notificationCenter\.socialActivities/);

console.log("social character interaction: ok");
