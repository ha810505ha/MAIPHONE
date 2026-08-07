export function updateMessagesInRoomList(rooms, roomId, updater, updatedAt = Date.now()) {
  const list = Array.isArray(rooms) ? rooms : [];
  if (!roomId || typeof updater !== "function") return list;
  const roomIndex = list.findIndex((room) => room?.id === roomId);
  if (roomIndex < 0) return list;
  const currentMessages = Array.isArray(list[roomIndex].messages) ? list[roomIndex].messages : [];
  const updatedMessages = updater(currentMessages);
  if (!Array.isArray(updatedMessages) || updatedMessages === currentMessages) return list;
  const next = [...list];
  next[roomIndex] = {
    ...list[roomIndex],
    messages: updatedMessages,
    updatedAt,
  };
  return next;
}

export function isRequestRoomActive(activeRoomIds, characterId, roomId) {
  return !roomId || activeRoomIds?.[characterId] === roomId;
}
