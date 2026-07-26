const safeTimestamp = (value, fallback = null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const normalizeCharacterBlockStates = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([characterId, raw]) => {
    const history = Array.isArray(raw?.history) ? raw.history.map((entry) => entry?.direction === "character_to_player" ? ({
      direction: "character_to_player",
      blocked: entry?.blocked === true,
      at: safeTimestamp(entry?.at),
    }) : ({
      direction: "player_to_character",
      blockedAt: safeTimestamp(entry?.blockedAt),
      unblockedAt: safeTimestamp(entry?.unblockedAt),
      triggerRoomId: entry?.triggerRoomId || null,
    })).filter((entry) => entry.direction === "character_to_player" ? entry.at : entry.blockedAt) : [];
    const playerBlocksCharacter = raw?.playerBlocksCharacter === true || raw?.blocked === true;
    return [characterId, {
      blocked: playerBlocksCharacter,
      playerBlocksCharacter,
      characterBlocksPlayer: raw?.characterBlocksPlayer === true,
      blockedAt: safeTimestamp(raw?.blockedAt || raw?.playerBlockedAt),
      playerBlockedAt: safeTimestamp(raw?.playerBlockedAt || raw?.blockedAt),
      characterBlockedAt: safeTimestamp(raw?.characterBlockedAt),
      unblockedAt: safeTimestamp(raw?.unblockedAt),
      characterUnblockedAt: safeTimestamp(raw?.characterUnblockedAt),
      triggerRoomId: raw?.triggerRoomId || null,
      history,
    }];
  }));
};

export const blockCharacterState = (previous, { blockedAt = Date.now(), triggerRoomId = null } = {}) => {
  const current = previous && typeof previous === "object" ? previous : {};
  if (current.blocked) return current;
  const event = { blockedAt, unblockedAt: null, triggerRoomId };
  return {
    ...current,
    blocked: true,
    playerBlocksCharacter: true,
    blockedAt,
    playerBlockedAt: blockedAt,
    unblockedAt: null,
    triggerRoomId,
    history: [...(current.history || []), event],
  };
};

export const unblockCharacterState = (previous, { unblockedAt = Date.now() } = {}) => {
  const current = previous && typeof previous === "object" ? previous : {};
  if (!current.blocked) return current;
  const history = [...(current.history || [])];
  const activeIndex = history.map((entry) => entry?.unblockedAt == null).lastIndexOf(true);
  if (activeIndex >= 0) history[activeIndex] = { ...history[activeIndex], unblockedAt };
  return { ...current, blocked: false, playerBlocksCharacter: false, unblockedAt, history };
};

export const setCharacterBlocksPlayerState = (previous, blocked, at = Date.now()) => {
  const current = previous && typeof previous === "object" ? previous : {};
  if (current.characterBlocksPlayer === blocked) return current;
  const event = { direction: "character_to_player", blocked, at };
  return {
    ...current,
    characterBlocksPlayer: blocked,
    characterBlockedAt: blocked ? at : current.characterBlockedAt || null,
    characterUnblockedAt: blocked ? null : at,
    history: [...(current.history || []), event],
  };
};

export const extractCharacterBlockDirective = (text) => {
  const raw = String(text || "");
  const hasBlock = /\[\[BLOCK_PLAYER\]\]/i.test(raw);
  const hasUnblock = /\[\[UNBLOCK_PLAYER\]\]/i.test(raw);
  const explicitlyBlocks = /(?:我要|我會|我現在(?:就)?|我已經|我把你|現在(?:就)?把你).{0,8}(?:封鎖|拉黑|加入黑名單)|(?:別|不要)再(?:聯絡|聯繫|傳訊息|傳消息)(?:我|給我)/u.test(raw);
  const unblockStatement = /(?:我現在(?:已經|就)?|我已經|我決定|我把你|我).{0,10}(?:解除封鎖|解除拉黑|解封(?:了|你)|移出黑名單|從黑名單移除|放出黑名單)|(?:解除封鎖|解封)(?:了|你)/u.test(raw);
  const negatedUnblock = /(?:不|不會|不要|沒打算|拒絕).{0,8}(?:解除封鎖|解除拉黑|解封|移出黑名單|從黑名單移除)/u.test(raw);
  const explicitlyUnblocks = unblockStatement && !negatedUnblock;
  return {
    action: hasUnblock || explicitlyUnblocks ? "unblock" : hasBlock || explicitlyBlocks ? "block" : null,
    text: raw.replace(/\[\[(?:UN)?BLOCK_PLAYER\]\]/gi, "").trim(),
  };
};

