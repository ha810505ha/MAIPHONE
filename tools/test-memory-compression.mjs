import assert from "node:assert/strict";
import fs from "node:fs";
import {
  DEFAULT_MEMORY_COMPRESS_PROMPT,
  MEMORY_COMPRESSION,
  applyCompressionResult,
  buildMemoryCompressionPrompt,
  isSummaryMemory,
  isUsingDefaultCompressPrompt,
  resolveCompressPromptTemplate,
  revertCompression,
  validateCompressionSelection,
} from "../services/chat/memoryCompression.js";

// --- 自訂提示詞：空值一律回退預設，玩家清空欄位就是「還原」而不是「送出空提示詞」 ---
assert.equal(resolveCompressPromptTemplate(""), DEFAULT_MEMORY_COMPRESS_PROMPT, "an empty template must fall back to the default");
assert.equal(resolveCompressPromptTemplate("   "), DEFAULT_MEMORY_COMPRESS_PROMPT, "a whitespace-only template must fall back to the default");
assert.equal(resolveCompressPromptTemplate(null), DEFAULT_MEMORY_COMPRESS_PROMPT, "a missing template must fall back to the default");
assert.equal(resolveCompressPromptTemplate(123), DEFAULT_MEMORY_COMPRESS_PROMPT, "a non-string template must fall back to the default");
assert.equal(isUsingDefaultCompressPrompt(""), true, "an empty template must report as default");
assert.equal(isUsingDefaultCompressPrompt("自訂"), false, "a custom template must not report as default");

// --- 佔位符替換 ---
const built = buildMemoryCompressionPrompt({
  template: "角色={{char}}\n記憶=\n{{memories}}",
  charName: "小明",
  memories: [{ text: "喜歡紅茶" }, { text: "怕打雷" }],
});
assert(built.includes("角色=小明"), "the character placeholder must be substituted");
assert(built.includes("1. 喜歡紅茶") && built.includes("2. 怕打雷"), "memories must be substituted as a numbered list");
assert(!built.includes("{{"), "no placeholder may survive substitution");

// --- 同一個佔位符出現多次要全部替換，否則自訂提示詞會殘留 {{char}} 字面值 ---
const repeated = buildMemoryCompressionPrompt({ template: "{{char}} 與 {{char}}", charName: "阿花", memories: [] });
assert.equal(repeated, "阿花 與 阿花", "every occurrence of a placeholder must be replaced");

// --- 空選取不得產生空白清單標記 ---
assert(
  buildMemoryCompressionPrompt({ template: "{{memories}}", charName: "x", memories: [] }).includes("（無）"),
  "an empty selection must render an explicit placeholder",
);

// --- 選取數量邊界 ---
assert.equal(validateCompressionSelection([]).ok, false, "an empty selection must be rejected");
assert.equal(validateCompressionSelection(["a"]).reason, "too_few", "compressing a single memory is meaningless and must be rejected");
assert.equal(validateCompressionSelection(["a", "b"]).ok, true, "the minimum selection must be accepted");
assert.equal(
  validateCompressionSelection(Array.from({ length: MEMORY_COMPRESSION.maxSelection + 1 }, (_, i) => `m${i}`)).reason,
  "too_many",
  "an oversized selection must be rejected",
);

// --- 套用結果：原文塵封而不是刪除，摘要帶著來源 ---
const before = [
  { id: "m1", text: "一", archived: false },
  { id: "m2", text: "二", archived: false },
  { id: "m3", text: "三", archived: false },
];
const summary = { id: "s1", text: "摘要", archived: false, sourceIds: ["m1", "m2"] };
const after = applyCompressionResult(before, { sourceIds: ["m1", "m2"], summary });
assert.equal(after.length, 4, "compression must add the summary without dropping any memory");
assert.equal(after.find((m) => m.id === "m1").archived, true, "compressed sources must be archived");
assert.equal(after.find((m) => m.id === "m2").archived, true, "compressed sources must be archived");
assert.equal(after.find((m) => m.id === "m3").archived, false, "unselected memories must be untouched");
assert.equal(
  after.filter((m) => m.text === "一").length, 1,
  "the original text must survive compression rather than being replaced by the summary",
);

// --- 摘要辨識 ---
assert.equal(isSummaryMemory(summary), true, "a memory with sourceIds must be recognised as a summary");
assert.equal(isSummaryMemory({ id: "x" }), false, "a plain memory must not be treated as a summary");
assert.equal(isSummaryMemory({ id: "x", sourceIds: [] }), false, "an empty sourceIds must not mark a summary");

// --- 還原：摘要刪掉、來源解除塵封，整趟可逆 ---
const reverted = revertCompression(after, "s1");
assert.equal(reverted.restored, 2, "reverting must restore every archived source");
assert.equal(reverted.list.find((m) => m.id === "s1"), undefined, "the summary must be removed on revert");
assert.equal(reverted.list.find((m) => m.id === "m1").archived, false, "sources must be un-archived on revert");
assert.deepEqual(
  reverted.list.map((m) => m.id).sort(),
  ["m1", "m2", "m3"],
  "reverting must land back on the original memory set",
);

// --- 還原時來源已被玩家手動刪掉：不得拋錯，只還原還在的 ---
const partial = revertCompression(after.filter((m) => m.id !== "m2"), "s1");
assert.equal(partial.restored, 1, "a deleted source must be skipped rather than throwing");

// --- 對非摘要呼叫還原不得改動任何東西 ---
const noop = revertCompression(before, "m1");
assert.equal(noop.restored, 0, "reverting a non-summary must be a no-op");
assert.equal(noop.list, before, "reverting a non-summary must not rebuild the list");

// --- 防呆：自訂提示詞必須被持久化，否則玩家改完重開就消失 ---
const defaults = fs.readFileSync(new URL("../constants/defaultAppState.js", import.meta.url), "utf8");
assert(defaults.includes("customPrompts"), "custom prompts must exist in the default app state");
const snapshot = fs.readFileSync(new URL("../hooks/data/useGlobalDataSnapshot.js", import.meta.url), "utf8");
assert(snapshot.includes("customPrompts"), "custom prompts must be included in the persisted snapshot");
const hydration = fs.readFileSync(new URL("../hooks/data/useAppHydrationController.js", import.meta.url), "utf8");
assert(hydration.includes("setCustomPrompts"), "custom prompts must be restored on hydrate");

// --- 防呆：壓縮與還原都要有 UI 入口 ---
const statusSource = fs.readFileSync(new URL("../components/apps/StatusApp.jsx", import.meta.url), "utf8");
assert(statusSource.includes("compressMemories(char, compressSelection)"), "the compress action must be reachable from the UI");
assert(statusSource.includes("revertMemorySummary(c.id, m.id)"), "the revert action must be reachable from the UI");

// --- 防呆：壓縮不得走成刪除 ---
const insightsSource = fs.readFileSync(new URL("../hooks/characters/useCharacterInsights.js", import.meta.url), "utf8");
assert(
  insightsSource.includes("applyCompressionResult"),
  "compression must go through the shared apply helper so originals are archived, not deleted",
);

console.log("memory compression safety checks passed");
