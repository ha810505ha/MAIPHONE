import assert from "node:assert/strict";
import {
  SSR_HARD_PITY_COUNTER,
  advanceGachaProgress,
  drawCards,
  getSsrRate,
  normalizeGachaProgress,
  rollRarity,
} from "../services/gacha/gachaDraw.js";
import {
  DEFAULT_GACHA_POOL_ID,
  GACHA_POOL_KINDS,
  getGachaPool,
  getGachaPoolCards,
  getGachaPoolLabel,
  isLimitedGachaPool,
  listGachaPools,
  normalizeGachaCardPool,
  resolveGachaPoolId,
} from "../data/gacha/cardPools.js";
import { GACHA_CARD_CATALOG, GACHA_CARD_CATEGORIES } from "../data/gacha/cardCatalog.js";

const RATES = { SSR: 6, SR: 24, R: 70 };
const fixed = (value) => () => value;
const sequence = (values) => {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
};
const POOL = [
  { id: "ssr-a", rarity: "SSR" },
  { id: "ssr-b", rarity: "SSR" },
  { id: "sr-a", rarity: "SR" },
  { id: "sr-b", rarity: "SR" },
  { id: "r-a", rarity: "R" },
  { id: "r-b", rarity: "R" },
];

// 固定亂數：機率區間邊界 [0, SSR) → SSR, [SSR, SSR+SR) → SR, 其餘 → R
const fresh = { totalDrawCount: 0, drawsSinceLastSSR: 0 };
assert.equal(rollRarity(RATES, fresh, fixed(0)), "SSR");
assert.equal(rollRarity(RATES, fresh, fixed(0.0599)), "SSR");
assert.equal(rollRarity(RATES, fresh, fixed(0.06)), "SR");
assert.equal(rollRarity(RATES, fresh, fixed(0.2999)), "SR");
assert.equal(rollRarity(RATES, fresh, fixed(0.3)), "R");
assert.equal(rollRarity(RATES, fresh, fixed(0.9999)), "R");

// 第 50～59 抽軟保底：drawsSinceLastSSR 49 仍為基礎，50 起每抽 +10%
assert.equal(getSsrRate(RATES, 49), 6);
for (let counter = 50; counter < SSR_HARD_PITY_COUNTER; counter += 1) {
  assert.equal(getSsrRate(RATES, counter), 6 + (counter - 49) * 10, `soft pity at counter ${counter}`);
}
assert.equal(getSsrRate(RATES, 58), 96);
assert.equal(getSsrRate(RATES, SSR_HARD_PITY_COUNTER), 100);
assert.equal(getSsrRate(RATES, 200), 100);
// 軟保底時 roll 落在提升後的區間內要出 SSR
assert.equal(rollRarity(RATES, { drawsSinceLastSSR: 50 }, fixed(0.15)), "SSR");
assert.equal(rollRarity(RATES, { drawsSinceLastSSR: 50 }, fixed(0.16)), "SR");

// 第 60 抽（計數 59）必 SSR，即使 roll 是最大值
assert.equal(rollRarity(RATES, { drawsSinceLastSSR: 59 }, fixed(0.999999)), "SSR");
const hard = drawCards({ pool: POOL, rates: RATES, progress: { totalDrawCount: 59, drawsSinceLastSSR: 59 }, count: 1, random: fixed(0.999999), now: 1000 });
assert.equal(hard.results[0].rarity, "SSR");
assert.equal(hard.progress.drawsSinceLastSSR, 0, "an SSR must reset the pity counter");
assert.equal(hard.progress.totalDrawCount, 60);

// 抽到 SSR 歸零、沒抽到 +1、上限 59
assert.deepEqual(advanceGachaProgress({ totalDrawCount: 10, drawsSinceLastSSR: 10 }, { rarity: "SSR" }), { totalDrawCount: 11, drawsSinceLastSSR: 0 });
assert.deepEqual(advanceGachaProgress({ totalDrawCount: 10, drawsSinceLastSSR: 10 }, { rarity: "R" }), { totalDrawCount: 11, drawsSinceLastSSR: 11 });
assert.deepEqual(advanceGachaProgress({ totalDrawCount: 70, drawsSinceLastSSR: 59 }, { rarity: "R" }), { totalDrawCount: 71, drawsSinceLastSSR: 59 });
assert.equal(normalizeGachaProgress({ totalDrawCount: -3, drawsSinceLastSSR: 99 }).drawsSinceLastSSR, 59);
assert.equal(normalizeGachaProgress(null).totalDrawCount, 0);