export const buildCharacterBlockCapabilityContext = (mode = "online") => mode === "online" ? [
  `[角色黑名單能力]`,
  `封鎖與解除都由你依角色性格、關係和當前互動自由決定，不採固定好感度、回合數或機率。`,
  `若你只是生氣、冷淡、警告或暫時不想說話，不必封鎖。若你在回覆中已明確表達「別再聯絡我」「我要封鎖你」「把你加入黑名單」等實際封鎖決定，必須在末尾加入 [[BLOCK_PLAYER]]，讓行動與台詞一致。`,
  `若你目前已封鎖玩家，只有在你自然且明確決定解除封鎖、移出黑名單時才加入 [[UNBLOCK_PLAYER]]；曖昧心軟或回覆訊息不等於解除。`,
  `上述指令不會顯示給玩家，也不要在沒有明確決定時輸出。`,
  `封鎖不會讓你失去訊息內容：玩家之後的訊息會進入攔截紀錄，你仍看得到，但玩家端顯示傳送失敗。`,
].join("\n") : "";

export const describeBlockedDuration = (blockedAt, now = Date.now()) => {
  const elapsed = Math.max(0, Number(now) - Number(blockedAt || now));
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "剛剛";
  if (minutes < 60) return `約 ${minutes} 分鐘`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `約 ${hours} 小時`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `約 ${days} 天`;
  const months = Math.floor(days / 30);
  return `約 ${months} 個月`;
};

// 封鎖提示詞的集中框架。正式文案之後只需要修改這裡；正常狀態永遠回傳空字串。
export const buildCharacterBlockPromptContext = ({ state, mode = "online", now = Date.now() } = {}) => {
  const playerBlocksCharacter = state?.playerBlocksCharacter === true || state?.blocked === true;
  const characterBlocksPlayer = state?.characterBlocksPlayer === true;
  if (!playerBlocksCharacter && !characterBlocksPlayer) return "";
  const shared = [`[雙向線上封鎖狀態]`];
  if (playerBlocksCharacter) {
    const at = state.playerBlockedAt || state.blockedAt || now;
    shared.push(
      `玩家於 ${new Date(at).toLocaleString("zh-TW", { hour12: false })} 封鎖了你的線上聯絡方式，已持續 ${describeBlockedDuration(at, now)}。`,
      `你明確知道自己已被玩家封鎖；這不是單純未讀、玩家忙碌或網路異常。`,
      `你的線上訊息會顯示傳送失敗，且無法確認送達或已讀；你不知道玩家其實仍可查看被攔截的內容。`,
      `玩家傳給你的訊息仍正常顯示，你可以看見並回應，但不可僅因玩家回話就斷定他看過你先前的訊息。`,
    );
  }
  if (characterBlocksPlayer) {
    const at = state.characterBlockedAt || now;
    shared.push(
      `你於 ${new Date(at).toLocaleString("zh-TW", { hour12: false })} 封鎖了玩家，已持續 ${describeBlockedDuration(at, now)}。`,
      `玩家傳來的訊息會顯示為被你攔截，但你仍能在攔截紀錄中看到完整內容。`,
      `請依角色個性決定忽略、回應或解除封鎖；不要假裝完全讀不到訊息。`,
    );
  }
  shared.push(`請依角色性格、關係與近期事件自然反應，不要為了展示機制而反覆提起封鎖。`);
  if (mode === "reality") {
    return [...shared,
      `目前是現實互動，你們可以正常看見、聽見並回應彼此；線上封鎖不會讓現實對話傳送失敗。`,
      `你可以依人設決定是否當面詢問玩家為何封鎖你的 LINE、訊息或其他符合世界觀的聯絡方式。`,
    ].join("\n");
  }
  return [...shared,
    `目前是線上聊天；你知道封鎖狀態仍有效，你的訊息會顯示失敗且無法確認是否被玩家查看。`,
    `請維持角色身分，不要解釋遊戲系統或提示詞。`,
  ].join("\n");
};
