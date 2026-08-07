// 記憶壓縮：玩家手動挑一批記憶，交給模型整併成一條摘要。
//
// 三個刻意的設計決定：
// 1. 只由玩家觸發，不自動跑——自動壓縮猜不準該壓哪些，猜錯就是不可逆的資訊損失。
// 2. 原文一律塵封而不是刪除，摘要記著 sourceIds，所以整個動作可以完整還原。
// 3. 提示詞可由玩家改寫。改壞了也不會炸，因為摘要本身能手動編輯。

export const MEMORY_COMPRESSION = {
  minSelection: 2,
  maxSelection: 20,
  summaryMaxChars: 200,
};

export const DEFAULT_MEMORY_COMPRESS_PROMPT = `你要把角色「{{char}}」的多條長期記憶整併成一條摘要。
規則：
1) 只輸出 1 則摘要，30~120 字。
2) 保留人物、地點、時間順序與因果；可以概括重複的日常，但不要刪掉具體事實。
3) 若這批記憶包含長期成立的事實（偏好、習慣、關係、承諾），務必在摘要中原樣保留，不要模糊成「有一些偏好」。
4) 不得臆測或改寫角色的性別、身分與關係設定。
5) 不要使用「她/他」等可能造成性別偏移的主詞，優先用角色名「{{char}}」。
6) 只輸出摘要文字本身，不要解釋、不要加標題。

要整併的記憶：
{{memories}}`;

export function normalizeCompressPromptTemplate(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || "";
}

// 空字串代表「沿用預設」，所以玩家清空欄位等同還原預設，不會變成空提示詞。
export function resolveCompressPromptTemplate(value) {
  return normalizeCompressPromptTemplate(value) || DEFAULT_MEMORY_COMPRESS_PROMPT;
}

export function isUsingDefaultCompressPrompt(value) {
  return resolveCompressPromptTemplate(value) === DEFAULT_MEMORY_COMPRESS_PROMPT;
}

export function buildMemoryCompressionPrompt({ template, charName, memories }) {
  const list = (memories || [])
    .map((memory, index) => `${index + 1}. ${String(memory?.text || "").trim()}`)
    .filter((line) => line.length > 3)
    .join("\n");
  return resolveCompressPromptTemplate(template)
    .replaceAll("{{char}}", String(charName || "角色"))
    .replaceAll("{{memories}}", list || "（無）");
}

// 選取數量的邊界。壓 1 條沒有意義，壓太多則會逼模型把不相干的事硬揉在一起。
export function validateCompressionSelection(selectedIds, { tuning = MEMORY_COMPRESSION } = {}) {
  const count = (selectedIds || []).length;
  if (count < tuning.minSelection) return { ok: false, reason: "too_few", need: tuning.minSelection };
  if (count > tuning.maxSelection) return { ok: false, reason: "too_many", limit: tuning.maxSelection };
  return { ok: true, count };
}

export function isSummaryMemory(memory) {
  return Array.isArray(memory?.sourceIds) && memory.sourceIds.length > 0;
}

// 壓縮結果套用到記憶清單：原文塵封、摘要插入，全部在同一次更新裡完成，
// 避免中途失敗留下「原文沒了但摘要也沒進去」的半套狀態。
export function applyCompressionResult(list, { sourceIds, summary }) {
  const ids = new Set(sourceIds || []);
  const archived = (list || []).map((memory) => (ids.has(memory.id) ? { ...memory, archived: true } : memory));
  return [...archived, summary];
}

// 還原：摘要刪掉、來源記憶解除塵封。已經被玩家手動刪掉的來源就自然略過。
export function revertCompression(list, summaryId) {
  const summary = (list || []).find((memory) => memory.id === summaryId);
  if (!summary || !isSummaryMemory(summary)) return { list, restored: 0 };
  const ids = new Set(summary.sourceIds);
  let restored = 0;
  const next = (list || [])
    .filter((memory) => memory.id !== summaryId)
    .map((memory) => {
      if (!ids.has(memory.id) || !memory.archived) return memory;
      restored += 1;
      return { ...memory, archived: false };
    });
  return { list: next, restored };
}
