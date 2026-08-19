export const REALITY_OUTPUT_TOKENS_DEFAULT = 4000;
export const REALITY_OUTPUT_TOKENS_MIN = 1500;
export const REALITY_OUTPUT_TOKENS_MAX = 10000;
export const REALITY_OUTPUT_TOKENS_STEP = 100;

export const normalizeRealityOutputTokens = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return REALITY_OUTPUT_TOKENS_DEFAULT;
  return Math.max(REALITY_OUTPUT_TOKENS_MIN, Math.min(REALITY_OUTPUT_TOKENS_MAX, Math.round(parsed)));
};

export const getRealityThinkingBudget = (maxOutputTokens) => Math.max(
  256,
  Math.min(1536, Math.round(normalizeRealityOutputTokens(maxOutputTokens) * 0.25)),
);

export const getRealityProseRange = (maxOutputTokens) => {
  const tokens = normalizeRealityOutputTokens(maxOutputTokens);
  if (tokens <= 2000) return { min: 300, max: 650 };
  if (tokens <= 3500) return { min: 500, max: 1100 };
  if (tokens <= 5000) return { min: 700, max: 1500 };
  if (tokens <= 7500) return { min: 900, max: 2000 };
  return { min: 1200, max: 2600 };
};
