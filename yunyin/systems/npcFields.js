// 住客角色田（MP-030）：入住住客一人一塊田，自己播種、自己收成。
// 跟玩家靈田一樣只存時間戳，進度一律由 plantedAt 回推；離線期間的收成／重種在 settle 時補算。
//
// 規則（2026-10-11 定案）：
// - 生長時間 = 玩家的 1.5 倍。
// - 幫忙：每塊田每天一次，作物長快一點、好感 +1；這一輪有幫過忙，收成時才分玩家東西。
// - 偷菜：只在成熟時、每塊田每天一次，拿 1～2 份；被抓不扣好感；沒被抓之後會在山莊隱約透露。
// - 同一塊田同一天，幫忙與偷菜二選一。
import { CROPS } from "../data/crops.js";
import { growMs } from "./farm.js";
import { addHomeAffinity } from "../home/homeRelationships.js";

export const NPC_FIELD_GROW_MUL = 1.5;
export const NPC_FIELD_RIPE_HOLD_MS = 6 * 60 * 60 * 1000; // 成熟後放著 6 小時，住客才自己收成
export const NPC_FIELD_HELP_SPEEDUP = 0.2;                 // 幫忙：剩餘時間縮短 20%
export const NPC_FIELD_COIN_CAP = 500;
const MAX_SETTLE_ROUNDS = 60;
const PLAYER_HOME_ID = "player_home";

// 住客會種的作物（只種買得到種子的；星露籽要秘境帶回，住客不種）
const FIELD_CROP_WEIGHTS = [
  { id: "yuehua", weight: 5 },
  { id: "qingling", weight: 3 },
  { id: "lingmu", weight: 2 },
];

export const dayKeyOf = (now) => new Date(now).toISOString().slice(0, 10);
const cropOf = (id) => CROPS.find((crop) => crop.id === id) || null;
const objectOf = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

export const npcFieldGrowMs = (crop) => {
  const base = growMs(crop);
  return base ? base * NPC_FIELD_GROW_MUL : null;
};

export function npcFieldReadyAt(field) {
  const crop = cropOf(field?.cropId);
  const plantedAt = Number(field?.plantedAt);
  const duration = npcFieldGrowMs(crop);
  return duration && Number.isFinite(plantedAt) && plantedAt > 0 ? plantedAt + duration : null;
}

// null=空；0種/1芽/2長/3熟
export function npcFieldStage(field, now = Date.now()) {
  const crop = cropOf(field?.cropId);
  const duration = npcFieldGrowMs(crop);
  const plantedAt = Number(field?.plantedAt);
  if (!duration || !Number.isFinite(plantedAt) || plantedAt <= 0) return null;
  return Math.max(0, Math.min(3, Math.floor(((Number(now) - plantedAt) / duration) * 3)));
}

export function npcFieldProgress(field, now = Date.now()) {
  const duration = npcFieldGrowMs(cropOf(field?.cropId));
  const plantedAt = Number(field?.plantedAt);
  if (!duration || !Number.isFinite(plantedAt)) return 0;
  return Math.max(0, Math.min(1, (Number(now) - plantedAt) / duration));
}

export const npcFieldRemainMin = (field, now = Date.now()) => {
  const at = npcFieldReadyAt(field);
  return at ? Math.max(0, Math.ceil((at - now) / 60000)) : 0;
};

export function createNpcField(zoneId = null) {
  return { zoneId, cropId: null, plantedAt: null, helped: 0, stolen: 0, actedDay: "", actedKind: null, stealHint: false, pendingReward: null };
}

export function normalizeNpcField(raw) {
  const source = objectOf(raw);
  const field = { ...createNpcField(), ...source };
  field.zoneId = typeof field.zoneId === "string" ? field.zoneId : null;
  const plantedAt = Number(field.plantedAt);
  if (!cropOf(field.cropId) || !Number.isFinite(plantedAt) || plantedAt <= 0) {
    field.cropId = null;
    field.plantedAt = null;
  }
  field.helped = Math.max(0, Math.trunc(Number(field.helped) || 0));
  field.stolen = Math.max(0, Math.trunc(Number(field.stolen) || 0));
  field.actedDay = typeof field.actedDay === "string" ? field.actedDay : "";
  field.actedKind = field.actedKind === "help" || field.actedKind === "steal" ? field.actedKind : null;
  field.stealHint = !!field.stealHint;
  const reward = objectOf(field.pendingReward);
  field.pendingReward = field.pendingReward && cropOf(reward.cropId) ? {
    cropId: reward.cropId,
    crops: Math.max(0, Math.trunc(Number(reward.crops) || 0)),
    coins: Math.max(0, Math.min(NPC_FIELD_COIN_CAP, Math.trunc(Number(reward.coins) || 0))),
    crystals: Math.max(0, Math.trunc(Number(reward.crystals) || 0)),
    helped: Math.max(0, Math.trunc(Number(reward.helped) || 0)),
  } : null;
  return field;
}

