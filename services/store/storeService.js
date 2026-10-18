// 商店純函式（MP-051）：限購計算、週／日 key、購買紀錄 normalize。
// 不碰 React、IndexedDB 或 GachaContext，方便在 Node 測試。
import { getTaipeiWeekKey } from "../dating/datingMatching.js";
import { STORE_PRODUCTS, STORE_PURCHASE_HISTORY_LIMIT } from "../../constants/storeProducts.js";

const taipeiDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
});

/** 台北當地日期（YYYY-MM-DD），每日限購用。 */
export function getTaipeiDayKey(now = Date.now()) {
  return taipeiDayFormatter.format(new Date(now));
}

/** 依商品限購週期回傳這一期的 key；不限購回傳 ""。 */
export function getLimitPeriodKey(product, now = Date.now()) {
  const per = product?.limit?.per;
  if (per === "week") return getTaipeiWeekKey(now);
  if (per === "day") return getTaipeiDayKey(now);
  return "";
}

export const createStorePurchases = () => ({ purchases: [] });

const isPositiveInt = (value) => Number.isInteger(value) && value > 0;

/** 把舊或壞掉的存檔整理成 { purchases: [...] }；壞的單筆直接丟掉，不讓整個商店打不開。 */
export function normalizeStorePurchases(src) {
  const list = Array.isArray(src?.purchases) ? src.purchases : Array.isArray(src) ? src : [];
  const purchases = list
    .filter((item) => item && typeof item === "object" && typeof item.productId === "string" && item.productId)
    .map((item) => ({
      id: typeof item.id === "string" && item.id ? item.id : `sp-${Number(item.at) || 0}-${item.productId}`,
      productId: item.productId,
      at: Number.isFinite(Number(item.at)) ? Number(item.at) : 0,
      price: Math.max(0, Math.round(Number(item.price) || 0)),
      weekKey: typeof item.weekKey === "string" ? item.weekKey : "",
    }))
    .sort((a, b) => b.at - a.at)
    .slice(0, STORE_PURCHASE_HISTORY_LIMIT);
  return { purchases };
}

/** 這一期已買幾個。週限用 weekKey 比對（舊紀錄沒有 weekKey 時用 at 回推）；日限用 at 回推。 */
export function countPurchasesInPeriod(purchases, product, now = Date.now()) {
  const per = product?.limit?.per;
  if (!per) return 0;
  const periodKey = getLimitPeriodKey(product, now);
  return (Array.isArray(purchases) ? purchases : []).filter((item) => {
    if (item?.productId !== product.id) return false;
    if (per === "week") return (item.weekKey || getTaipeiWeekKey(item.at)) === periodKey;
    return getTaipeiDayKey(item.at) === periodKey;
  }).length;
}

/** 這一期還能買幾個；不限購回傳 Infinity。 */
export function remainingInPeriod(purchases, product, now = Date.now()) {
  if (!product?.limit?.per) return Infinity;
  const count = Math.max(0, Number(product.limit.count) || 0);
  return Math.max(0, count - countPurchasesInPeriod(purchases, product, now));
}

export const findStoreProduct = (productId, products = STORE_PRODUCTS) => products.find((item) => item.id === productId) || null;

/** 依功能旗標過濾可見商品。flags 例：{ dating: true, gacha: false }。 */
export function visibleStoreProducts(flags = {}, products = STORE_PRODUCTS) {
  return products.filter((product) => !product.requiresFlag || !!flags[product.requiresFlag]);
}

/**
 * 購買前檢查，回傳 { ok, reason }。reason：
 * "unknownProduct"｜"limitReached"｜"insufficientCrystals"｜"grantCapReached"。
 * grantCap：{ superLike: { current, max } }，用來擋 Super Like 已達 9 的情況。
 */
export function evaluatePurchase({ product, purchases, crystals, grantCap = {}, now = Date.now() }) {
  if (!product || !isPositiveInt(product.price)) return { ok: false, reason: "unknownProduct" };
  if (remainingInPeriod(purchases, product, now) <= 0) return { ok: false, reason: "limitReached" };
  const cap = grantCap[product.grant?.type];
  if (cap && Number.isFinite(cap.max) && Number(cap.current) >= cap.max) return { ok: false, reason: "grantCapReached" };
  if ((Number(crystals) || 0) < product.price) return { ok: false, reason: "insufficientCrystals" };
  return { ok: true, reason: "" };
}

/** 寫一筆購買紀錄（最新在前），回傳新的 { purchases }。 */
export function appendPurchase(state, product, now = Date.now()) {
  const current = normalizeStorePurchases(state);
  const entry = {
    id: `sp-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    productId: product.id,
    at: now,
    price: product.price,
    weekKey: getTaipeiWeekKey(now),
  };
  return { purchases: [entry, ...current.purchases].slice(0, STORE_PURCHASE_HISTORY_LIMIT) };
}

/** 商品表健檢，給測試與開發用；回傳錯誤訊息陣列，空陣列代表合法。 */
export function validateStoreProducts(products = STORE_PRODUCTS) {
  const errors = [];
  const ids = new Set();
  for (const product of products) {
    const tag = `product ${product?.id || "?"}`;
    if (!product?.id || typeof product.id !== "string") errors.push(`${tag}: id required`);
    else if (ids.has(product.id)) errors.push(`${tag}: duplicate id`);
    ids.add(product?.id);
    for (const field of ["name", "description"]) {
      for (const locale of ["zh-TW", "en", "ja", "ko"]) {
        if (!product?.[field]?.[locale]) errors.push(`${tag}: ${field}.${locale} missing`);
      }
    }
    if (!product?.icon) errors.push(`${tag}: icon required`);
    if (!isPositiveInt(product?.price)) errors.push(`${tag}: price must be a positive integer`);
    const limit = product?.limit;
    if (limit && limit.per !== null && !["week", "day"].includes(limit.per)) errors.push(`${tag}: limit.per must be week, day or null`);
    if (limit?.per && !isPositiveInt(limit.count)) errors.push(`${tag}: limit.count must be a positive integer`);
    if (!["superLike"].includes(product?.grant?.type)) errors.push(`${tag}: unsupported grant.type`);
    if (!isPositiveInt(product?.grant?.amount)) errors.push(`${tag}: grant.amount must be a positive integer`);
    if (product?.requiresFlag && !["dating", "gacha"].includes(product.requiresFlag)) errors.push(`${tag}: unknown requiresFlag`);
  }
  return errors;
}
