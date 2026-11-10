import { createFurnitureInstance, createHomeRelationship } from "./homeState";
import { addHomeAffinity } from "./homeRelationships";
import { furnitureById, furnitureMaxCount } from "./furnitureCatalog";

const makeUid = (prefix, now = Date.now()) => `${prefix}:${now}:${Math.random().toString(36).slice(2, 8)}`;

export function unlockFurniture(homeState, furnitureId, source = { type: "reward" }, now = Date.now()) {
  if (!homeState.furnitureUnlocks[furnitureId]) homeState.furnitureUnlocks[furnitureId] = { unlockedAt: now, source: { ...source } };
  return homeState.furnitureUnlocks[furnitureId];
}

export const isFurnitureUnlocked = (homeState, furnitureId) => !!homeState.furnitureUnlocks?.[furnitureId];

// 同款家具在單一住宅的已擺數量與上限檢查
export const furniturePlacedCount = (home, furnitureId) =>
  (home?.furniture || []).filter((item) => item.furnitureId === furnitureId).length;

export const canAddFurnitureInstance = (home, furnitureId) =>
  furniturePlacedCount(home, furnitureId) < furnitureMaxCount(furnitureById(furnitureId), home);

// 商店購買：檢查圖紙資格與貨幣，扣款後永久解鎖（解鎖制）。
// 回傳 { error } 或 { unlocked, cost: { coins?, crystals? } }。crystals 的實際扣款由呼叫端處理（結晶存在 Gacha context）。
export function purchaseFurniture({ save, crystals = 0, furnitureId, now = Date.now() }) {
  const definition = furnitureById(furnitureId);
  if (!definition || !definition.price) return { error: "此家具不販售" };
  const homeState = save.home;
  if (isFurnitureUnlocked(homeState, furnitureId)) return { error: "已經解鎖過了" };
  if (definition.requiresBlueprint && !save.blueprints?.[furnitureId]) return { error: "需要先取得圖紙" };
  const { coins = 0, crystals: crystalCost = 0 } = definition.price;
  if (coins > 0 && save.coins < coins) return { error: "🪙 不足" };
  if (crystalCost > 0 && crystals < crystalCost) return { error: "靈魂結晶不足" };
  if (coins > 0) save.coins -= coins;
  unlockFurniture(homeState, furnitureId, { type: "purchase" }, now);
  return { unlocked: true, cost: { coins, crystals: crystalCost } };
}

export function placePlayerFurniture(homeState, homeId, furnitureId, x, y) {
  if (!isFurnitureUnlocked(homeState, furnitureId)) return { error: "尚未解鎖此家具" };
  const home = homeState.homes?.[homeId];
  if (!home) return { error: "找不到住宅" };
  if (!canAddFurnitureInstance(home, furnitureId)) return { error: "這款家具已達擺放上限" };
  const instance = createFurnitureInstance({ uid: makeUid(`player:${homeId}:${furnitureId}`), furnitureId, x, y });
  home.furniture.push(instance);
  return { instance };
}

export function giftFurniture(homeState, characterId, furnitureId, now = Date.now()) {
  if (!isFurnitureUnlocked(homeState, furnitureId)) return { error: "尚未解鎖此家具" };
  const inventories = homeState.characterHomeInventories;
  const inventory = inventories[characterId] || (inventories[characterId] = { furniture: [] });
  const historyByCharacter = homeState.giftHistory[characterId] || (homeState.giftHistory[characterId] = {});
  const history = historyByCharacter[furnitureId] || { firstGiftedAt: now, giftCount: 0, affinityGranted: false };
  history.giftCount += 1;
  history.lastGiftedAt = now;
  historyByCharacter[furnitureId] = history;

  const instance = createFurnitureInstance({
    uid: makeUid(`gift:${characterId}:${furnitureId}`, now), furnitureId,
    ownership: { type: "character", id: characterId }, source: "player_gift", locked: true,
  });
  inventory.furniture.push(instance);

  let affinityGain = 0;
  if (!history.affinityGranted) {
    const relation = homeState.relationships[characterId] || (homeState.relationships[characterId] = createHomeRelationship(characterId));
    affinityGain = addHomeAffinity(relation, 1, { dayKey: new Date(now).toISOString().slice(0, 10) });
    history.affinityGranted = true;
  }
  return { instance, affinityGain, firstGift: history.giftCount === 1 };
}
