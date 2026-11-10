export const DATING_OPENING_MESSAGE_MAX = 5;

/**
 * 信風內建角色使用字串陣列，讓一段配對開場能自然拆成多個泡泡。
 * 同時接受舊版單一字串，避免既有或外部資料在升級後失效。
 */
export function normalizeDatingOpeningMessages(value, max = DATING_OPENING_MESSAGE_MAX) {
  const limit = Math.max(1, Math.floor(Number(max) || DATING_OPENING_MESSAGE_MAX));
  const source = Array.isArray(value) ? value : [value];
  return source
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

export function createDatingOpeningMessageRecords(value, {
  now = Date.now(),
  createId,
} = {}) {
  if (typeof createId !== "function") {
    throw new TypeError("createDatingOpeningMessageRecords requires createId");
  }
  return normalizeDatingOpeningMessages(value).map((content, index) => ({
    id: createId(),
    role: "assistant",
    content,
    // 保持陣列順序，也讓通知預覽取到最後一個泡泡。
    time: now + index,
  }));
}
