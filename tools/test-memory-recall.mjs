import assert from "node:assert/strict";
import fs from "node:fs";
import {
  MEMORY_RECALL_TUNING,
  isArchivedMemory,
  normalizeMemoryWeight,
  scoreMemoryRecall,
  scoreMemoryRetention,
  selectMemoriesToArchive,
  selectRecalledMemories,
  splitArchivedMemories,
} from "../services/chat/memoryRecall.js";

const DAY = 86_400_000;
const now = Date.now();
const daysAgo = (n) => now - n * DAY;

// --- weight 正規化：舊記憶沒有這個欄位時必須落在中性值，升級後召回行為才不會突變 ---
assert.equal(normalizeMemoryWeight(undefined), MEMORY_RECALL_TUNING.defaultWeight, "missing weight must fall back to the neutral default");
assert.equal(normalizeMemoryWeight(null), MEMORY_RECALL_TUNING.defaultWeight, "null weight must fall back to the neutral default");
assert.equal(normalizeMemoryWeight("not a number"), MEMORY_RECALL_TUNING.defaultWeight, "non-numeric weight must fall back to the neutral default");
assert.equal(normalizeMemoryWeight(99), MEMORY_RECALL_TUNING.maxWeight, "weight must be clamped to the maximum");
assert.equal(normalizeMemoryWeight(-5), MEMORY_RECALL_TUNING.minWeight, "weight must be clamped to the minimum");
assert.equal(normalizeMemoryWeight(4.4), 4, "fractional weight must round to an integer step");

// --- 零命中不得計分，否則門檻會被無關記憶淹沒 ---
assert.equal(scoreMemoryRecall({ hit: 0, tokenCount: 20, date: now, weight: 5, now }), 0, "a memory with no matching token must score zero");

// --- 長度偏差：同樣命中 4 個 token，短記憶（命中密度高）必須勝出 ---
const shortHit = scoreMemoryRecall({ hit: 4, tokenCount: 10, date: now, weight: 3, now });
const longHit = scoreMemoryRecall({ hit: 4, tokenCount: 200, date: now, weight: 3, now });
assert(shortHit > longHit, "a denser match must outrank a long memory that merely contains more tokens");

// --- 時近性：同樣相關度，新的必須排前面 ---
const fresh = scoreMemoryRecall({ hit: 3, tokenCount: 30, date: daysAgo(1), weight: 3, now });
const stale = scoreMemoryRecall({ hit: 3, tokenCount: 30, date: daysAgo(365), weight: 3, now });
assert(fresh > stale, "a recent memory must outrank an equally relevant year-old one");
assert(stale > 0, "an old memory must decay rather than drop to zero");

// --- 但時近性只是乘數：高度相關的舊記憶仍須勝過幾乎不相關的新記憶 ---
const relevantOld = scoreMemoryRecall({ hit: 8, tokenCount: 30, date: daysAgo(400), weight: 3, now });
const irrelevantNew = scoreMemoryRecall({ hit: 1, tokenCount: 30, date: now, weight: 3, now });
assert(relevantOld > irrelevantNew, "recency must stay a multiplier, never override relevance");

// --- 重要度：其餘條件相同時，weight 高的勝出 ---
const heavy = scoreMemoryRecall({ hit: 3, tokenCount: 30, date: daysAgo(10), weight: 5, now });
const light = scoreMemoryRecall({ hit: 3, tokenCount: 30, date: daysAgo(10), weight: 1, now });
assert(heavy > light, "a higher weight must rank above a lower one when all else is equal");

// --- 舊記憶（無 weight）與明確 weight=3 必須完全等分，確保升級不改變既有排序 ---
const legacy = scoreMemoryRecall({ hit: 3, tokenCount: 30, date: daysAgo(10), weight: undefined, now });
const explicit = scoreMemoryRecall({ hit: 3, tokenCount: 30, date: daysAgo(10), weight: 3, now });
assert.equal(legacy, explicit, "a legacy memory without weight must score identically to an explicit neutral weight");

// --- 門檻制：全部低於門檻時回傳空陣列，不硬湊名額塞雜訊進提示詞 ---
const noise = [1, 2, 3].map((i) => ({ memory: { id: `n${i}`, date: daysAgo(500) }, score: 0.001 }));
assert.deepEqual(selectRecalledMemories(noise), [], "sub-threshold candidates must not be padded into the prompt");

// --- 高於門檻時依分數排序並受上限限制 ---
const many = Array.from({ length: 12 }, (_, i) => ({ memory: { id: `m${i}`, date: now }, score: 1 - i * 0.01 }));
const picked = selectRecalledMemories(many);
assert.equal(picked.length, MEMORY_RECALL_TUNING.maxRecall, "recall must be capped by maxRecall");
assert.equal(picked[0].id, "m0", "the highest scoring memory must come first");
assert(MEMORY_RECALL_TUNING.maxRecall > 3, "recall limit must no longer be the fixed top-3 cut");

// --- 沒有 memory 本體的項目要被濾掉，避免髒資料進提示詞 ---
assert.deepEqual(selectRecalledMemories([{ memory: null, score: 9 }, undefined]), [], "malformed candidates must be dropped");
assert.deepEqual(selectRecalledMemories(null), [], "a missing candidate list must not throw");

