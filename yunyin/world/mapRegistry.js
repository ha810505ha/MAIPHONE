import { parseMap } from "../engine/tilemap";
import gateDef from "../data/maps/gate";
import farmDef from "../data/maps/farm";
import starterHomeDef from "../data/maps/starterHome";
import residenceDef from "../data/maps/residence";
import danfangInteriorDef from "../data/maps/danfangInterior";
import hallInteriorDef from "../data/maps/hallInterior";
import { furnitureById } from "../home/furnitureCatalog";
import { buildDynamicCollision, withDynamicCollision } from "../engine/dynamicCollision";

const MAP_DEFINITIONS = { gate: gateDef, farm: farmDef, residence: residenceDef, starter_home: starterHomeDef, danfang_interior: danfangInteriorDef, hall_interior: hallInteriorDef };

export const DEFAULT_MAP_ID = "gate";

export const hasMap = (mapId) => Object.hasOwn(MAP_DEFINITIONS, mapId);
export const getMapDefinition = (mapId) => MAP_DEFINITIONS[mapId] || MAP_DEFINITIONS[DEFAULT_MAP_ID];
export const createMapRuntime = (mapId, options = {}) => {
  const definition = getMapDefinition(mapId);
  const instanceId = options.instanceId || definition.defaultInstanceId || null;
  const home = instanceId ? options.homeState?.homes?.[instanceId] || null : null;
  // 支援動態版型：定義檔提供 build(home) 就用它產出實際地圖（例如小屋依已開通房間組版型）
  const resolved = typeof definition.build === "function" ? definition.build(home) : definition;
  const runtime = parseMap(resolved);
  if (!instanceId) return runtime;
  const blocked = buildDynamicCollision({ furniture: home?.furniture || [], furnitureById });
  return withDynamicCollision({ ...runtime, instanceId, home }, blocked);
};
export const registerMap = (mapId, definition) => { MAP_DEFINITIONS[mapId] = definition; };
