// 丹房坊市：煉製佇列與貨架販售都用時間戳回算，無計時器。
import { CROPS } from "../data/crops";
import { RECIPES } from "../data/recipes";
import { hasUnlock } from "./cultivation";

export const SELL_INTERVAL_SEC = 1200; // 貨架每 20 分鐘自動賣出 1 件

// 物品目錄：作物 + 種子 + 丹藥
const ITEMS = {};
CROPS.forEach((c) => {
  ITEMS[c.id] = { name: c.name, icon: c.icon, sellPrice: c.sellPrice };
  ITEMS[`${c.id}_seed`] = { name: `${c.name}種子`, icon: "🌰", sellPrice: Math.ceil((c.seedCost || 20) / 2) };
});
RECIPES.forEach((r) => { ITEMS[r.id] = { name: r.name, icon: r.icon, sellPrice: r.sellPrice }; });
export const itemMeta = (id) => ITEMS[id] || { name: id, icon: "❓", sellPrice: 1 };

export const recipeById = (id) => RECIPES.find((r) => r.id === id);
export const recipeUnlocked = (r, cultivation) => !r.needUnlock || hasUnlock(cultivation, r.needUnlock);
export const maxBatch = (save, r) =>
  Math.min(...Object.entries(r.in).map(([k, n]) => Math.floor((save.inventory[k] || 0) / n)));

// ---- 丹爐 ----
export function startCraft(save, recipeId, batch, now = Date.now()) {
  const f = save.shop.furnace;
  const r = recipeById(recipeId);
  if (!r || f.recipeId || batch < 1) return "丹爐忙碌中";
  if (maxBatch(save, r) < batch) return "材料不足";
  for (const [k, n] of Object.entries(r.in)) save.inventory[k] -= n * batch;
  f.recipeId = recipeId;
  f.startedAt = now;
  f.batch = batch;
  return null;
}

export function furnaceDone(f, now = Date.now()) {
  if (!f.recipeId) return 0;
  const r = recipeById(f.recipeId);
  return Math.min(f.batch, Math.floor((now - f.startedAt) / (r.craftMin * 60000)));
}

export function collectFurnace(save, now = Date.now()) {
  const f = save.shop.furnace;
  const done = furnaceDone(f, now);
  if (done < 1) return null;
  const r = recipeById(f.recipeId);
  save.inventory[r.id] = (save.inventory[r.id] || 0) + done * r.outCount;
  if (done >= f.batch) {
    f.recipeId = null; f.startedAt = null; f.batch = 0;
  } else {
    f.batch -= done;
    f.startedAt += done * r.craftMin * 60000; // 剩餘的照原節奏續煉
  }
  return { recipe: r, count: done * r.outCount };
}

// ---- 貨架 ----
export function stockShelf(save, shelfIdx, itemId, now = Date.now()) {
  const sh = save.shop.shelves[shelfIdx];
  const have = save.inventory[itemId] || 0;
  if (!sh || sh.itemId || have < 1) return "無法上架";
  sh.itemId = itemId;
  sh.stock = have;
  sh.soldUpdatedAt = now;
  save.inventory[itemId] = 0;
  return null;
}

export function unstockShelf(save, shelfIdx) {
  const sh = save.shop.shelves[shelfIdx];
  if (!sh || !sh.itemId) return;
  save.inventory[sh.itemId] = (save.inventory[sh.itemId] || 0) + sh.stock;
  sh.itemId = null; sh.stock = 0; sh.soldUpdatedAt = null;
}

// 依 soldUpdatedAt 回算已賣出量（保留未滿一件的零頭時間）
export function settleShelves(save, now = Date.now()) {
  let sold = 0, earned = 0;
  for (const sh of save.shop.shelves) {
    if (!sh.itemId || sh.stock < 1) continue;
    const n = Math.min(sh.stock, Math.floor((now - sh.soldUpdatedAt) / (SELL_INTERVAL_SEC * 1000)));
    if (n < 1) continue;
    sh.stock -= n;
    sh.soldUpdatedAt += n * SELL_INTERVAL_SEC * 1000;
    const gain = n * itemMeta(sh.itemId).sellPrice;
    save.coins += gain;
    sold += n; earned += gain;
    if (sh.stock < 1) { sh.itemId = null; sh.soldUpdatedAt = null; }
  }
  return { sold, earned };
}

// ---- 行商訂單（每日固定 3 張：普通／進階／稀有）----
const dayStr = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

export function refreshOrders(save, now = Date.now()) {
  const s = save.shop;
  if (s.lastOrderDay === dayStr(now)) return false;
  const rareItem = hasUnlock(save.cultivation, "recipe_ningshen") ? "ningshen" : "huiqi";
  const specs = [
    { tier: "普通", itemId: "qingling", count: 4 + Math.floor(Math.random() * 3), rewardCoins: 55, rewardCrystals: 8 },
    { tier: "進階", itemId: "yuehua", count: 3 + Math.floor(Math.random() * 3), rewardCoins: 120, rewardCrystals: 15 },
    { tier: "稀有", itemId: rareItem, count: 2 + Math.floor(Math.random() * 2), rewardCoins: 230, rewardCrystals: 27 },
  ];
  s.orders = specs.map((spec, i) => ({ id: `${dayStr(now)}-${i}`, ...spec, done: false }));
  s.lastOrderDay = dayStr(now);
  return true;
}

// 交付訂單。成功回傳 { rewardCoins, rewardCrystals }，失敗回傳字串錯誤。
export function deliverOrder(save, orderId) {
  const o = save.shop.orders.find((o) => o.id === orderId);
  if (!o || o.done) return "訂單無效";
  if ((save.inventory[o.itemId] || 0) < o.count) return "數量不足";
  save.inventory[o.itemId] -= o.count;
  save.coins += o.rewardCoins;
  o.done = true;
  return { rewardCoins: o.rewardCoins, rewardCrystals: o.rewardCrystals };
}
