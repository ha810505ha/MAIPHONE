import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { STORE_PRODUCTS, STORE_PURCHASES_ENTITY_KEY, STORE_PURCHASE_HISTORY_LIMIT } from "../constants/storeProducts.js";
import { FEATURE_EXPORTS } from "../constants/featureStoreKeys.js";
import { SUPER_LIKE_MAX } from "../constants/dating.js";
import {
  appendPurchase, countPurchasesInPeriod, createStorePurchases, evaluatePurchase, findStoreProduct, getLimitPeriodKey, getTaipeiDayKey,
  normalizeStorePurchases, remainingInPeriod, validateStoreProducts, visibleStoreProducts,
} from "../services/store/storeService.js";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const source = (file) => readFile(resolve(projectRoot, file), "utf8");
// 台北 = UTC+8，無夏令時間。2026-10-12 是週一。
const taipei = (y, m, d, hh = 0, mm = 0) => Date.UTC(y, m - 1, d, hh - 8, mm);

// ---- 商品表合法 ----
assert.deepEqual(validateStoreProducts(), [], "store products must pass validation");
const superLike = findStoreProduct("superLike1");
assert.ok(superLike, "Super Like ×1 must exist");
assert.equal(superLike.price, 300);
assert.deepEqual(superLike.limit, { per: "week", count: 3 });
assert.deepEqual(superLike.grant, { type: "superLike", amount: 1 });
assert.equal(superLike.requiresFlag, "dating");
assert.ok(STORE_PRODUCTS.every((item) => item.price > 0 && Number.isInteger(item.price)), "prices are positive integers (crystals only)");
// 健檢要抓得到壞資料。
assert.ok(validateStoreProducts([{ id: "x", name: { "zh-TW": "x" }, icon: "", price: 0, limit: { per: "month", count: 1 }, grant: { type: "cash", amount: 0 } }]).length >= 6);
assert.ok(validateStoreProducts([superLike, superLike]).some((message) => message.includes("duplicate id")));

// ---- 旗標過濾 ----
assert.equal(visibleStoreProducts({ dating: true }).length, 1);
assert.equal(visibleStoreProducts({ dating: false }).length, 0, "Super Like hides when dating is off");
assert.equal(visibleStoreProducts({}).length, 0);
assert.equal(visibleStoreProducts({ dating: true }, [{ id: "free", price: 1 }]).length, 1, "products without requiresFlag always show");

// ---- 週／日 key ----
assert.equal(getLimitPeriodKey(superLike, taipei(2026, 10, 11, 23, 59)), "2026-10-05", "Sunday night belongs to the previous week");
assert.equal(getLimitPeriodKey(superLike, taipei(2026, 10, 12, 0, 0)), "2026-10-12", "Monday 00:00 Taipei starts a new week");
assert.equal(getLimitPeriodKey({ limit: { per: "day", count: 1 } }, Date.UTC(2026, 9, 11, 16, 30)), "2026-10-12", "UTC Sunday 16:30 is already Monday in Taipei");
assert.equal(getTaipeiDayKey(Date.UTC(2026, 9, 11, 15, 59)), "2026-10-11");
assert.equal(getLimitPeriodKey({ limit: null }), "");
assert.equal(getLimitPeriodKey({}), "");

// ---- 限購計算 ----
const monday = taipei(2026, 10, 12, 10);
const buy = (at, extra = {}) => ({ id: `p-${at}`, productId: "superLike1", at, price: 300, weekKey: "2026-10-12", ...extra });
assert.equal(remainingInPeriod([], superLike, monday), 3);
assert.equal(remainingInPeriod([buy(monday)], superLike, monday), 2);
assert.equal(remainingInPeriod([buy(monday), buy(monday + 1), buy(monday + 2)], superLike, monday), 0);
assert.equal(remainingInPeriod([buy(monday), buy(monday + 1), buy(monday + 2), buy(monday + 3)], superLike, monday), 0, "never negative");
// 上週買的不算這週。
assert.equal(remainingInPeriod([buy(taipei(2026, 10, 11, 23), { weekKey: "2026-10-05" })], superLike, monday), 3);
// 舊紀錄沒有 weekKey 時用 at 回推。
assert.equal(countPurchasesInPeriod([buy(monday, { weekKey: "" })], superLike, monday), 1);
assert.equal(countPurchasesInPeriod([buy(taipei(2026, 10, 11, 23), { weekKey: "" })], superLike, monday), 0);
// 別的商品不互相佔額度。
assert.equal(countPurchasesInPeriod([{ ...buy(monday), productId: "other" }], superLike, monday), 0);
// 不限購。
assert.equal(remainingInPeriod([buy(monday)], { id: "superLike1", limit: null }, monday), Infinity);
// 每日限購。
const daily = { id: "superLike1", limit: { per: "day", count: 1 } };
assert.equal(remainingInPeriod([buy(monday)], daily, monday), 0);
assert.equal(remainingInPeriod([buy(monday)], daily, monday + 24 * 60 * 60 * 1000), 1);

