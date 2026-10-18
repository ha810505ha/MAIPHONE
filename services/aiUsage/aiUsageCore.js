// AI 花費本（MP-063）的純函式：從各家回應讀 token／費用、套價目、整理帳本與統計。
// 不碰 IndexedDB 與網路，方便測試；儲存在 aiUsageStore，價目下載在 aiUsagePricing。

export const AI_USAGE_ENTITY_KEY = "ent_aiUsage";
export const AI_USAGE_VERSION = 1;
// 明細保留 90 天；更早的只留每月彙總。
export const AI_USAGE_RETENTION_DAYS = 90;
// 防呆上限：就算一天叫上千次，帳本也不會無限長大。
export const AI_USAGE_MAX_ENTRIES = 20000;

// 金額來源：實扣（供應商回報）、估算（token × 價目）、免費（本機模型）、點數（Mali 代管）、未定價。
export const AI_COST_SOURCES = ["actual", "estimate", "free", "points", "unpriced"];

const DAY_MS = 24 * 60 * 60 * 1000;
const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const optionalNum = (value) => {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function createEmptyAiUsageLedger() {
  return { version: AI_USAGE_VERSION, settings: { enabled: true }, entries: [], archive: {}, customPrices: {}, referencePrices: null };
}

export function normalizeAiUsageLedger(raw) {
  const base = createEmptyAiUsageLedger();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const entries = Array.isArray(raw.entries) ? raw.entries.filter((entry) => entry && typeof entry === "object" && Number.isFinite(Number(entry.t))) : [];
  return {
    version: AI_USAGE_VERSION,
    settings: { enabled: raw.settings?.enabled !== false },
    entries,
    archive: raw.archive && typeof raw.archive === "object" && !Array.isArray(raw.archive) ? raw.archive : {},
    customPrices: raw.customPrices && typeof raw.customPrices === "object" && !Array.isArray(raw.customPrices) ? raw.customPrices : {},
    referencePrices: raw.referencePrices && typeof raw.referencePrices === "object" && raw.referencePrices.prices ? raw.referencePrices : null,
  };
}

/**
 * 從供應商回應讀出 token 與費用。回傳的 input 是「全部輸入 token」（含快取命中），
 * cacheRead 是其中命中快取的部分，方便用不同單價計算。
 */
export function extractAiUsage(provider, payload) {
  if (!payload || typeof payload !== "object") return null;
  if (provider === "claude") {
    const usage = payload.usage;
    if (!usage) return null;
    const cacheRead = num(usage.cache_read_input_tokens);
    const cacheWrite = num(usage.cache_creation_input_tokens);
    return {
      input: num(usage.input_tokens) + cacheRead + cacheWrite,
      output: num(usage.output_tokens),
      cacheRead,
      cacheWrite,
      reasoning: 0,
      providerCost: null,
    };
  }
  if (provider === "gemini" || provider === "vertex") {
    const chunks = Array.isArray(payload) ? payload : [payload];
    const usage = [...chunks].reverse().find((chunk) => chunk?.usageMetadata)?.usageMetadata;
    if (!usage) return null;
    const reasoning = num(usage.thoughtsTokenCount);
    return {
      input: num(usage.promptTokenCount),
      // 思考 token 跟輸出一樣計價。
      output: num(usage.candidatesTokenCount) + reasoning,
      cacheRead: num(usage.cachedContentTokenCount),
      cacheWrite: 0,
      reasoning,
      providerCost: null,
    };
  }
  const usage = payload.usage;
  if (!usage) return null;
  return {
    input: num(usage.prompt_tokens),
    output: num(usage.completion_tokens),
    cacheRead: num(usage.prompt_tokens_details?.cached_tokens),
    cacheWrite: num(usage.prompt_tokens_details?.cache_write_tokens),
    reasoning: num(usage.completion_tokens_details?.reasoning_tokens),
    // OpenRouter 會附上這次實際扣的金額（美金）。
    providerCost: provider === "openrouter" ? optionalNum(usage.cost) : null,
  };
}

// 模型名稱正規化：小寫、去掉日期版號、點換成連字號，讓 claude-sonnet-4-5-20250929 對得到 anthropic/claude-sonnet-4.5。
export function normalizeModelKey(model) {
  return String(model || "")
    .trim()
    .toLowerCase()
    .replace(/^models\//, "")
    .replace(/:free$/, "")
    .replace(/[-@](\d{8}|\d{4}-\d{2}-\d{2})$/, "")
    .replace(/\./g, "-");
}

const PROVIDER_VENDOR = { claude: "anthropic", openai: "openai", gemini: "google", vertex: "google", deepseek: "deepseek", grok: "x-ai" };

// 自訂價目以「模型名稱」為 key（玩家輸入的名稱，正規化後比對）。
export function findModelPrice({ provider, model }, { customPrices = {}, referencePrices = null } = {}) {
  const key = normalizeModelKey(model);
  if (!key) return null;
  for (const [name, price] of Object.entries(customPrices || {})) {
    if (normalizeModelKey(name) === key) return { ...price, origin: "custom" };
  }
  const prices = referencePrices?.prices || {};
  // OpenRouter 用自己的模型 id（vendor/model），直接查。
  const vendor = PROVIDER_VENDOR[provider];
  const candidates = provider === "openrouter" ? [key] : [vendor ? `${vendor}/${key}` : null, key].filter(Boolean);
  for (const candidate of candidates) {
    if (prices[candidate]) return { ...prices[candidate], origin: "reference" };
  }
  if (provider !== "openrouter") {
    const suffix = `/${key}`;
    const match = Object.keys(prices).find((id) => id.endsWith(suffix));
    if (match) return { ...prices[match], origin: "reference" };
  }
  return null;
}

// 價目單位：美金／每百萬 token。
export function estimateCost(usage, price) {
  if (!usage || !price) return null;
  const input = optionalNum(price.input);
  const output = optionalNum(price.output);
  if (input == null || output == null) return null;
  const cacheReadPrice = optionalNum(price.cacheRead) ?? input;
  const cacheWritePrice = optionalNum(price.cacheWrite) ?? input;
  const plainInput = Math.max(0, num(usage.input) - num(usage.cacheRead) - num(usage.cacheWrite));
  const total = plainInput * input
    + num(usage.cacheRead) * cacheReadPrice
    + num(usage.cacheWrite) * cacheWritePrice
    + num(usage.output) * output;
  return total / 1_000_000;
}

/**
 * 做成一筆帳。只記模型、功能、token 與金額，不記 Key、提示詞或回覆內容。
 */
export function buildAiUsageEntry({ provider, model, app, action, usage, isLocal = false, points = null, now = Date.now(), id }, pricing = {}) {
  const base = {
    id: id || `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    t: now,
    provider: String(provider || "unknown"),
    model: String(model || ""),
    app: String(app || "other"),
    action: String(action || "generate"),
    in: num(usage?.input),
    out: num(usage?.output),
    cr: num(usage?.cacheRead),
    cw: num(usage?.cacheWrite),
    rs: num(usage?.reasoning),
  };
  if (points != null) return { ...base, cost: null, pts: num(points), src: "points" };
  if (isLocal) return { ...base, cost: 0, src: "free" };
  if (usage?.providerCost != null) return { ...base, cost: usage.providerCost, src: "actual" };
  const price = usage ? findModelPrice({ provider, model }, pricing) : null;
  const cost = estimateCost(usage, price);
  return cost == null ? { ...base, cost: null, src: "unpriced" } : { ...base, cost, src: "estimate" };
}

// 未定價的舊紀錄，在顯示時用目前價目補算（不回寫帳本）。
export function resolveEntryCost(entry, pricing = {}) {
  if (entry?.src !== "unpriced") return { cost: entry?.cost ?? null, src: entry?.src || "unpriced" };
  const price = findModelPrice(entry, pricing);
  const cost = estimateCost({ input: entry.in, output: entry.out, cacheRead: entry.cr, cacheWrite: entry.cw }, price);
  return cost == null ? { cost: null, src: "unpriced" } : { cost, src: "estimate" };
}

export const monthKeyOf = (time) => {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const emptySummary = () => ({ calls: 0, cost: 0, actual: 0, estimate: 0, points: 0, unpriced: 0, in: 0, out: 0, byApp: {}, byModel: {} });

function addToSummary(summary, entry, resolved) {
  const cost = resolved.cost == null ? 0 : resolved.cost;
  summary.calls += 1;
  summary.cost += cost;
  if (resolved.src === "actual") summary.actual += cost;
  if (resolved.src === "estimate") summary.estimate += cost;
  if (resolved.src === "points") summary.points += num(entry.pts);
  if (resolved.src === "unpriced") summary.unpriced += 1;
  summary.in += num(entry.in);
  summary.out += num(entry.out);
  const app = entry.app || "other";
  summary.byApp[app] = (summary.byApp[app] || 0) + cost;
  const modelKey = `${entry.provider}|${entry.model}`;
  const model = summary.byModel[modelKey] || { cost: 0, calls: 0, src: resolved.src };
  model.cost += cost;
  model.calls += 1;
  if (model.src !== resolved.src) model.src = "mixed";
  summary.byModel[modelKey] = model;
  return summary;
}

/** 加一筆並把超過保留期的明細併進每月彙總。 */
export function appendAiUsageEntry(ledger, entry, { now = Date.now(), retentionDays = AI_USAGE_RETENTION_DAYS, maxEntries = AI_USAGE_MAX_ENTRIES } = {}) {
  const next = normalizeAiUsageLedger(ledger);
  const entries = [...next.entries, entry];
  const cutoff = now - retentionDays * DAY_MS;
  let keepFrom = entries.findIndex((item) => Number(item.t) >= cutoff);
  if (keepFrom < 0) keepFrom = entries.length;
  keepFrom = Math.max(keepFrom, entries.length - maxEntries);
  if (keepFrom > 0) {
    const archive = { ...next.archive };
    for (const old of entries.slice(0, keepFrom)) {
      const key = monthKeyOf(old.t);
      const summary = archive[key] ? structuredCloneSummary(archive[key]) : emptySummary();
      archive[key] = addToSummary(summary, old, resolveEntryCost(old, next));
    }
    next.archive = archive;
  }
  next.entries = entries.slice(keepFrom);
  return next;
}

const structuredCloneSummary = (summary) => ({
  ...emptySummary(),
  ...summary,
  byApp: { ...(summary.byApp || {}) },
  byModel: Object.fromEntries(Object.entries(summary.byModel || {}).map(([key, value]) => [key, { ...value }])),
});

/** 某個月的統計：已歸檔的彙總＋還在保留期內的明細。 */
export function summarizeAiUsageMonth(ledger, monthKey) {
  const normalized = normalizeAiUsageLedger(ledger);
  const summary = normalized.archive[monthKey] ? structuredCloneSummary(normalized.archive[monthKey]) : emptySummary();
  for (const entry of normalized.entries) {
    if (monthKeyOf(entry.t) === monthKey) addToSummary(summary, entry, resolveEntryCost(entry, normalized));
  }
  return summary;
}

/** 一段時間內（含 from、不含 to）的花費合計。 */
export function sumAiUsageBetween(ledger, from, to) {
  const normalized = normalizeAiUsageLedger(ledger);
  let cost = 0;
  let calls = 0;
  for (const entry of normalized.entries) {
    if (entry.t >= from && entry.t < to) {
      calls += 1;
      cost += resolveEntryCost(entry, normalized).cost || 0;
    }
  }
  return { cost, calls };
}

/** 解析 OpenRouter 公開 /models 回應，換成「每百萬 token」的價目表。 */
export function parseOpenRouterModelPrices(payload, now = Date.now()) {
  const list = Array.isArray(payload?.data) ? payload.data : [];
  const prices = {};
  for (const item of list) {
    const id = normalizeModelKey(item?.id);
    const pricing = item?.pricing;
    if (!id || !pricing) continue;
    const perMillion = (value) => {
      const n = optionalNum(value);
      return n == null ? null : Math.round(n * 1_000_000 * 10000) / 10000;
    };
    const input = perMillion(pricing.prompt);
    const output = perMillion(pricing.completion);
    if (input == null || output == null) continue;
    prices[id] = { input, output, cacheRead: perMillion(pricing.input_cache_read), cacheWrite: perMillion(pricing.input_cache_write) };
  }
  return { updatedAt: now, prices };
}
