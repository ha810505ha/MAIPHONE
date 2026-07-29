function getChatThreadSortMeta(character, chatHistory) {
  const messages = chatHistory?.[character?.id] || [];
  const lastMessage = messages[messages.length - 1] || null;
  return {
    pinned: Boolean(character?.pinned || character?.chatPinned),
    lastAt: Number(lastMessage?.time || 0),
    openedAt: Number(character?.chatOpenedAt || 0),
    name: String(character?.name || ""),
  };
}

export function sortChatThreads(characters, chatHistory) {
  return [...(Array.isArray(characters) ? characters : [])].sort((a, b) => {
    const aMeta = getChatThreadSortMeta(a, chatHistory);
    const bMeta = getChatThreadSortMeta(b, chatHistory);
    if (aMeta.pinned !== bMeta.pinned) return aMeta.pinned ? -1 : 1;

    const aNew = !aMeta.lastAt && Boolean(aMeta.openedAt);
    const bNew = !bMeta.lastAt && Boolean(bMeta.openedAt);
    if (aNew !== bNew) return aNew ? -1 : 1;
    if (aNew && bNew && aMeta.openedAt !== bMeta.openedAt) {
      return bMeta.openedAt - aMeta.openedAt;
    }
    if (aMeta.lastAt !== bMeta.lastAt) return bMeta.lastAt - aMeta.lastAt;
    return aMeta.name.localeCompare(bMeta.name, "zh-Hant");
  });
}

export function sortGroupChats(groups) {
  return [...(Array.isArray(groups) ? groups : [])].sort((a, b) => {
    const aPinned = Boolean(a?.pinned);
    const bPinned = Boolean(b?.pinned);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;

    const aOrder = Number.isFinite(Number(a?.displayOrder)) ? Number(a.displayOrder) : null;
    const bOrder = Number.isFinite(Number(b?.displayOrder)) ? Number(b.displayOrder) : null;
    if (aOrder !== null || bOrder !== null) {
      if (aOrder === null) return 1;
      if (bOrder === null) return -1;
      if (aOrder !== bOrder) return aOrder - bOrder;
    }

    const aCreatedAt = Number(a?.createdAt || 0);
    const bCreatedAt = Number(b?.createdAt || 0);
    if (aCreatedAt !== bCreatedAt) return bCreatedAt - aCreatedAt;
    return String(a?.name || "").localeCompare(String(b?.name || ""), "zh-Hant");
  });
}