// ---- 購買前檢查順序：商品 → 限購 → Super Like 上限 → 餘額 ----
const cap = (current) => ({ superLike: { current, max: SUPER_LIKE_MAX } });
assert.deepEqual(evaluatePurchase({ product: superLike, purchases: [], crystals: 300, grantCap: cap(3), now: monday }), { ok: true, reason: "" });
assert.equal(evaluatePurchase({ product: null, purchases: [], crystals: 999 }).reason, "unknownProduct");
assert.equal(evaluatePurchase({ product: superLike, purchases: [], crystals: 299, grantCap: cap(3), now: monday }).reason, "insufficientCrystals");
assert.equal(evaluatePurchase({ product: superLike, purchases: [], crystals: 0, grantCap: cap(3), now: monday }).reason, "insufficientCrystals");
assert.equal(evaluatePurchase({ product: superLike, purchases: [buy(monday), buy(monday + 1), buy(monday + 2)], crystals: 9999, grantCap: cap(3), now: monday }).reason, "limitReached");
assert.equal(evaluatePurchase({ product: superLike, purchases: [], crystals: 9999, grantCap: cap(SUPER_LIKE_MAX), now: monday }).reason, "grantCapReached");
assert.equal(evaluatePurchase({ product: superLike, purchases: [], crystals: 9999, grantCap: cap(SUPER_LIKE_MAX - 1), now: monday }).ok, true);
// 沒給 grantCap 時不擋（例如信風沒掛 context）。
assert.equal(evaluatePurchase({ product: superLike, purchases: [], crystals: 300, now: monday }).ok, true);

// ---- 購買紀錄 normalize 與舊資料相容 ----
assert.deepEqual(createStorePurchases(), { purchases: [] });
assert.deepEqual(normalizeStorePurchases(null), { purchases: [] });
assert.deepEqual(normalizeStorePurchases("bad"), { purchases: [] });
assert.deepEqual(normalizeStorePurchases({ purchases: "bad" }), { purchases: [] });
// 舊版可能直接存陣列。
assert.equal(normalizeStorePurchases([buy(monday)]).purchases.length, 1);
const messy = normalizeStorePurchases({ purchases: [
  null, "x", { productId: "" }, { productId: 5 },
  { productId: "superLike1", at: "oops", price: "300" },
  { productId: "superLike1", at: monday + 5, price: 300, weekKey: 7 },
  buy(monday),
] });
assert.equal(messy.purchases.length, 3, "broken entries are dropped, not fatal");
assert.equal(messy.purchases[0].at, monday + 5, "sorted newest first");
assert.equal(messy.purchases[0].weekKey, "", "non-string weekKey becomes empty and is recomputed from at");
assert.equal(messy.purchases[2].at, 0);
assert.equal(messy.purchases[2].price, 300);
assert.equal(messy.purchases[2].id, "sp-0-superLike1", "missing id gets a stable fallback");
const many = normalizeStorePurchases({ purchases: Array.from({ length: STORE_PURCHASE_HISTORY_LIMIT + 50 }, (_, index) => buy(index)) });
assert.equal(many.purchases.length, STORE_PURCHASE_HISTORY_LIMIT);

// ---- appendPurchase ----
const first = appendPurchase(createStorePurchases(), superLike, monday);
assert.equal(first.purchases.length, 1);
assert.equal(first.purchases[0].productId, "superLike1");
assert.equal(first.purchases[0].price, 300);
assert.equal(first.purchases[0].weekKey, "2026-10-12");
assert.equal(first.purchases[0].at, monday);
assert.match(first.purchases[0].id, /^sp-/);
const second = appendPurchase(first, superLike, monday + 1);
assert.equal(second.purchases.length, 2);
assert.equal(second.purchases[0].at, monday + 1, "newest first");
assert.equal(first.purchases.length, 1, "does not mutate the previous state");
assert.equal(remainingInPeriod(second.purchases, superLike, monday + 2), 1);
assert.notEqual(first.purchases[0].id, second.purchases[0].id);

// ---- 存檔 key 已接進備份管線 ----
assert.equal(STORE_PURCHASES_ENTITY_KEY, "ent_storePurchases");
assert.deepEqual(FEATURE_EXPORTS.storePurchases, ["ent_storePurchases", null], "storePurchases must be exported with backups");
const [storage, backup, flags, app, router, loginReward, panel] = await Promise.all([
  source("utils/indexedDbStorage.js"), source("services/featureBackupService.js"), source("config/featureFlags.js"), source("MaliPhone.jsx"),
  source("components/apps/AppRouter.jsx"), source("components/apps/LoginRewardApp.jsx"), source("components/dating/DatingSystemPanel.jsx"),
]);
assert.match(storage, /"ent_storePurchases"/, "IndexedDB must accept the store entity");
assert.match(backup, /put\("storePurchases", data\.storePurchases\)/, "backup restore must write store purchases");
assert.match(flags, /STORE_ENABLED\s*=\s*readFeatureFlag\("VITE_STORE_ENABLED", false\)/, "store must be off by default");
assert.match(app, /appId\s*!==\s*"store"\s*\|\|\s*STORE_ENABLED/, "navigation must block the store when the flag is off");
assert.match(app, /app\.id\s*!==\s*"store"\s*\|\|\s*STORE_ENABLED/, "home screen must hide the store when the flag is off");
assert.match(app, /<DatingActionsProvider value=\{datingActions\}>/, "store and login reward need the dating actions context");
assert.match(router, /case "store": return withSuspense\(<StoreApp/, "router must lazy-load the store app");
assert.match(loginReward, /grantSuperLikes\(SUPER_LIKE_LOGIN_STREAK_REWARD, "loginStreak"\)/, "day 7 login must grant a Super Like");
assert.match(panel, /item\.status === "granted"/, "system panel must render granted log entries");
for (const key of ["weekly", "contact", "report", "shop", "loginStreak"]) assert.match(panel, new RegExp(`\\b${key}: \\(tr\\)`), `panel must label the ${key} grant source`);

console.log("ok: store products, weekly limits, purchase history, and feature wiring stay consistent");