const residentsOf = (save) => save?.home?.homes?.[PLAYER_HOME_ID]?.residents || [];

// 分田：沿用每位住客上次的田；沒有田的住客照入住順序拿空田。田比住客少時，後來的住客沒有田。
// 回傳 { [zoneId]: characterId }，並在 save.farm.npcFields 補上新住客的田地狀態。
export function assignNpcFields(save, zones = []) {
  if (!save.farm.npcFields || typeof save.farm.npcFields !== "object") save.farm.npcFields = {};
  const fields = save.farm.npcFields;
  const zoneIds = zones.map((zone) => zone.id);
  const owners = {};
  const residents = residentsOf(save);
  for (const characterId of residents) {
    const zoneId = fields[characterId]?.zoneId;
    if (zoneId && zoneIds.includes(zoneId) && !owners[zoneId]) owners[zoneId] = characterId;
  }
  for (const characterId of residents) {
    if (Object.values(owners).includes(characterId)) continue;
    const free = zoneIds.find((zoneId) => !owners[zoneId]);
    if (!free) break;
    owners[free] = characterId;
    fields[characterId] = { ...normalizeNpcField(fields[characterId]), zoneId: free };
  }
  return owners;
}

function pickCrop(random) {
  const total = FIELD_CROP_WEIGHTS.reduce((sum, item) => sum + item.weight, 0);
  let roll = random() * total;
  for (const item of FIELD_CROP_WEIGHTS) {
    roll -= item.weight;
    if (roll < 0) return item.id;
  }
  return FIELD_CROP_WEIGHTS[0].id;
}

// 收成回禮：作物固定一份；有機會加金幣（最多 500）或結晶 +1／+2，幫越多次機會越高。
export function rollFieldReward(field, random = Math.random) {
  const helped = Math.max(1, field.helped || 0);
  const reward = { cropId: field.cropId, crops: 1, coins: 0, crystals: 0, helped };
  const specialChance = Math.min(0.85, 0.35 + 0.2 * (helped - 1));
  if (random() < specialChance) {
    if (random() < 0.55) reward.coins = Math.min(NPC_FIELD_COIN_CAP, 100 + Math.floor(random() * 401));
    else reward.crystals = random() < 0.7 ? 1 : 2;
  }
  return reward;
}

const mergeReward = (current, next) => {
  if (!current) return next;
  return {
    cropId: current.cropId,
    crops: current.crops + next.crops,
    coins: Math.min(NPC_FIELD_COIN_CAP, current.coins + next.coins),
    crystals: current.crystals + next.crystals,
    helped: current.helped + next.helped,
  };
};

// 結算：空田播種；成熟放超過 NPC_FIELD_RIPE_HOLD_MS 就由住客收成並立刻重種（離線期間可連續補算多輪）。
// 只動入住中、有分到田的住客。回傳本次產生回禮的住客 id 清單。
export function settleNpcFields(save, zones = [], now = Date.now(), random = Math.random) {
  const owners = assignNpcFields(save, zones);
  const rewarded = [];
  for (const characterId of Object.values(owners)) {
    const field = save.farm.npcFields[characterId] = normalizeNpcField(save.farm.npcFields[characterId]);
    if (!field.cropId) {
      field.cropId = pickCrop(random);
      field.plantedAt = now;
      field.helped = 0;
      field.stolen = 0;
      continue;
    }
    for (let round = 0; round < MAX_SETTLE_ROUNDS; round += 1) {
      const readyAt = npcFieldReadyAt(field);
      if (!readyAt || now < readyAt + NPC_FIELD_RIPE_HOLD_MS) break;
      const harvestedAt = readyAt + NPC_FIELD_RIPE_HOLD_MS;
      if (field.helped > 0) {
        field.pendingReward = mergeReward(field.pendingReward, rollFieldReward(field, random));
        if (!rewarded.includes(characterId)) rewarded.push(characterId);
      }
      field.cropId = pickCrop(random);
      field.plantedAt = harvestedAt;
      field.helped = 0;
      field.stolen = 0;
    }
  }
  return rewarded;
}

export const actedToday = (field, now = Date.now()) => (field?.actedDay === dayKeyOf(now) ? field.actedKind : null);

const relationOf = (save, characterId) => {
  const relationships = save.home.relationships || (save.home.relationships = {});
  return relationships[characterId] || (relationships[characterId] = {
    characterId, affinity: 0, stage: "stranger", dailyGain: 0, lastInteractionDay: "", unlockedPermissions: [], memories: [],
  });
};

