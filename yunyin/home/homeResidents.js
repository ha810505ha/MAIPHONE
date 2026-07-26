import { furnitureById, BLUEPRINT_FURNITURE_IDS } from "./furnitureCatalog";
import { PLAYER_HOME_ID, createHomeRelationship } from "./homeState";
import { isRoomUnlocked } from "./homeExpansion";
import { addHomeAffinity, relationshipStageOf } from "./homeRelationships";

const dayKeyOf = (now) => new Date(now).toISOString().slice(0, 10);
const STAGE_RANK = { stranger: 0, familiar: 1, friend: 2, close: 3, intimate: 4 };

export const residentStage = (homeState, characterId) =>
  relationshipStageOf(homeState.relationships?.[characterId]?.affinity || 0);

const stageRank = (homeState, characterId) => STAGE_RANK[residentStage(homeState, characterId).id] || 0;

// 客床數 = 入住容量：一床一人。
export const guestBedCount = (home) =>
  (home?.furniture || []).filter((item) => furnitureById(item.furnitureId)?.guestBed).length;

export function inviteResident(homeState, characterId) {
  const home = homeState.homes?.[PLAYER_HOME_ID];
  if (!home) return { error: "找不到住宅" };
  if (!isRoomUnlocked(home, "guest")) return { error: "要先擴建客房才能邀請入住" };
  if (home.residents.includes(characterId)) return { error: "已經住在這裡了" };
  if (home.residents.length >= guestBedCount(home)) return { error: "客床不足，先擺一張客床" };
  home.residents.push(characterId);
  if (!homeState.relationships[characterId]) homeState.relationships[characterId] = createHomeRelationship(characterId);
  return { ok: true };
}

// 同床加成：玩家與住客一起睡雙人床，每日首次 +2 好感（走既有的好感日上限保護）。
// 回傳 { gain } 或 null（當日已領過）。
export function coSleepBonus(homeState, characterId, now = Date.now()) {
  const home = homeState.homes?.[PLAYER_HOME_ID];
  if (!home || !home.residents.includes(characterId)) return null;
  const dayKey = new Date(now).toISOString().slice(0, 10);
  if (home.lastCoSleepDay === dayKey) return null;
  home.lastCoSleepDay = dayKey;
  const relation = homeState.relationships[characterId] || (homeState.relationships[characterId] = createHomeRelationship(characterId));
  return { gain: addHomeAffinity(relation, 2, { dayKey }) };
}

// ---- 住客幫忙做事 ----
// 三項各自獨立每日額度（不共用）：澆水常駐（入住即做），打掃需熟悉，顧爐需親近。
// 靈田澆水跟綁定角色的 farmAssist 是兩套：住客必做、不消耗 farmAssist 當日名額。
export const CHORES = Object.freeze({
  water: { id: "water", minRank: 0, label: "靈田澆水" },
  clean: { id: "clean", minRank: 1, label: "小屋打掃" },
  furnace: { id: "furnace", minRank: 3, label: "丹房顧爐" },
});

// 回傳「今天還能做這項雜務」的第一位住客 id；沒有就回 null
export function choreWorker(homeState, choreId, now = Date.now()) {
  const home = homeState.homes?.[PLAYER_HOME_ID];
  const chore = CHORES[choreId];
  if (!home || !chore) return null;
  const days = home.choreDays || (home.choreDays = {});
  if (days[choreId] === dayKeyOf(now)) return null;
  return home.residents.find((characterId) => stageRank(homeState, characterId) >= chore.minRank) || null;
}

export function markChoreDone(homeState, choreId, now = Date.now()) {
  const home = homeState.homes?.[PLAYER_HOME_ID];
  if (!home) return;
  (home.choreDays || (home.choreDays = {}))[choreId] = dayKeyOf(now);
}

// 親密階段（rank 4）效果 +50%
export const choreBoost = (homeState, characterId) => stageRank(homeState, characterId) >= 4 ? 1.5 : 1;

// ---- 每日禮物 ----
// 機率依好感階段；獎品以材料為主，圖紙是稀有獎且送完自動改送材料（不會空手）。
const GIFT_CHANCE = { 0: 0, 1: 0, 2: 0.15, 3: 0.3, 4: 0.5 };
const GIFT_MATERIALS = [
  { id: "qingling", n: 3 }, { id: "yuehua", n: 2 },
  { id: "lingmu", n: 2 }, { id: "qingshi", n: 3 },
];

export function dailyGift(save, characterId, now = Date.now(), random = Math.random) {
  const homeState = save.home;
  const home = homeState.homes?.[PLAYER_HOME_ID];
  if (!home || !home.residents.includes(characterId)) return null;
  const gifts = home.giftDays || (home.giftDays = {});
  if (gifts[characterId] === dayKeyOf(now)) return null;
  gifts[characterId] = dayKeyOf(now);

  const rank = stageRank(homeState, characterId);
  if (random() >= (GIFT_CHANCE[rank] || 0)) return null;

  // 親密階段有 25% 機率改抽圖紙（池子空了就退回材料）
  if (rank >= 4 && random() < 0.25) {
    const pool = BLUEPRINT_FURNITURE_IDS.filter((id) => !save.blueprints?.[id] && !homeState.furnitureUnlocks?.[id]);
    if (pool.length) {
      const furnitureId = pool[Math.floor(random() * pool.length)];
      save.blueprints[furnitureId] = true;
      return { blueprint: { furnitureId, name: furnitureById(furnitureId)?.name || furnitureId } };
    }
  }
  const material = GIFT_MATERIALS[Math.floor(random() * GIFT_MATERIALS.length)];
  save.inventory[material.id] = (save.inventory[material.id] || 0) + material.n;
  return { material };
}

export function dismissResident(homeState, characterId) {
  const home = homeState.homes?.[PLAYER_HOME_ID];
  if (!home) return { error: "找不到住宅" };
  const index = home.residents.indexOf(characterId);
  if (index < 0) return { error: "不在住客名單裡" };
  home.residents.splice(index, 1);
  return { ok: true };
}
