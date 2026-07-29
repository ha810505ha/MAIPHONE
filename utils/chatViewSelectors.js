const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_THOUGHT_PAGE_SIZE = 5;

export function selectVisibleChatMessages(messages, requestedCount, pageSize = DEFAULT_PAGE_SIZE) {
  const list = Array.isArray(messages) ? messages : [];
  const visibleCount = Math.max(pageSize, Number(requestedCount) || pageSize);
  return {
    visibleCount,
    visibleMessages: list.slice(Math.max(0, list.length - visibleCount)),
    hasEarlier: visibleCount < list.length,
    nextVisibleCount: Math.min(list.length, visibleCount + pageSize),
  };
}

export function selectDirectChatThoughts(messages, page, isTyping, pageSize = DEFAULT_THOUGHT_PAGE_SIZE) {
  const list = Array.isArray(messages) ? messages : [];
  const anchorIds = new Set();

  list.forEach((message, index) => {
    if (message?.role !== "assistant") return;
    if (message.replyGroupId) {
      if (message.replyGroupIndex === message.replyGroupSize - 1) anchorIds.add(message.id);
      return;
    }
    if (list[index + 1]?.role !== "assistant") anchorIds.add(message.id);
  });

  const latestAssistantId = [...list].reverse()
    .find((message) => message?.role === "assistant")?.id || null;
  const records = list
    .filter((message) => message?.role === "assistant" && message.innerThought?.content)
    .slice()
    .sort((a, b) => (
      (b.innerThought.generatedAt || b.time || 0)
      - (a.innerThought.generatedAt || a.time || 0)
    ));
  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));
  const activePage = Math.min(page, pageCount - 1);

  return {
    records,
    visibleRecords: records.slice(activePage * pageSize, (activePage + 1) * pageSize),
    activePage,
    pageCount,
    canRender: (message) => (
      anchorIds.has(message.id) && (
        Boolean(message.innerThought?.content)
        || (!isTyping && message.id === latestAssistantId)
      )
    ),
  };
}

export function selectMessageRangeIds(messages, startId, endId) {
  const list = Array.isArray(messages) ? messages : [];
  const startIndex = list.findIndex((message) => message.id === startId);
  const endIndex = list.findIndex((message) => message.id === endId);
  if (startIndex < 0 || endIndex < 0) return null;
  const from = Math.min(startIndex, endIndex);
  const to = Math.max(startIndex, endIndex);
  return list.slice(from, to + 1)
    .filter((message) => message?.id)
    .map((message) => message.id);
}
