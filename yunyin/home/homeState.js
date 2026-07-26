import { relationshipStageOf } from "./homeRelationships";
import { STARTER_FURNITURE_IDS } from "./furnitureCatalog";

export const HOME_STATE_VERSION = 2;
export const PLAYER_HOME_ID = "player_home";

const objectOf = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const uniqueStrings = (value) => [...new Set((Array.isArray(value) ? value : []).filter((item) => typeof item === "string" && item))];

export function createHomeInstance({ id, templateId, name = "家園", owner = { type: "player", id: null } }) {
  return {
    id,
    templateId,
    name,
    owner: { type: owner?.type || "player", id: owner?.id || null },
    unlockedRooms: ["main"],
    construction: null,
    residents: [],
    furniture: [],
    lastSimulatedAt: Date.now(),
  };
}

export function createFurnitureInstance({ uid, furnitureId, x = 0, y = 0, ownership = { type: "player", id: null }, source = "placement", locked = false }) {
  return {
    uid,
    furnitureId,
    x: Math.trunc(Number(x) || 0),
    y: Math.trunc(Number(y) || 0),
    ownership: { type: ownership?.type || "player", id: ownership?.id || null },
    source,
    locked: !!locked,
  };
}

export function createHomeRelationship(characterId) {
  return {
    characterId,
    affinity: 0,
    stage: "stranger",
    dailyGain: 0,
    lastInteractionDay: "",
    unlockedPermissions: [],
    memories: [],
  };
}

export function createResidentState(characterId) {
  return {
    characterId,
    homeId: null,
    currentMapId: null,
    position: null,
    currentAction: null,
    lastSimulatedAt: Date.now(),
  };
}

const normalizeFurniture = (items) => (Array.isArray(items) ? items : []).filter((item) => item?.uid && item?.furnitureId).map((item) => createFurnitureInstance(item));

const normalizeHome = (id, raw) => {
  const source = objectOf(raw);
  const base = createHomeInstance({ id, templateId: source.templateId || "", name: source.name || "家園", owner: source.owner });
  return {
    ...base,
    ...source,
    id,
    owner: { ...base.owner, ...objectOf(source.owner) },
    unlockedRooms: uniqueStrings(source.unlockedRooms).length ? uniqueStrings(source.unlockedRooms) : ["main"],
    construction: source.construction && typeof source.construction === "object" ? { ...source.construction } : null,
    residents: uniqueStrings(source.residents),
    furniture: normalizeFurniture(source.furniture),
    lastSimulatedAt: Number(source.lastSimulatedAt) || Date.now(),
  };
};

export function normalizeHomeState(raw) {
  const source = objectOf(raw);
  const homes = Object.fromEntries(Object.entries(objectOf(source.homes)).map(([id, home]) => [id, normalizeHome(id, home)]));
  if (!homes[PLAYER_HOME_ID]) homes[PLAYER_HOME_ID] = createHomeInstance({ id: PLAYER_HOME_ID, templateId: "starter_home", name: "玩家小屋" });

  const residents = Object.fromEntries(Object.entries(objectOf(source.residents)).map(([characterId, resident]) => {
    const { needs, ...rest } = objectOf(resident); // needs 是已移除的舊欄位（需求系統改成住客請求），丟棄不保留
    return [characterId, { ...createResidentState(characterId), ...rest, characterId }];
  }));
  const relationships = Object.fromEntries(Object.entries(objectOf(source.relationships)).map(([characterId, relation]) => {
    const affinity = Math.max(0, Math.min(100, Number(relation?.affinity) || 0));
    const stage = relationshipStageOf(affinity);
    return [characterId, {
      ...createHomeRelationship(characterId), ...objectOf(relation), characterId, affinity,
      stage: stage.id, unlockedPermissions: [...stage.permissions],
      memories: Array.isArray(relation?.memories) ? relation.memories.filter(Boolean).map((memory) => ({ ...memory })) : [],
    }];
  }));

  return {
    version: HOME_STATE_VERSION,
    furnitureUnlocks: Object.fromEntries(STARTER_FURNITURE_IDS.map((id) => [id, true]).concat(Object.entries(objectOf(source.furnitureUnlocks)))),
    homes,
    residents,
    residentProfiles: { ...objectOf(source.residentProfiles) },
    relationships,
    characterHomeInventories: Object.fromEntries(Object.entries(objectOf(source.characterHomeInventories)).map(([characterId, inventory]) => [characterId, { furniture: normalizeFurniture(inventory?.furniture) }])),
    giftHistory: { ...objectOf(source.giftHistory) },
  };
}
