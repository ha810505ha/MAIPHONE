import { useEffect } from "react";

/**
 * Runs the character's first reply after the player blocks them. Keeping this
 * effect separate avoids a dependency cycle between block state and the lazy
 * direct-chat generation controller.
 */
export default function useCharacterBlockReaction({
  pendingBlockReaction,
  characterBlockStates,
  characters,
  chatHistory,
  activeRoomIds,
  setPendingBlockReaction,
  generateAssistantForHistory,
}) {
  useEffect(() => {
    if (!pendingBlockReaction) return;
    const { cid, noticeId } = pendingBlockReaction;
    const character = characters.find((item) => item.id === cid);
    const history = chatHistory[cid] || [];
    const notice = history.find((item) => item.id === noticeId);
    const blockState = characterBlockStates?.[cid];
    if (!character || !notice || !blockState?.blocked) return;
    setPendingBlockReaction(null);
    void generateAssistantForHistory({
      cid,
      roomId: blockState.triggerRoomId || activeRoomIds[cid] || null,
      char: character,
      nextForDisplay: history,
      selectedMode: "online",
      um: notice,
      text: "",
    }).catch((error) => console.warn("[block reaction]", error));
  }, [
    pendingBlockReaction,
    characterBlockStates,
    characters,
    chatHistory,
    activeRoomIds,
    setPendingBlockReaction,
    generateAssistantForHistory,
  ]);
}