// --- 塵封書庫：分流 ---
const mixed = [
  { id: "a", text: "活躍" },
  { id: "b", text: "塵封", archived: true },
  null,
];
const split = splitArchivedMemories(mixed);
assert.deepEqual(split.active.map((m) => m.id), ["a"], "active memories must exclude archived ones");
assert.deepEqual(split.archived.map((m) => m.id), ["b"], "archived memories must be separated out");
assert.deepEqual(splitArchivedMemories(null), { active: [], archived: [] }, "a missing memory list must not throw");
assert.equal(isArchivedMemory(undefined), false, "a missing memory must not be treated as archived");

// --- 保留分數：不含相關度，只看夠不夠新、夠不夠重要 ---
assert(
  scoreMemoryRetention({ date: daysAgo(1), weight: 3, now }) > scoreMemoryRetention({ date: daysAgo(300), weight: 3, now }),
  "retention must favour recent memories when weight is equal",
);
assert(
  scoreMemoryRetention({ date: daysAgo(300), weight: 5, now }) > scoreMemoryRetention({ date: daysAgo(300), weight: 1, now }),
  "retention must favour important memories when age is equal",
);

// --- 溢出塵封：只挑超出的條數，且挑保留分數最低的 ---
const overflowing = [
  { id: "keep-new", date: daysAgo(1), weight: 3 },
  { id: "keep-heavy", date: daysAgo(200), weight: 5 },
  { id: "drop-old", date: daysAgo(900), weight: 1 },
];
const dropped = selectMemoriesToArchive(overflowing, { keep: 2, now });
assert.equal(dropped.size, 1, "archiving must remove exactly the overflow count");
assert(dropped.has("drop-old"), "the lowest retention memory must be the one archived");

// --- 釘選永遠不塵封，即使它是分數最低的 ---
const pinnedOnly = [
  { id: "p1", date: daysAgo(900), weight: 1, pinned: true },
  { id: "p2", date: daysAgo(900), weight: 1, pinned: true },
];
assert.equal(selectMemoriesToArchive(pinnedOnly, { keep: 1, now }).size, 0, "pinned memories must never be auto-archived");

// --- 沒溢出就不動任何東西 ---
assert.equal(selectMemoriesToArchive(overflowing, { keep: 10, now }).size, 0, "no archiving may happen below the limit");

// --- 已塵封的不計入活躍額度，否則書庫一長就會把活躍記憶誤判成溢出 ---
const withArchive = [
  { id: "a1", date: daysAgo(1), weight: 3 },
  { id: "z1", date: daysAgo(900), weight: 1, archived: true },
  { id: "z2", date: daysAgo(900), weight: 1, archived: true },
];
assert.equal(selectMemoriesToArchive(withArchive, { keep: 2, now }).size, 0, "archived memories must not count against the active limit");

// --- 防呆：正規化的上限必須活躍／塵封分開算，單一 slice 會把書庫截斷 ---
const maliPhoneSource = fs.readFileSync(new URL("../MaliPhone.jsx", import.meta.url), "utf8");
assert(
  !/\}\)\.slice\(0, 30\);/.test(maliPhoneSource),
  "the memory normalizer must not cap active and archived memories with a single slice",
);
assert(
  maliPhoneSource.includes("MEMORY_RECALL_TUNING.archiveLimit"),
  "the memory normalizer must apply a dedicated archive limit",
);

// --- 防呆：塵封記憶不得進入提示詞 ---
const promptSource = fs.readFileSync(new URL("../hooks/chat/useChatPromptController.js", import.meta.url), "utf8");
assert(
  promptSource.includes("!isArchivedMemory(m)"),
  "archived memories must be filtered out of the prompt",
);

// --- 防呆：記憶已滿不得再回到「拒絕生成」的舊行為 ---
const insightsSource = fs.readFileSync(new URL("../hooks/characters/useCharacterInsights.js", import.meta.url), "utf8");
assert(
  !insightsSource.includes('status: "full"'),
  "a full memory list must archive the weakest entry instead of refusing to generate",
);
assert(
  insightsSource.includes("archivedCount"),
  "auto-archiving must surface a user-visible notice rather than moving data silently",
);

// --- 防呆：手動塵封與撈回都要有 UI 入口，否則書庫只有撞到上限才會出現，等於隱形功能 ---
const statusSource = fs.readFileSync(new URL("../components/apps/StatusApp.jsx", import.meta.url), "utf8");
assert(
  statusSource.includes("archiveMemory(c.id, m.id)"),
  "active memories must offer a manual archive entry point",
);
assert(
  statusSource.includes("onRestore={restoreMemory}"),
  "the archive must offer a restore entry point",
);

// --- 防呆：正規化區段是整個物件重建，weight 沒同步加上去會在下次啟動被清掉 ---
assert(
  maliPhoneSource.includes("weight: normalizeMemoryWeight(m.weight)"),
  "the memory normalizer must persist weight, otherwise it is silently stripped on hydrate",
);

// --- 防呆：新建記憶必須帶上 weight，否則每條新記憶都要等下次 hydrate 才補齊 ---
assert(
  insightsSource.includes("weight: MEMORY_RECALL_TUNING.defaultWeight"),
  "generated memories must be created with an explicit weight",
);

// --- 防呆：評分邏輯必須留在純模組裡，不要回流到 hook ---
assert(
  promptSource.includes("scoreMemoryRecall") && promptSource.includes("selectRecalledMemories"),
  "the chat prompt controller must consume the shared recall scoring module",
);
assert(
  !/scored\.sort\(\(a, b\) => b\.hit - a\.hit/.test(promptSource),
  "the legacy hit-count sort must not return to the chat prompt controller",
);

console.log("memory recall safety checks passed");
