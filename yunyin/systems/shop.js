// 丹房坊市：煉製佇列與貨架販售都用時間戳回算，無計時器。
import { CROPS } from "../data/crops";
import { RECIPES } from "../data/recipes";
import { MATERIALS } from "../data/materials";
import { hasUnlock } from "./cultivation";
import { BLUEPRINT_FURNITURE_IDS, furnitureById } from "../home/furnitureCatalog";

export const SELL_INTERVAL_SEC = 1200; // 貨架每 20 分鐘自動賣出 1 件

// 物品目錄：作物 + 種子 + 丹藥
const ITEMS = {};
CROPS.forEach((c) => {
  ITEMS[c.id] = { name: c.name, icon: c.icon, sellPrice: c.sellPrice };
  ITEMS[`${c.id}_seed`] = { name: `${c.name}種子`, icon: "🌰", sellPrice: Math.ceil((c.seedCost || 20) / 2) };
});
RECIPES.forEach((r) => { ITEMS[r.id] = { name: r.name, icon: r.icon, sellPrice: r.sellPrice }; });
MATERIALS.forEach((m) => { ITEMS[m.id] = { name: m.name, icon: m.icon, sellPrice: m.sellPrice }; });
export const itemMeta = (id) => ITEMS[id] || { name: id, icon: "❓", sellPrice: 1 };

export const recipeById = (id) => RECIPES.find((r) => r.id === id);
export const recipeUnlocked = (r, cultivation) => !r.needUnlock || hasUnlock(cultivation, r.needUnlock);
export const maxBatch = (save, r) =>
  Math.min(...Object.entries(r.in).map(([k, n]) => Math.floor((save.inventory[k] || 0) / n)));

// ---- 丹爐（兩座；第 2 座築基期 furnace_2 解鎖）----
export const furnaceCount = (cultivation) => hasUnlock(cultivation, "furnace_2") ? 2 : 1;
export const activeFurnaces = (save) => save.shop.furnaces.slice(0, furnaceCount(save.cultivation));

export function startCraft(save, recipeId, batch, now = Date.now()) {
  const r = recipeById(recipeId);
  if (!r || batch < 1) return "無法煉製";
  const idle = activeFurnaces(save).find((f) => !f.recipeId);
  if (!idle) return "丹爐都在忙碌中";
  if (maxBatch(save, r) < batch) return "材料不足";
  for (const [k, n] of Object.entries(r.in)) save.inventory[k] -= n * batch;
  idle.recipeId = recipeId;
  idle.startedAt = now;
  idle.batch = batch;
  return null;
}

export function furnaceDone(f, now = Date.now()) {
  if (!f.recipeId) return 0;
  const r = recipeById(f.recipeId);
  return Math.min(f.batch, Math.floor((now - f.startedAt) / (r.craftMin * 60000)));
}

export function collectFurnace(save, furnaceIdx = 0, now = Date.now()) {
  const f = save.shop.furnaces[furnaceIdx];
  if (!f) return null;
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
  // 稀有訂單三成機率附贈家具圖紙（限還沒拿過的稀有家具）
  const blueprintPool = BLUEPRINT_FURNITURE_IDS.filter((id) => !save.blueprints?.[id] && !save.home?.furnitureUnlocks?.[id]);
  if (blueprintPool.length && Math.random() < 0.3) {
    specs[2].rewardBlueprint = blueprintPool[Math.floor(Math.random() * blueprintPool.length)];
  }
  // 進階/稀有訂單四成機率附贈建材（房屋擴建材料線）
  for (const spec of [specs[1], specs[2]]) {
    if (Math.random() < 0.4) {
      spec.rewardMaterials = Math.random() < 0.5 ? { id: "qingshi", n: 3 } : { id: "lingmu", n: 2 };
    }
  }
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
  const result = { rewardCoins: o.rewardCoins, rewardCrystals: o.rewardCrystals };
  if (o.rewardBlueprint && !save.blueprints?.[o.rewardBlueprint]) {
    save.blueprints[o.rewardBlueprint] = true;
    result.blueprintName = furnitureById(o.rewardBlueprint)?.name || o.rewardBlueprint;
  }
  if (o.rewardMaterials) {
    save.inventory[o.rewardMaterials.id] = (save.inventory[o.rewardMaterials.id] || 0) + o.rewardMaterials.n;
    result.materials = o.rewardMaterials;
  }
  return result;
}
