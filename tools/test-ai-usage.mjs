// MP-063：AI 花費本的計價、讀 usage、90 天保留與接線檢查。
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  AI_USAGE_ENTITY_KEY,
  appendAiUsageEntry,
  buildAiUsageEntry,
  createEmptyAiUsageLedger,
  estimateCost,
  extractAiUsage,
  findModelPrice,
  monthKeyOf,
  normalizeAiUsageLedger,
  normalizeModelKey,
  parseOpenRouterModelPrices,
  resolveEntryCost,
  sumAiUsageBetween,
  summarizeAiUsageMonth,
} from "../services/aiUsage/aiUsageCore.js";
import { FEATURE_EXPORTS, PERSONA_FEATURE_EXPORTS } from "../constants/featureStoreKeys.js";

const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-12, `${message}: ${actual} ≠ ${expected}`);
const DAY = 24 * 60 * 60 * 1000;

// --- 讀各家 usage ---
const claude = extractAiUsage("claude", { usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 900, cache_creation_input_tokens: 0 } });
assert.deepEqual(claude, { input: 1000, output: 50, cacheRead: 900, cacheWrite: 0, reasoning: 0, providerCost: null });
const gemini = extractAiUsage("gemini", { usageMetadata: { promptTokenCount: 800, candidatesTokenCount: 120, thoughtsTokenCount: 30, cachedContentTokenCount: 200 } });
assert.deepEqual(gemini, { input: 800, output: 150, cacheRead: 200, cacheWrite: 0, reasoning: 30, providerCost: null }, "Gemini thinking tokens are billed as output");
const vertex = extractAiUsage("vertex", [{ candidates: [] }, { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } }]);
assert.equal(vertex.input, 10, "Vertex reads usage from the last streamed chunk");
const openrouter = extractAiUsage("openrouter", { usage: { prompt_tokens: 6240, completion_tokens: 412, prompt_tokens_details: { cached_tokens: 4800 }, cost: 0.0011 } });
assert.equal(openrouter.providerCost, 0.0011, "OpenRouter reports the actual charge");
assert.equal(openrouter.cacheRead, 4800);
assert.equal(extractAiUsage("openai", { usage: { prompt_tokens: 10, completion_tokens: 2, cost: 9 } }).providerCost, null, "only OpenRouter's cost field counts as an actual charge");
assert.equal(extractAiUsage("claude", { content: [] }), null);
console.log("ok: usage is read from Claude, Gemini/Vertex, OpenAI-compatible and OpenRouter responses");

// --- 模型名稱與價目 ---
assert.equal(normalizeModelKey("claude-sonnet-4-5-20250929"), "claude-sonnet-4-5");
assert.equal(normalizeModelKey("anthropic/claude-sonnet-4.5"), "anthropic/claude-sonnet-4-5");
assert.equal(normalizeModelKey("gpt-4o-2024-08-06"), "gpt-4o");
assert.equal(normalizeModelKey("models/gemini-2.5-flash"), "gemini-2-5-flash");
const reference = parseOpenRouterModelPrices({ data: [
  { id: "anthropic/claude-sonnet-4.5", pricing: { prompt: "0.000003", completion: "0.000015", input_cache_read: "0.0000003" } },
  { id: "google/gemini-2.5-flash", pricing: { prompt: "0.0000003", completion: "0.0000025" } },
  { id: "broken/model", pricing: { prompt: "x" } },
] }, 1000);
assert.deepEqual(Object.keys(reference.prices).sort(), ["anthropic/claude-sonnet-4-5", "google/gemini-2-5-flash"]);
assert.deepEqual(reference.prices["anthropic/claude-sonnet-4-5"], { input: 3, output: 15, cacheRead: 0.3, cacheWrite: null });
const pricing = { referencePrices: reference, customPrices: { "my-local-tune": { input: 1, output: 2 } } };
assert.equal(findModelPrice({ provider: "claude", model: "claude-sonnet-4-5-20250929" }, pricing).origin, "reference");
assert.equal(findModelPrice({ provider: "vertex", model: "gemini-2.5-flash" }, pricing).input, 0.3);
assert.equal(findModelPrice({ provider: "openai", model: "my-local-tune" }, pricing).origin, "custom");
assert.equal(findModelPrice({ provider: "claude", model: "claude-unknown" }, pricing), null);
assert.equal(findModelPrice({ provider: "claude", model: "claude-sonnet-4-5" }, { ...pricing, customPrices: { "claude-sonnet-4.5": { input: 9, output: 9 } } }).origin, "custom", "custom prices override reference prices");
// 1000 輸入（900 快取）＋ 50 輸出：100×3 + 900×0.3 + 50×15 = 1320 → $0.00132
close(estimateCost(claude, findModelPrice({ provider: "claude", model: "claude-sonnet-4-5" }, pricing)), 0.00132, "cache reads use the cheaper rate");
close(estimateCost({ input: 1000, output: 0, cacheRead: 1000 }, { input: 2, output: 4 }), 0.002, "missing cache price falls back to the input price");
console.log("ok: model names normalize and prices come from custom first, then OpenRouter reference");

