import { fetchWithTimeout, NETWORK_TIMEOUTS } from "../utils/networkRequest.js";

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";

const asNumberOrNull = (value) => {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

async function readJson(response) {
  const payload = await response.json().catch(() => null);
  if (response.ok) return payload;
  throw new Error(payload?.error?.message || payload?.message || `HTTP ${response.status}`);
}

function createHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": "https://maliphone.app",
  };
}

/** Reads a key's live spend status without exposing the API key in the UI. */
export async function fetchOpenRouterCredits(apiKey, { signal } = {}) {
  const key = String(apiKey || "").trim();
  if (!key) throw new Error("OpenRouter API key is required");

  const keyResponse = await fetchWithTimeout(`${OPENROUTER_API_BASE}/key`, {
    headers: createHeaders(key),
  }, { signal, timeoutMs: NETWORK_TIMEOUTS.METADATA });
  const keyPayload = await readJson(keyResponse);
  const keyInfo = keyPayload?.data || {};

  if (keyInfo.is_management_key) {
    const creditResponse = await fetchWithTimeout(`${OPENROUTER_API_BASE}/credits`, {
      headers: createHeaders(key),
    }, { signal, timeoutMs: NETWORK_TIMEOUTS.METADATA });
    const creditPayload = await readJson(creditResponse);
    const credits = creditPayload?.data || {};
    const total = asNumberOrNull(credits.total_credits);
    const used = asNumberOrNull(credits.total_usage);
    return {
      scope: "account",
      total,
      used,
      remaining: total == null || used == null ? null : Math.max(0, total - used),
      updatedAt: Date.now(),
    };
  }

  const limit = asNumberOrNull(keyInfo.limit);
  const remaining = asNumberOrNull(keyInfo.limit_remaining);
  return {
    scope: limit == null ? "usage" : "key",
    limit,
    remaining,
    used: asNumberOrNull(keyInfo.usage),
    reset: String(keyInfo.limit_reset || ""),
    updatedAt: Date.now(),
  };
}
