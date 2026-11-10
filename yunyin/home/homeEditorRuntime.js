import { canPlaceFurniture, furnitureTiles } from "./furniturePlacement";
import { furnitureById } from "./furnitureCatalog";

const definitionFor = (instance) => furnitureById(instance?.furnitureId);
const tileKey = (x, y) => `${x},${y}`;

export function furnitureInstanceAt(furniture, x, y) {
  const matches = [...(furniture || [])].reverse().filter((instance) => (
    furnitureTiles(definitionFor(instance), instance.x, instance.y)
      .some((tile) => tile.x === x && tile.y === y)
  ));
  // 地毯可以和一般家具重疊；同格點擊優先命中椅子/桌子等實體家具，
  // 避免較晚放置的地毯搶走互動。要選地毯仍可點它沒有被家具蓋住的部分。
  return matches.find((instance) => definitionFor(instance)?.placement !== "rug") || matches[0] || null;
}

const isInsideEditableZone = (map, tiles) => {
  const zones = (map.zones || []).filter((zone) => zone.editable !== false);
  if (!zones.length) return true;
  return tiles.every((tile) => zones.some((zone) => (
    tile.x >= zone.x && tile.y >= zone.y && tile.x < zone.x + zone.w && tile.y < zone.y + zone.h
  )));
};

export function canPlaceHomeFurniture({ map, home, definition, x, y, excludeUid = null }) {
  if (!definition || definition.placement === "wall") return false;
  const tiles = furnitureTiles(definition, x, y);
  if (!isInsideEditableZone(map, tiles)) return false;

  const occupied = new Set();
  for (const instance of home?.furniture || []) {
    if (instance.uid === excludeUid) continue;
    const other = definitionFor(instance);
    if (!other || other.placement !== definition.placement) continue;
    for (const tile of furnitureTiles(other, instance.x, instance.y)) occupied.add(tileKey(tile.x, tile.y));
  }
  const reserved = new Set((map.portals || []).map((portal) => tileKey(portal.x, portal.y)));
  const baseMap = { ...map, isBlocked: map.baseIsBlocked || map.isBlocked };
  return canPlaceFurniture({ definition, x, y, map: baseMap, occupied, reserved });
}