// --- 一筆帳 ---
const actual = buildAiUsageEntry({ provider: "openrouter", model: "deepseek/deepseek-v4-flash", app: "chat", action: "direct_reply", usage: openrouter, now: 1, id: "a" }, pricing);
assert.equal(actual.src, "actual");
assert.equal(actual.cost, 0.0011);
const estimate = buildAiUsageEntry({ provider: "claude", model: "claude-sonnet-4-5", app: "chat", usage: claude, now: 2, id: "b" }, pricing);
assert.equal(estimate.src, "estimate");
const local = buildAiUsageEntry({ provider: "local", model: "qwen3:14b", app: "social", usage: { input: 5, output: 5 }, isLocal: true, now: 3, id: "c" }, pricing);
assert.deepEqual([local.src, local.cost], ["free", 0]);
const hosted = buildAiUsageEntry({ provider: "mali", model: "gemma", app: "chat", usage: null, points: 2, now: 4, id: "d" }, pricing);
assert.deepEqual([hosted.src, hosted.pts, hosted.cost], ["points", 2, null]);
const unpriced = buildAiUsageEntry({ provider: "claude", model: "claude-new-model", app: "chat", usage: { input: 1000000, output: 0 }, now: 5, id: "e" }, pricing);
assert.equal(unpriced.src, "unpriced");
assert.deepEqual(resolveEntryCost(unpriced, { customPrices: { "claude-new-model": { input: 2, output: 8 } } }), { cost: 2, src: "estimate" }, "unpriced entries are priced at display time once a price exists");
for (const forbidden of ["apiKey", "prompt", "content", "messages", "text"]) {
  assert.ok(!(forbidden in estimate), `entries must not store ${forbidden}`);
}
console.log("ok: entries record actual, estimate, free, points and unpriced sources without prompts or keys");

// --- 90 天保留與月彙總 ---
const now = new Date(2026, 9, 14, 12).getTime();
let ledger = createEmptyAiUsageLedger();
const old = { ...actual, id: "old", t: now - 100 * DAY };
const recent = { ...estimate, id: "new", t: now - DAY };
ledger = appendAiUsageEntry(ledger, old, { now: old.t });
ledger = appendAiUsageEntry(ledger, recent, { now });
assert.deepEqual(ledger.entries.map((e) => e.id), ["new"], "entries older than 90 days leave the detail list");
const oldMonth = monthKeyOf(old.t);
assert.equal(ledger.archive[oldMonth].calls, 1, "pruned entries are kept as a monthly total");
close(ledger.archive[oldMonth].actual, 0.0011, "archived actual cost");
close(summarizeAiUsageMonth(ledger, oldMonth).cost, 0.0011, "archived month stays visible in stats");
const thisMonth = summarizeAiUsageMonth(ledger, monthKeyOf(recent.t));
assert.equal(thisMonth.calls, 1);
assert.equal(thisMonth.byApp.chat > 0, true);
close(sumAiUsageBetween(ledger, now - 2 * DAY, now).cost, recent.cost, "range totals");
const capped = appendAiUsageEntry({ ...createEmptyAiUsageLedger(), entries: [{ ...actual, id: "x1", t: now - 3 }, { ...actual, id: "x2", t: now - 2 }] }, { ...actual, id: "x3", t: now - 1 }, { now, maxEntries: 2 });
assert.deepEqual(capped.entries.map((e) => e.id), ["x2", "x3"], "entry cap keeps the newest records");
assert.equal(Object.values(capped.archive)[0].calls, 1, "capped entries still count in monthly totals");
const normalized = normalizeAiUsageLedger({ entries: [{ t: "bad" }, { t: 1 }], settings: { enabled: false }, archive: [] });
assert.deepEqual([normalized.entries.length, normalized.settings.enabled, normalized.archive], [1, false, {}]);
console.log("ok: details are kept 90 days, older ones roll into monthly totals, and the ledger is size-capped");

// --- 接線 ---
const aiService = await readFile(new URL("../services/aiService.js", import.meta.url), "utf8");
assert.equal((aiService.match(/if \(meter\) meter\.payload = /g) || []).length, 4, "Claude, Gemini, Vertex and OpenAI-compatible branches must hand their response to the meter");
assert.match(aiService, /if \(meter\) meter\.points = /, "hosted Mali calls must record points");
assert.match(aiService, /provider === "openrouter" \? \{ usage: \{ include: true \} \}/, "OpenRouter requests must ask for the actual charge");
assert.match(aiService, /import\("\.\/aiUsage\/aiUsageStore\.js"\)/, "the recorder is loaded lazily");
assert.match(aiService, /try \{ reportAiUsage\(apiConfig, options, meter\); \} catch/, "recording errors must never break an AI reply");
assert.deepEqual(FEATURE_EXPORTS.aiUsage, [AI_USAGE_ENTITY_KEY, null], "AI cost book is included in global backups");
assert.ok(!Object.values(PERSONA_FEATURE_EXPORTS).some(([key]) => key === AI_USAGE_ENTITY_KEY), "AI cost book is device-wide, not per persona");
const storage = await readFile(new URL("../utils/indexedDbStorage.js", import.meta.url), "utf8");
assert.match(storage, /"ent_aiUsage"/);
const backup = await readFile(new URL("../services/featureBackupService.js", import.meta.url), "utf8");
assert.match(backup, /put\("aiUsage", data\.aiUsage\)/);
const textSync = await readFile(new URL("../utils/textSyncDocument.js", import.meta.url), "utf8");
assert.doesNotMatch(textSync, /aiUsage/, "AI cost book must stay out of account cloud sync");
const wallet = await readFile(new URL("../components/wallet/WalletLedgerView.jsx", import.meta.url), "utf8");
assert.match(wallet, /<AiCostAccountButton/);
assert.doesNotMatch(wallet.match(/mp-bank-amt[^\n]*/)?.[0] || "", /aiUsage|AiCost/, "AI spending must not be added to total assets");
console.log("ok: every provider path is metered, recording is fail-safe, and the ledger is backed up but not cloud-synced");