// 連抽：全程 R 時計數隨抽數累積
const allR = drawCards({ pool: POOL, rates: RATES, progress: fresh, count: 5, random: fixed(0.5), now: 1000 });
assert.equal(allR.results.length, 5);
assert.equal(allR.progress.totalDrawCount, 5);
assert.equal(allR.progress.drawsSinceLastSSR, 5);
assert.ok(allR.results.every((card) => card.rarity === "R"));
assert.ok(allR.results.every((card) => card.unlockedAt === 1000));
assert.ok(allR.results.every((card, index) => card.uid.startsWith(`1000-${index}-`)));

// 十連 SR 保底：十張都是 R → 最後一張升為 SR，保底計數不受影響
const ten = drawCards({ pool: POOL, rates: RATES, progress: fresh, count: 10, random: fixed(0.5), now: 2000 });
assert.equal(ten.results.length, 10);
assert.equal(ten.results[9].rarity, "SR");
assert.ok(ten.results[9].uid.startsWith("2000-sr-guarantee-"));
assert.equal(ten.results.slice(0, 9).filter((card) => card.rarity === "R").length, 9);
assert.equal(ten.progress.drawsSinceLastSSR, 10);
assert.equal(ten.progress.totalDrawCount, 10);
// 十連裡已有 SR 時不提升
const tenWithSr = drawCards({ pool: POOL, rates: RATES, progress: fresh, count: 10, random: sequence([0.1, 0.1, 0.5, ...Array(40).fill(0.5)]), now: 3000 });
assert.equal(tenWithSr.results[0].rarity, "SR");
assert.ok(!tenWithSr.results[9].uid.includes("sr-guarantee"));
// 單抽不套用十連保底
const single = drawCards({ pool: POOL, rates: RATES, progress: fresh, count: 1, random: fixed(0.5), now: 4000 });
assert.equal(single.results[0].rarity, "R");

// 卡池資料：id 唯一、稀有度只在 SSR／SR／R、分類合法、常駐池包含全部卡
const pool = getGachaPool(DEFAULT_GACHA_POOL_ID);
assert.deepEqual(pool.rates, RATES, "standard pool rates are 6/24/70 (decided 2026-10-13)");
const ids = GACHA_CARD_CATALOG.map((card) => card.id);
assert.equal(new Set(ids).size, ids.length, "card ids must be unique");
const validCategories = new Set(Object.values(GACHA_CARD_CATEGORIES));
for (const card of GACHA_CARD_CATALOG) {
  assert.ok(["SSR", "SR", "R"].includes(card.rarity), `invalid rarity on ${card.id}`);
  assert.ok(validCategories.has(card.category), `invalid category on ${card.id}`);
  assert.match(card.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `card id must be kebab-case: ${card.id}`);
  assert.ok(card.name && card.icon && card.quote, `card ${card.id} needs name/icon/quote`);
  assert.ok(Array.isArray(card.tags) && card.tags.length >= 3, `card ${card.id} needs at least 3 tags`);
  assert.ok(card.modeInterpretation?.reality && card.modeInterpretation?.online, `card ${card.id} needs mode interpretations`);
}
// 常駐池收錄固定的 20 張；替換題材使用新 ID，避免舊珍藏被改成另一張卡。
assert.equal(pool.cardIds.length, 20, "the standard pool lists exactly 20 card ids");
assert.equal(new Set(pool.cardIds).size, 20, "standard pool card ids must be unique");
const poolCards = getGachaPoolCards(DEFAULT_GACHA_POOL_ID);
assert.equal(poolCards.length, 20, "every standard pool id must resolve to a catalog card");
const rarityCount = { SSR: 0, SR: 0, R: 0 };
for (const card of poolCards) rarityCount[card.rarity] += 1;
assert.deepEqual(rarityCount, { SSR: 4, SR: 6, R: 10 }, "standard pool is SSR 4 / SR 6 / R 10");
assert.deepEqual(poolCards.map((card) => [card.id, card.name]), [
  ["pearl-of-sakura", "櫻瓣珍珠項鍊"],
  ["moonlit-promise", "月色下的約定"],
  ["letter-between-pages", "藏在書頁間的信"],
  ["sunlit-coast", "晴日海岸"],
  ["afternoon-latte", "午後的拿鐵"],
  ["rain-stalled-scooter", "雨夜熄火的機車"],
  ["local-train-detour", "一日區間車車票"],
  ["concert-exit-crowd", "演唱會散場"],
  ["pocket-candy", "口袋裡的糖果"],
  ["turned-tarot-card", "翻開的那張塔羅牌"],
  ["night-market-ring-toss", "夜市套圈圈"],
  ["claw-machine-cat", "夾娃娃機的貓玩偶"],
  ["shared-earbuds", "一人一邊耳機"],
  ["missed-stop-mrt", "坐過站的捷運"],
  ["street-corner-cat", "街角遇見的貓"],
  ["winter-hotpot-shop", "冬日火鍋店"],
  ["breakfast-shop-seat", "巷口早餐店的固定座位"],
  ["typhoon-shopping-list", "颱風前的採買清單"],
  ["selfie-filter", "自拍濾鏡"],
  ["crooked-picture-frame", "掛歪的畫框"],
]);
assert.ok(!pool.cardIds.includes("dream-invitation"), "dream-invitation stays out of the standard draw table");
const legacyIds = ["moonlit-promise", "pearl-of-sakura", "dream-invitation", "afternoon-latte", "stardust-jar", "unsent-letter"];
for (const id of legacyIds) assert.ok(ids.includes(id), `legacy card ${id} must stay in the catalog`);
assert.equal(GACHA_CARD_CATALOG.find((card) => card.id === "pearl-of-sakura")?.art, "/gacha/cards/pearl-of-sakura.png");
assert.equal(GACHA_CARD_CATALOG.find((card) => card.id === "dream-invitation")?.art, "/gacha/cards/dream-invitation.png");

