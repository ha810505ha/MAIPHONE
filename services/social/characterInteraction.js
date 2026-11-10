export const CHARACTER_INTERACTION_DEFAULT_CHANCE = 50;
export const CHARACTER_INTERACTION_MAX_PARTICIPANTS = 5;
export const CHARACTER_INTERACTION_RECENT_POST_COUNT = 3;
export const CHARACTER_INTERACTION_PAIR_COOLDOWN_MS = 6 * 60 * 60 * 1000;
export const CHARACTER_INTERACTION_MIN_DELAY_MS = 30 * 1000;
export const CHARACTER_INTERACTION_MAX_DELAY_MS = 5 * 60 * 1000;
export const CHARACTER_INTERACTION_REPLY_MAX_DELAY_MS = 3 * 60 * 1000;
export const SOCIAL_POST_INPUT_TOKEN_LIMIT = 4000;
export const SOCIAL_COMMENT_INPUT_TOKEN_LIMIT = 3000;
export const SOCIAL_POST_OUTPUT_TOKEN_LIMIT = 1000;
export const SOCIAL_COMMENT_OUTPUT_TOKEN_LIMIT = 800;

// Some models turn a requested length (for example, 20~50 characters) into a
// parenthetical status note. This is metadata, not part of a social post.
export function stripSocialPostCountMetadata(value) {
  return String(value || "")
    .replace(/\s*[（(]\s*\d{1,4}\s*(?:characters?|chars?|字元|字符|字數)\s*[）)]/giu, "")
    .replace(/\s+\d{1,4}\s*(?:characters?|chars?|字元|字符|字數)\.?\s*$/iu, "")
    .trim();
}

const SOCIAL_INPUT_SYSTEM_OVERHEAD_TOKENS = 8;
const SOCIAL_INPUT_MESSAGE_OVERHEAD_TOKENS = 8;

export function estimateSocialTextTokens(value) {
  const text = String(value || "");
  let estimate = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0) || 0;
    if (/\s/u.test(character)) {
      estimate += 0.25;
    } else if (codePoint <= 0x7f) {
      estimate += 0.25;
    } else {
      estimate += 1.5;
    }
  }
  return Math.ceil(estimate);
}

export function estimateSocialInputTokens(messages, systemPrompt = "") {
  const list = Array.isArray(messages) ? messages : [];
  return SOCIAL_INPUT_SYSTEM_OVERHEAD_TOKENS
    + estimateSocialTextTokens(systemPrompt)
    + list.reduce(
      (sum, message) => (
        sum
        + SOCIAL_INPUT_MESSAGE_OVERHEAD_TOKENS
        + estimateSocialTextTokens(message?.role)
        + estimateSocialTextTokens(message?.content)
      ),
      0,
    );
}

