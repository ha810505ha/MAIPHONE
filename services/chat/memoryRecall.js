// 記憶召回評分。純函式、不依賴 React 與瀏覽器 API，方便 tools/test-memory-recall.mjs 直接載入。
//
// 舊做法是「命中的 bigram 數量最多者勝」，有三個問題：長記憶天生佔便宜、
// 時間幾乎沒有權重（只在完全同分時才比 date）、重要與瑣碎的記憶同權。
// 這裡改成三個分量組合：相關度當主體，時近性與重要度當乘數。
//
// 用乘數而不是加權和，是因為「完全不相關的記憶再新再重要也不該召回」；
// 兩個乘數都留了地板值，所以久遠但高度相關的記憶不會歸零，只是要更相關才擠得進來。

export const MEMORY_RECALL_TUNING = {
  // 分數減半所需天數。
  halfLifeDays: 45,
  // 低於此分不召回，避免硬湊滿名額塞進雜訊。
  scoreFloor: 0.12,
  // 一般記憶的召回上限（釘選的另計）。
  maxRecall: 5,
  // 釘選記憶的上限，維持既有行為。
  maxPinned: 5,
  // 舊記憶沒有 weight 欄位時的中性值，確保升級後召回行為不突變。
  defaultWeight: 3,
  minWeight: 1,
  maxWeight: 5,
  // 會進提示詞的活躍記憶上限。超過就把保留分數最低的塵封，而不是拒絕生成新記憶
  // ——後者等於「玩到某天角色就不再學新東西」。
  activeLimit: 30,
  // 塵封書庫上限。純文字，500 條約 40KB，比一張截圖還小，所以給得寬鬆。
  archiveLimit: 500,
};

const DAY_MS = 86_400_000;

export function normalizeMemoryWeight(value, tuning = MEMORY_RECALL_TUNING) {
  // null 與空字串在 Number() 下會變成 0（有限數），會被 clamp 成最小值而不是回退到
  // 中性值，等於把「沒填」誤判成「最不重要」，所以要先擋掉。
  if (value === null || value === undefined || value === "") return tuning.defaultWeight;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return tuning.defaultWeight;
  return Math.min(tuning.maxWeight, Math.max(tuning.minWeight, Math.round(parsed)));
}

// hit：命中的 token 數；tokenCount：該記憶自身的 token 總數。
// 兩者相除（開根號緩和）得到命中密度，長記憶就不會只因為字多而勝出。
export function scoreMemoryRecall({ hit, tokenCount, date, weight, now = Date.now() }, tuning = MEMORY_RECALL_TUNING) {
  if (!(hit > 0)) return 0;
  const density = hit / Math.sqrt(Math.max(1, tokenCount || 1));
  const ageDays = Math.max(0, (now - (date || 0)) / DAY_MS);
  const recency = Math.pow(0.5, ageDays / tuning.halfLifeDays);
  const importance = normalizeMemoryWeight(weight, tuning) / tuning.maxWeight;
  return density * (0.55 + 0.45 * recency) * (0.6 + 0.4 * importance);
}

export function isArchivedMemory(memory) {
  return !!(memory && memory.archived);
}

export function splitArchivedMemories(list) {
  const active = [];
  const archived = [];
  (list || []).forEach((memory) => {
    if (!memory) return;
    (isArchivedMemory(memory) ? archived : active).push(memory);
  });
  return { active, archived };
}

// 保留分數：決定「活躍區滿了該把誰塵封」。跟召回分數的差別是不含相關度
// ——塵封是在沒有任何查詢的情況下做的決定，只能看夠不夠新、夠不夠重要。
export function scoreMemoryRetention({ date, weight, now = Date.now() }, tuning = MEMORY_RECALL_TUNING) {
  const ageDays = Math.max(0, (now - (date || 0)) / DAY_MS);
  const recency = Math.pow(0.5, ageDays / tuning.halfLifeDays);
  const importance = normalizeMemoryWeight(weight, tuning) / tuning.maxWeight;
  return (0.55 + 0.45 * recency) * importance;
}

// 回傳「為了讓活躍區降到 keep 條，該塵封哪些記憶」的 id 集合。
// 釘選永遠不塵封——那是玩家的明確意圖，不該被自動化覆蓋。
export function selectMemoriesToArchive(list, { keep, now = Date.now(), tuning = MEMORY_RECALL_TUNING } = {}) {
  const limit = typeof keep === "number" ? keep : tuning.activeLimit;
  const { active } = splitArchivedMemories(list);
  const archivable = active.filter((m) => !m.pinned);
  const overflow = active.length - Math.max(0, limit);
  if (overflow <= 0 || archivable.length === 0) return new Set();
  return new Set(
    archivable
      .map((memory) => ({ memory, score: scoreMemoryRetention({ date: memory.date, weight: memory.weight, now }, tuning) }))
      .sort((a, b) => a.score - b.score || (a.memory.date || 0) - (b.memory.date || 0))
      .slice(0, Math.min(overflow, archivable.length))
      .map((entry) => entry.memory.id),
  );
}

// candidates：[{ memory, score }]。回傳過門檻、依分數排序後的記憶本體。
// 舊做法是無條件取前 3 條，會在「5 條都很相關」時丟掉有用的，
// 也會在「全部都是雜訊」時硬塞 3 條進提示詞。
export function selectRecalledMemories(candidates, { tuning = MEMORY_RECALL_TUNING, limit } = {}) {
  const max = typeof limit === "number" ? limit : tuning.maxRecall;
  return (candidates || [])
    .filter((entry) => entry && entry.memory && entry.score >= tuning.scoreFloor)
    .sort((a, b) => b.score - a.score || (b.memory.date || 0) - (a.memory.date || 0))
    .slice(0, Math.max(0, max))
    .map((entry) => entry.memory);
}