// 常駐卡提供故事題材，不寫死關係；舊卡仍能在 catalog 查回原身分。
for (const [id, name] of [
  ["spare-key", "留下來的備用鑰匙"], ["extra-chopsticks", "多出來的一副碗筷"],
  ["unsent-letter", "未寄出的信"], ["parents-arriving-soon", "爸媽說半小時後到"],
  ["found-cat", "撿到的貓"], ["overtime-soy-milk", "加班後的豆漿店"],
  ["missing-assembly-step", "說明書上沒畫的那一步"],
]) {
  assert.equal(GACHA_CARD_CATALOG.find((card) => card.id === id)?.name, name, `withdrawn card ${id} keeps its identity`);
  assert.ok(!pool.cardIds.includes(id), `withdrawn card ${id} is no longer drawn`);
}
for (const card of poolCards) {
  assert.ok(typeof card.openingPrompt === "string" && card.openingPrompt.trim().length >= 20, `pool card ${card.id} needs an openingPrompt (story seed)`);
  assert.ok(Array.isArray(card.tone) && card.tone.length >= 2, `pool card ${card.id} needs a tone array`);
  assert.equal(Object.hasOwn(card, "relationshipFit"), false, `pool card ${card.id} must not prescribe a relationship stage`);
  assert.ok(card.tags.length <= 5, `pool card ${card.id} should keep tags to 3-5`);
  assert.ok(card.modeInterpretation.reality.trim() && card.modeInterpretation.online.trim(), `pool card ${card.id} needs reality/online interpretations`);
}

// 真正抽取各稀有度的每個候選，確保新卡可抽、移出卡不會被候選表帶回。
for (const [rarity, roll] of [["SSR", 0], ["SR", 0.1], ["R", 0.9]]) {
  const candidates = poolCards.filter((card) => card.rarity === rarity);
  for (let index = 0; index < candidates.length; index += 1) {
    const { results } = drawCards({ pool: poolCards, rates: RATES, progress: fresh, random: sequence([roll, (index + 0.5) / candidates.length, 0.5]), now: 4500, poolId: DEFAULT_GACHA_POOL_ID });
    assert.equal(results[0].id, candidates[index].id);
    assert.equal(results[0].poolId, DEFAULT_GACHA_POOL_ID);
  }
}

