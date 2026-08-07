import { useState } from "react";
import {
  blockCharacterState,
  setCharacterBlocksPlayerState,
  unblockCharacterState,
} from "../../services/chat/characterBlockState";

/**
 * Owns the player-facing character block actions and their chat notices.
 * State transitions and prompt rules stay in characterBlockState.js; this
 * controller only coordinates React state, the active room, and UI feedback.
 */
export default function useCharacterBlockController({
  initialBlockStates,
  characters,
  activeRoomIds,
  currentChatCharIdRef,
  setChatHistory,
  setChatInput,
  createId,
  showToast,
}) {
  const [characterBlockStates, setCharacterBlockStates] = useState(initialBlockStates);
  const [pendingBlockReaction, setPendingBlockReaction] = useState(null);

  const setCharacterBlocked = (character, blocked) => {
    if (!character?.id) return;
    const cid = character.id;
    const now = Date.now();
    const roomId = activeRoomIds[cid] || null;
    if (blocked && currentChatCharIdRef.current === cid) setChatInput("");
    setCharacterBlockStates((previous) => ({
      ...previous,
      [cid]: blocked
        ? blockCharacterState(previous?.[cid], { blockedAt: now, triggerRoomId: roomId })
        : unblockCharacterState(previous?.[cid], { unblockedAt: now }),
    }));
    const noticeId = createId();
    setChatHistory((previous) => ({
      ...previous,
      [cid]: [...(previous[cid] || []), {
        id: noticeId,
        role: "system_notice",
        noticeType: blocked ? "character_blocked" : "character_unblocked",
        content: blocked ? `你已封鎖 ${character.name}` : `你已解除封鎖 ${character.name}`,
        time: now,
      }],
    }));
    if (blocked) setPendingBlockReaction({ cid, noticeId });
    showToast(blocked ? `已封鎖 ${character.name}` : `已解除封鎖 ${character.name}`);
  };

  const setCharacterBlocksPlayer = (cid, blocked) => {
    const character = characters.find((item) => item.id === cid);
    if (!character) return false;
    const current = characterBlockStates?.[cid];
    if (current?.characterBlocksPlayer === blocked) return false;
    const now = Date.now();
    const noticeTime = new Date(now).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
    setCharacterBlockStates((previous) => ({
      ...previous,
      [cid]: setCharacterBlocksPlayerState(previous?.[cid], blocked, now),
    }));
    setChatHistory((previous) => ({
      ...previous,
      [cid]: [...(previous[cid] || []), {
        id: createId(),
        role: "system_notice",
        noticeType: blocked ? "player_blocked_by_character" : "player_unblocked_by_character",
        content: blocked ? `${character.name} 已封鎖你 · ${noticeTime}` : `${character.name} 已解除對你的封鎖 · ${noticeTime}`,
        time: now,
      }],
    }));
    showToast(blocked ? `${character.name} 已封鎖你` : `${character.name} 已解除封鎖`);
    return true;
  };

  return {
    characterBlockStates,
    pendingBlockReaction,
    setCharacterBlocked,
    setCharacterBlocksPlayer,
    setCharacterBlockStates,
    setPendingBlockReaction,
  };
}
