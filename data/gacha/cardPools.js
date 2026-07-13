import { GACHA_CARD_CATALOG, getGachaCardsByIds } from "./cardCatalog";

export const DEFAULT_GACHA_POOL_ID = "sakura-vow-standard";

/**
 * 卡池只負責收錄範圍與抽率，不重複保存卡片內容。
 * 未來可新增期間限定、節慶或主題卡池，並重複引用卡片庫中的既有卡片。
 */
export const GACHA_POOLS = Object.freeze({
  [DEFAULT_GACHA_POOL_ID]: {
    id: DEFAULT_GACHA_POOL_ID,
    name: "櫻色誓約",
    rates: { SSR: 4, SR: 26, R: 70 },
    cardIds: GACHA_CARD_CATALOG.map((card) => card.id),
  },
});

export function getGachaPool(poolId = DEFAULT_GACHA_POOL_ID) {
  return GACHA_POOLS[poolId] || null;
}

export function getGachaPoolCards(poolId = DEFAULT_GACHA_POOL_ID) {
  const pool = getGachaPool(poolId);
  return pool ? getGachaCardsByIds(pool.cardIds) : [];
}
