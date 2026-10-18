import { getGachaCardsByIds } from "./cardCatalog.js";
import { translate } from "../../utils/i18n.js";

export const DEFAULT_GACHA_POOL_ID = "sakura-vow-standard";

export const GACHA_POOL_KINDS = Object.freeze({ standard: "standard", limited: "limited" });

/**
 * 卡池只負責收錄範圍與抽率，不重複保存卡片內容。
 * 每個卡池欄位：
 * - id：存進珍藏卡片的 poolId（舊存檔沒有 poolId 一律視為常駐池）
 * - kind：`standard`（常駐）或 `limited`（期間限定／主題池）
 * - label：卡片角標顯示的短名稱，四語物件（簡中由翻譯管線自動轉）
 * - rates：SSR／SR／R 抽率（%）
 * - cardIds：收錄卡片 id，重複引用 cardCatalog 既有卡片
 *
 * 新增限定池時直接在下方加一筆即可，UI 與篩選列會依 `listGachaPools()` 順序自動出現，例如：
 * ```js
 * "sakura-vow-starlight": {
 *   id: "sakura-vow-starlight",
 *   kind: GACHA_POOL_KINDS.limited,
 *   name: "星夜限定",
 *   label: { "zh-TW": "星夜限定", en: "Starlight", ja: "星夜限定", ko: "별밤 한정" },
 *   rates: { SSR: 6, SR: 24, R: 70 },
 *   cardIds: ["moonlit-promise", "stardust-jar"],
 * },
 * ```
 */
/** 常駐 20 張：SSR 4／SR 6／R 10；未收錄的舊卡保留於 catalog。 */
export const STANDARD_POOL_CARD_IDS = Object.freeze([
  "pearl-of-sakura",
  "moonlit-promise",
  "letter-between-pages",
  "sunlit-coast",
  "afternoon-latte",
  "rain-stalled-scooter",
  "local-train-detour",
  "concert-exit-crowd",
  "pocket-candy",
  "turned-tarot-card",
  "night-market-ring-toss",
  "claw-machine-cat",
  "shared-earbuds",
  "missed-stop-mrt",
  "street-corner-cat",
  "winter-hotpot-shop",
  "breakfast-shop-seat",
  "typhoon-shopping-list",
  "selfie-filter",
  "crooked-picture-frame",
]);

export const GACHA_POOLS = Object.freeze({
  [DEFAULT_GACHA_POOL_ID]: {
    id: DEFAULT_GACHA_POOL_ID,
    kind: GACHA_POOL_KINDS.standard,
    name: "櫻色誓約",
    label: Object.freeze({ "zh-TW": "常駐", en: "Standard", ja: "常設", ko: "상시" }),
    rates: { SSR: 6, SR: 24, R: 70 },
    cardIds: STANDARD_POOL_CARD_IDS,
  },
});

export function getGachaPool(poolId = DEFAULT_GACHA_POOL_ID) {
  return GACHA_POOLS[poolId] || null;
}

export function getGachaPoolCards(poolId = DEFAULT_GACHA_POOL_ID) {
  const pool = getGachaPool(poolId);
  return pool ? getGachaCardsByIds(pool.cardIds) : [];
}

/** 依定義順序回傳所有卡池（常駐池永遠排第一）。 */
export function listGachaPools() {
  const pools = Object.values(GACHA_POOLS);
  return [
    ...pools.filter((pool) => pool.id === DEFAULT_GACHA_POOL_ID),
    ...pools.filter((pool) => pool.id !== DEFAULT_GACHA_POOL_ID),
  ];
}

/** 舊庫存卡沒有 poolId 時視為常駐；未知 poolId 也回到常駐，避免顯示空標籤。 */
export function resolveGachaPoolId(poolId) {
  return typeof poolId === "string" && GACHA_POOLS[poolId] ? poolId : DEFAULT_GACHA_POOL_ID;
}

export function getGachaPoolLabel(poolId, locale = "zh-TW") {
  const pool = getGachaPool(resolveGachaPoolId(poolId));
  return pool ? translate(locale, pool.label) : "";
}

export function isLimitedGachaPool(poolId) {
  return getGachaPool(resolveGachaPoolId(poolId))?.kind === GACHA_POOL_KINDS.limited;
}

/** 讀取時補 poolId，不改寫原物件（存檔維持原樣）。 */
export function normalizeGachaCardPool(card) {
  if (!card || typeof card !== "object") return card;
  const poolId = resolveGachaPoolId(card.poolId);
  return card.poolId === poolId ? card : { ...card, poolId };
}