// MP-054：卡池標註
// drawCards 帶 poolId 時每張卡（含十連 SR 保底那張）都附 poolId；不帶時不寫入（由讀取端 normalize）
const tagged = drawCards({ pool: POOL, rates: RATES, progress: fresh, count: 10, random: fixed(0.5), now: 5000, poolId: DEFAULT_GACHA_POOL_ID });
assert.ok(tagged.results.every((card) => card.poolId === DEFAULT_GACHA_POOL_ID), "every drawn card carries poolId");
assert.ok(tagged.results[9].uid.includes("sr-guarantee") && tagged.results[9].poolId === DEFAULT_GACHA_POOL_ID, "SR guarantee card keeps poolId");
const untagged = drawCards({ pool: POOL, rates: RATES, progress: fresh, count: 1, random: fixed(0.5), now: 6000 });
assert.equal(Object.hasOwn(untagged.results[0], "poolId"), false, "poolId is only written when supplied");

// 舊庫存沒有 poolId → 常駐；未知 poolId → 常駐；已有合法 poolId 原物件不變（不改寫存檔）
const legacyCard = { id: "moonlit-promise", uid: "legacy-1", rarity: "SSR" };
const normalizedLegacy = normalizeGachaCardPool(legacyCard);
assert.equal(normalizedLegacy.poolId, DEFAULT_GACHA_POOL_ID, "legacy cards count as the standard pool");
assert.equal(Object.hasOwn(legacyCard, "poolId"), false, "normalize must not mutate the stored card");
assert.equal(normalizeGachaCardPool({ ...legacyCard, poolId: "no-such-pool" }).poolId, DEFAULT_GACHA_POOL_ID);
const alreadyTagged = { ...legacyCard, poolId: DEFAULT_GACHA_POOL_ID };
assert.equal(normalizeGachaCardPool(alreadyTagged), alreadyTagged, "already-tagged cards are returned as-is");
assert.equal(normalizeGachaCardPool(null), null);
assert.equal(resolveGachaPoolId(undefined), DEFAULT_GACHA_POOL_ID);
assert.equal(resolveGachaPoolId(DEFAULT_GACHA_POOL_ID), DEFAULT_GACHA_POOL_ID);

// 卡池 label 四語齊全、kind 合法、常駐池不是限定池
const validKinds = new Set(Object.values(GACHA_POOL_KINDS));
for (const poolEntry of listGachaPools()) {
  assert.ok(validKinds.has(poolEntry.kind), `pool ${poolEntry.id} has invalid kind`);
  for (const locale of ["zh-TW", "en", "ja", "ko"]) {
    assert.ok(typeof poolEntry.label?.[locale] === "string" && poolEntry.label[locale].trim(), `pool ${poolEntry.id} is missing label.${locale}`);
    assert.equal(getGachaPoolLabel(poolEntry.id, locale), poolEntry.label[locale]);
  }
  assert.ok(getGachaPoolLabel(poolEntry.id, "zh-CN").trim(), `pool ${poolEntry.id} must resolve a zh-CN label`);
}
assert.equal(getGachaPool(DEFAULT_GACHA_POOL_ID).kind, GACHA_POOL_KINDS.standard);
assert.equal(isLimitedGachaPool(DEFAULT_GACHA_POOL_ID), false);
assert.equal(isLimitedGachaPool(undefined), false, "legacy cards are never limited");
assert.equal(getGachaPoolLabel(undefined, "en"), getGachaPool(DEFAULT_GACHA_POOL_ID).label.en, "missing poolId resolves to the standard label");
assert.equal(getGachaPoolLabel(DEFAULT_GACHA_POOL_ID, "zh-TW"), "常駐");

// listGachaPools：常駐池永遠第一，順序穩定、id 唯一；目前只有一池（珍藏篩選列不出現卡池 chip）
const listed = listGachaPools();
assert.ok(listed.length >= 1);
assert.equal(listed[0].id, DEFAULT_GACHA_POOL_ID, "standard pool must be listed first");
assert.equal(new Set(listed.map((entry) => entry.id)).size, listed.length, "pool ids must be unique");
assert.deepEqual(listGachaPools().map((entry) => entry.id), listed.map((entry) => entry.id), "pool order must be stable");
assert.equal(listed.length > 1, false, "only one pool is defined today; update this expectation when a limited pool ships");

console.log("ok: gacha draw rates, pity counters, ten-pull guarantee, card pool integrity, and pool labels (MP-054)");
