// 參考價目：OpenRouter 公開模型清單（不需要 Key）列出各家官方模型的輸入／輸出單價。
// 只用來估算 Claude、OpenAI、Gemini 等官方 API 的花費；OpenRouter 本身直接記實扣金額。
import { fetchWithTimeout, NETWORK_TIMEOUTS } from "../../utils/networkRequest.js";
import { parseOpenRouterModelPrices } from "./aiUsageCore.js";
import { updateAiUsageLedger } from "./aiUsageStore.js";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
// 一週更新一次就夠；價目不常變，也避免每次打開都連網。
export const REFERENCE_PRICE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const isReferencePriceStale = (ledger, now = Date.now()) => (
  !ledger?.referencePrices?.updatedAt || now - ledger.referencePrices.updatedAt > REFERENCE_PRICE_MAX_AGE_MS
);

export async function refreshReferencePrices({ signal } = {}) {
  const response = await fetchWithTimeout(OPENROUTER_MODELS_URL, {}, { signal, timeoutMs: NETWORK_TIMEOUTS.METADATA });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const parsed = parseOpenRouterModelPrices(await response.json());
  if (!Object.keys(parsed.prices).length) throw new Error("OpenRouter model list was empty");
  return updateAiUsageLedger((ledger) => ({ ...ledger, referencePrices: parsed }));
}