function cropSocialTextToTokenBudget(value, tokenBudget) {
  const text = String(value || "");
  const safeBudget = Math.max(0, Math.floor(Number(tokenBudget) || 0));
  if (estimateSocialTextTokens(text) <= safeBudget) return text;
  if (!safeBudget) return "";

  const characters = Array.from(text);
  const buildCandidate = (characterCount) => {
    if (characterCount >= characters.length) return text;
    const marker = "\n…\n";
    const keptCount = Math.max(0, characterCount - marker.length);
    const headCount = Math.ceil(keptCount * 0.6);
    const tailCount = Math.max(0, keptCount - headCount);
    return [
      characters.slice(0, headCount).join(""),
      marker,
      tailCount ? characters.slice(-tailCount).join("") : "",
    ].join("");
  };

  let low = 0;
  let high = characters.length;
  let best = "";
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = buildCandidate(middle);
    if (estimateSocialTextTokens(candidate) <= safeBudget) {
      best = candidate;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return best;
}

export function fitSocialInputTokenLimit({
  messages,
  systemPrompt,
  maxInputTokens,
}) {
  const safeLimit = Math.max(1, Math.floor(Number(maxInputTokens) || 1));
  const nextMessages = (Array.isArray(messages) ? messages : []).map((message) => ({
    ...message,
    content: String(message?.content || ""),
  }));
  let nextSystemPrompt = String(systemPrompt || "");
  const originalEstimate = estimateSocialInputTokens(nextMessages, nextSystemPrompt);
  if (originalEstimate <= safeLimit) {
    return {
      messages: nextMessages,
      systemPrompt: nextSystemPrompt,
      estimatedTokens: originalEstimate,
      truncated: false,
    };
  }

  const messageOrder = nextMessages
    .map((message, index) => ({
      index,
      tokens: estimateSocialTextTokens(message.content),
    }))
    .sort((first, second) => second.tokens - first.tokens);

  for (const item of messageOrder) {
    const currentEstimate = estimateSocialInputTokens(nextMessages, nextSystemPrompt);
    if (currentEstimate <= safeLimit) break;
    const currentTokens = estimateSocialTextTokens(nextMessages[item.index].content);
    const excess = currentEstimate - safeLimit;
    const targetTokens = Math.max(96, currentTokens - excess);
    nextMessages[item.index].content = cropSocialTextToTokenBudget(
      nextMessages[item.index].content,
      targetTokens,
    );
  }

  let currentEstimate = estimateSocialInputTokens(nextMessages, nextSystemPrompt);
  if (currentEstimate > safeLimit) {
    const systemTokens = estimateSocialTextTokens(nextSystemPrompt);
    nextSystemPrompt = cropSocialTextToTokenBudget(
      nextSystemPrompt,
      Math.max(192, systemTokens - (currentEstimate - safeLimit)),
    );
  }

  currentEstimate = estimateSocialInputTokens(nextMessages, nextSystemPrompt);
  if (currentEstimate > safeLimit) {
    for (const message of nextMessages) {
      if (currentEstimate <= safeLimit) break;
      const contentTokens = estimateSocialTextTokens(message.content);
      message.content = cropSocialTextToTokenBudget(
        message.content,
        Math.max(8, contentTokens - (currentEstimate - safeLimit)),
      );
      currentEstimate = estimateSocialInputTokens(nextMessages, nextSystemPrompt);
    }
  }
  if (currentEstimate > safeLimit) {
    const systemTokens = estimateSocialTextTokens(nextSystemPrompt);
    nextSystemPrompt = cropSocialTextToTokenBudget(
      nextSystemPrompt,
      Math.max(0, systemTokens - (currentEstimate - safeLimit)),
    );
    currentEstimate = estimateSocialInputTokens(nextMessages, nextSystemPrompt);
  }

  return {
    messages: nextMessages,
    systemPrompt: nextSystemPrompt,
    estimatedTokens: currentEstimate,
    truncated: true,
  };
}

export function withSocialOutputTokenLimit(apiConfig, socialLimit) {
  const configuredLimit = Number(apiConfig?.maxTokens);
  const globalLimit = Number.isFinite(configuredLimit) && configuredLimit > 0
    ? Math.floor(configuredLimit)
    : 4000;
  const requestedLimit = Number(socialLimit);
  const safeSocialLimit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.floor(requestedLimit)
    : globalLimit;
  return {
    ...(apiConfig || {}),
    maxTokens: Math.min(globalLimit, safeSocialLimit),
  };
}

const isPlayerOwnedComment = (comment) => (
  comment?.role === "user"
  && (comment?.charId === null || comment?.charId === undefined)
);

export function editPlayerSocialComment(
  comments,
  commentId,
  content,
  editedAt = Date.now(),
) {
  const list = Array.isArray(comments) ? comments : [];
  const nextContent = String(content || "").trim();
  if (!nextContent) return list;
  const targetId = String(commentId ?? "");
  let changed = false;
  const next = list.map((comment) => {
    if (
      String(comment?.id ?? "") !== targetId
      || !isPlayerOwnedComment(comment)
      || comment?.deleted
    ) return comment;
    changed = true;
    return {
      ...comment,
      content: nextContent,
      editedAt,
    };
  });
  return changed ? next : list;
}

export function deletePlayerSocialComment(
  comments,
  commentId,
  deletedAt = Date.now(),
) {
  const list = Array.isArray(comments) ? comments : [];
  const targetId = String(commentId ?? "");
  const target = list.find((comment) => String(comment?.id ?? "") === targetId);
  if (!isPlayerOwnedComment(target) || target?.deleted) return list;
  const hasReplies = list.some((comment) => String(comment?.parentId ?? "") === targetId);
  if (!hasReplies) {
    return list.filter((comment) => String(comment?.id ?? "") !== targetId);
  }
  return list.map((comment) => (
    String(comment?.id ?? "") === targetId
      ? {
          ...comment,
          content: "",
          replyToName: "",
          deleted: true,
          deletedAt,
        }
      : comment
  ));
}

const getCharacterId = (character) => String(character?.id ?? "");
const getPostAuthorId = (post) => String(post?.charId ?? "");
const getCommentCharacterId = (comment) => String(comment?.charId ?? "");
const isCharacterPost = (post) => (
  post?.authorType === "character" || (!post?.authorType && post?.charId)
);
const isCharacterInteractionComment = (comment) => (
  comment?.role === "assistant"
  && comment?.charId !== null
  && comment?.charId !== undefined
  && comment?.interactionSource === "character-to-character"
);
const pairKey = (firstId, secondId) => (
  [String(firstId), String(secondId)].sort().join(":")
);

export function normalizeCharacterInteractionChance(value) {
  const chance = Number(value);
  if (!Number.isFinite(chance)) return CHARACTER_INTERACTION_DEFAULT_CHANCE;
  return Math.max(0, Math.min(100, Math.round(chance)));
}

export function getSocialAutoPostDailyLimit(frequency) {
  if (frequency === "occasional") return 1;
  if (frequency === "active") return 5;
  return 3;
}

export function shouldStartCharacterInteraction(chance, random = Math.random) {
  return random() < normalizeCharacterInteractionChance(chance) / 100;
}

export function rollCharacterInteractionCount(candidateCount, random = Math.random) {
  const maximum = Math.min(
    CHARACTER_INTERACTION_MAX_PARTICIPANTS,
    Math.max(0, Math.floor(Number(candidateCount) || 0)),
  );
  if (!maximum) return 0;
  const roll = random();
  const weightedCount = roll < 0.5 ? 1
    : roll < 0.78 ? 2
      : roll < 0.92 ? 3
        : roll < 0.98 ? 4
          : 5;
  return Math.min(maximum, weightedCount);
}

export function rollCharacterInteractionDelay({
  random = Math.random,
  minimum = CHARACTER_INTERACTION_MIN_DELAY_MS,
  maximum = CHARACTER_INTERACTION_MAX_DELAY_MS,
} = {}) {
  const min = Math.max(0, Number(minimum) || 0);
  const max = Math.max(min, Number(maximum) || min);
  return Math.round(min + random() * (max - min));
}

export function selectCharacterInteractionParticipants({
  characters,
  authorId,
  recentPosts,
  now = Date.now(),
  random = Math.random,
  scoreCharacter = () => 0,
  maxParticipants = CHARACTER_INTERACTION_MAX_PARTICIPANTS,
}) {
  const authorKey = String(authorId ?? "");
  const available = (Array.isArray(characters) ? characters : [])
    .filter((character) => getCharacterId(character));
  if (!available.length || !authorKey) return [];

  const characterPosts = (Array.isArray(recentPosts) ? recentPosts : [])
    .filter(isCharacterPost);
  const recentCommenters = new Set();
  characterPosts
    .slice(0, CHARACTER_INTERACTION_RECENT_POST_COUNT)
    .forEach((post) => {
      (post.comments || [])
        .filter(isCharacterInteractionComment)
        .forEach((comment) => recentCommenters.add(getCommentCharacterId(comment)));
    });

  const cooldownPairs = new Set();
  characterPosts
    .filter((post) => now - (Number(post?.time) || 0) < CHARACTER_INTERACTION_PAIR_COOLDOWN_MS)
    .forEach((post) => {
      const postAuthorId = getPostAuthorId(post);
      if (!postAuthorId) return;
      (post.comments || [])
        .filter(isCharacterInteractionComment)
        .forEach((comment) => {
          const commenterId = getCommentCharacterId(comment);
          if (commenterId && commenterId !== postAuthorId) {
            cooldownPairs.add(pairKey(postAuthorId, commenterId));
          }
        });
    });

  const pairSafe = available.filter((character) => {
    const characterId = getCharacterId(character);
    return characterId === authorKey || !cooldownPairs.has(pairKey(authorKey, characterId));
  });
  const notRecentlySeen = pairSafe.filter((character) => (
    !recentCommenters.has(getCharacterId(character))
  ));
  const pool = notRecentlySeen.length ? notRecentlySeen : pairSafe;
  const participantLimit = Math.min(
    CHARACTER_INTERACTION_MAX_PARTICIPANTS,
    Math.max(0, Math.floor(Number(maxParticipants) || 0)),
  );
  const count = Math.min(
    participantLimit,
    rollCharacterInteractionCount(pool.length, random),
  );

  return pool
    .map((character) => ({
      character,
      score: Number(scoreCharacter(character)) || 0,
      tieBreaker: random(),
    }))
    .sort((first, second) => (
      second.score - first.score || second.tieBreaker - first.tieBreaker
    ))
    .slice(0, count)
    .map(({ character }) => character);
}
