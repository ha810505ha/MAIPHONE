export function getRetryableTailUserMessage(messages, { allowInterceptedByCharacterBlock = false } = {}) {
  const list = Array.isArray(messages) ? messages : [];
  const lastMessage = list.at(-1);
  if (!lastMessage || lastMessage.role !== "user") return null;
  if (!allowInterceptedByCharacterBlock && lastMessage.interceptedByCharacterBlock === true) return null;
  return lastMessage;
}

export function isPendingRequestForRoom(pendingRequest, characterId, roomId) {
  if (!pendingRequest || characterId == null) return false;
  return String(pendingRequest.characterId) === String(characterId)
    && String(pendingRequest.roomId || "") === String(roomId || "");
}