// 幫忙：回傳 { affinityGain, speedup } 或 { error }
export function helpNpcField(save, characterId, now = Date.now()) {
  const field = save.farm?.npcFields?.[characterId];
  if (!field?.cropId) return { error: "fieldEmpty" };
  if (actedToday(field, now)) return { error: "fieldActedToday" };
  const readyAt = npcFieldReadyAt(field);
  let speedup = 0;
  if (readyAt && now < readyAt) {
    speedup = Math.floor((readyAt - now) * NPC_FIELD_HELP_SPEEDUP);
    field.plantedAt -= speedup;
  }
  field.helped += 1;
  field.actedDay = dayKeyOf(now);
  field.actedKind = "help";
  const affinityGain = addHomeAffinity(relationOf(save, characterId), 1, { dayKey: dayKeyOf(now) });
  return { affinityGain, speedup };
}

// 被抓機率：越熟越常「假裝沒看到」。好感 0 → 65%，好感 100 → 15%。
export const stealCatchChance = (affinity) => Math.max(0.15, Math.min(0.65, 0.65 - (Number(affinity) || 0) * 0.005));

// 偷菜：回傳 { cropId, amount, caught } 或 { error }
export function stealNpcField(save, characterId, now = Date.now(), random = Math.random) {
  const field = save.farm?.npcFields?.[characterId];
  if (!field?.cropId) return { error: "fieldEmpty" };
  if (npcFieldStage(field, now) !== 3) return { error: "fieldNotRipe" };
  if (actedToday(field, now)) return { error: "fieldActedToday" };
  const amount = random() < 0.5 ? 1 : 2;
  save.inventory[field.cropId] = (Number(save.inventory[field.cropId]) || 0) + amount;
  field.stolen += amount;
  field.actedDay = dayKeyOf(now);
  field.actedKind = "steal";
  const caught = random() < stealCatchChance(save.home?.relationships?.[characterId]?.affinity);
  if (!caught) field.stealHint = true;
  return { cropId: field.cropId, amount, caught };
}

// 領收成回禮：作物與金幣直接入帳；結晶回傳給呼叫端走共用結晶帳本。
export function claimNpcFieldReward(save, characterId) {
  const field = save.farm?.npcFields?.[characterId];
  const reward = field?.pendingReward;
  if (!reward) return null;
  save.inventory[reward.cropId] = (Number(save.inventory[reward.cropId]) || 0) + reward.crops;
  save.coins += reward.coins;
  field.pendingReward = null;
  return reward;
}

export const npcFieldZoneAt = (zones = [], tileX, tileY) => zones.find((zone) => zone.type === "character" && (
  (tileX >= zone.x && tileX < zone.x + zone.w && tileY >= zone.y && tileY < zone.y + zone.h)
  || (zone.sign && zone.sign[0] === tileX && zone.sign[1] === tileY)
)) || null;

// 角色田的作物格（MP-030）：點到才可以幫忙／偷菜；回傳 { zone, index } 或 null
export const npcFieldPlotAt = (zones = [], tileX, tileY) => {
  for (const zone of zones) {
    if (zone.type !== "character") continue;
    const index = (zone.plots || []).findIndex(([x, y]) => x === tileX && y === tileY);
    if (index >= 0) return { zone, index };
  }
  return null;
};

// 手機上作物格很小：點在作物格附近（含作物往上長出去的部分）也算點到；
// 作物格之間隔 2～3 格，這個範圍不會同時碰到兩格。pointX/pointY 是以格為單位的世界座標。
export const npcFieldPlotNear = (zones = [], pointX, pointY) => {
  for (const zone of zones) {
    if (zone.type !== "character") continue;
    const index = (zone.plots || []).findIndex(([x, y]) => {
      const dx = pointX - (x + 0.5), dy = pointY - (y + 0.5);
      return Math.abs(dx) <= 0.75 && dy >= -0.85 && dy <= 0.75;
    });
    if (index >= 0) return { zone, index };
  }
  return null;
};

// 圍欄框或木牌：點了走到柵門外看田的資訊（田裡的空地就只是走路）
export const npcFieldEdgeAt = (zones = [], tileX, tileY) => {
  const zone = npcFieldZoneAt(zones, tileX, tileY);
  if (!zone) return null;
  const onSign = zone.sign && zone.sign[0] === tileX && zone.sign[1] === tileY;
  const onFence = tileX === zone.x || tileY === zone.y || tileX === zone.x + zone.w - 1 || tileY === zone.y + zone.h - 1;
  return onSign || onFence ? zone : null;
};

// 整塊角色田含柵門都不讓閒逛的住客 NPC 走進去，只有玩家能進田點作物
export const inCharacterField = (map, x, y) => map?.id === "farm" && (map.fieldZones || []).some((zone) => zone.type === "character"
  && x >= zone.x && x < zone.x + zone.w && y >= zone.y && y < zone.y + zone.h);
