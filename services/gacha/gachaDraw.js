/**
 * 櫻色誓約抽卡純函式（MP-049）。
 *
 * 所有亂數與時間都由參數注入，方便在 Node 測試中固定結果。
 * 規則與 GachaContext 先前的內嵌實作完全一致：
 * - SSR 軟保底：自第 50 抽（drawsSinceLastSSR = 50）起，每抽 SSR 機率 +10%
 * - 第 60 抽（drawsSinceLastSSR = 59）必出 SSR
 * - 抽到 SSR 時計數歸零，否則 +1，上限 59
 * - 十連若沒有任何 SR 以上，最後一張提升為 SR（不影響保底計數）
 */

export const DEFAULT_GACHA_RATES = Object.freeze({ SSR: 6, SR: 24, R: 70 });
export const SSR_SOFT_PITY_START = 50;
export const SSR_SOFT_PITY_STEP = 10;
export const SSR_HARD_PITY_COUNTER = 59;
export const SINGLE_DRAW_COST = 180;
export const TEN_DRAW_COST = 1800;

const toCounter = (value) => Math.max(0, Number(value) || 0);

export function normalizeGachaProgress(progress) {
  const source = progress && typeof progress === "object" ? progress : {};
  return {
    totalDrawCount: toCounter(source.totalDrawCount),
    drawsSinceLastSSR: Math.min(SSR_HARD_PITY_COUNTER, toCounter(source.drawsSinceLastSSR)),
  };
}

export function getSsrRate(rates = DEFAULT_GACHA_RATES, drawsSinceLastSSR = 0) {
  const base = Number(rates?.SSR) || 0;
  const counter = toCounter(drawsSinceLastSSR);
  if (counter >= SSR_HARD_PITY_COUNTER) return 100;
  if (counter >= SSR_SOFT_PITY_START) {
    return Math.min(100, base + (counter - (SSR_SOFT_PITY_START - 1)) * SSR_SOFT_PITY_STEP);
  }
  return base;
}

export function rollRarity(rates = DEFAULT_GACHA_RATES, progress = { drawsSinceLastSSR: 0 }, random = Math.random) {
  const roll = random() * 100;
  const ssrRate = getSsrRate(rates, progress?.drawsSinceLastSSR);
  const srRate = Number(rates?.SR) || 0;
  if (roll < ssrRate) return "SSR";
  if (roll < ssrRate + srRate) return "SR";
  return "R";
}

export function pickCardByRarity(pool = [], rarity, random = Math.random) {
  const candidates = pool.filter((item) => item.rarity === rarity);
  return candidates[Math.floor(random() * candidates.length)] || pool[0] || null;
}

export function drawOne({ pool = [], rates = DEFAULT_GACHA_RATES, progress, random = Math.random } = {}) {
  const rarity = rollRarity(rates, progress, random);
  return pickCardByRarity(pool, rarity, random);
}

export function advanceGachaProgress(progress, card) {
  const current = progress && typeof progress === "object" ? progress : {};
  const wasSSR = card?.rarity === "SSR";
  return {
    totalDrawCount: (Number(current.totalDrawCount) || 0) + 1,
    drawsSinceLastSSR: wasSSR ? 0 : Math.min(SSR_HARD_PITY_COUNTER, (Number(current.drawsSinceLastSSR) || 0) + 1),
  };
}

export function getGachaDrawCost(count) {
  return count === 10 ? TEN_DRAW_COST : SINGLE_DRAW_COST;
}

const uidSuffix = (random) => random().toString(36).slice(2);

/**
 * 抽 count 張卡，回傳 { results, progress }。
 * results 每張附 uid、unlockedAt 與 poolId（MP-054：珍藏角標用）；progress 為更新後的保底計數。
 */
export function drawCards({ pool = [], rates = DEFAULT_GACHA_RATES, progress, count = 1, random = Math.random, now = Date.now(), poolId } = {}) {
  let nextProgress = { ...(progress && typeof progress === "object" ? progress : { totalDrawCount: 0, drawsSinceLastSSR: 0 }) };
  const results = Array.from({ length: count }, (_, index) => {
    const card = drawOne({ pool, rates, progress: nextProgress, random });
    nextProgress = advanceGachaProgress(nextProgress, card);
    return { ...card, uid: `${now}-${index}-${uidSuffix(random)}`, unlockedAt: now, ...(poolId ? { poolId } : {}) };
  });
  if (count === 10 && !results.some((item) => item.rarity === "SSR" || item.rarity === "SR")) {
    const srCandidates = pool.filter((item) => item.rarity === "SR");
    const promoted = srCandidates[Math.floor(random() * srCandidates.length)];
    if (promoted) results[results.length - 1] = { ...promoted, uid: `${now}-sr-guarantee-${uidSuffix(random)}`, unlockedAt: now, ...(poolId ? { poolId } : {}) };
  }
  return { results, progress: nextProgress };
}
