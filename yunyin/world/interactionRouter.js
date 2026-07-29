import { TILE } from "../engine/tilemap";
import { activePackLines } from "../systems/ai";
import { npcAtTile, talkToNpc } from "../systems/npc";
import { plotUnlocked } from "../systems/farm";
import { buildingAt, plotIndexAt, plotIndexNearPoint, portalAt } from "./spatialQueries";
import { worldInteractionAt } from "./worldInteractions";

export function routeWorldTap({ screenX, screenY, camera, scale, map, player, npcs, save, hasMap, walkTo, switchMap, openPanel, showToast, onPlotArrive, onWorldInteraction }) {
  const worldX = camera.x + screenX / scale;
  const worldY = camera.y + screenY / scale;
  const tileX = Math.floor(worldX / TILE);
  const tileY = Math.floor(worldY / TILE);
  const activatePortal = (portal) => {
    walkTo(portal.x, portal.y, () => {
      if (hasMap(portal.to)) switchMap(portal.to, portal.spawn, { instanceId: portal.instanceId });
      else if (portal.to === "dungeon") openPanel({ type: "dungeon", title: "🌫️ 秘境" });
      else openPanel({ type: "portal", title: `${portal.icon} ${portal.label}` });
    });
  };
  const npc = npcAtTile(npcs, tileX, tileY);
  if (npc) {
    if (npc.helper) openPanel({ type: "farmAssist", title: `${npc.name}的靈田協助`, npc });
    else {
      // 住客（npc.charId）在自己家裡：優先用 home 池，比通用 chat 池貼近語境
      const characterId = npc.charId || save.settings.bindings[npc.seed];
      const pack = characterId ? activePackLines(save, characterId) : null;
      talkToNpc(npc, performance.now(), (npc.charId ? pack?.home || npc.homeLines : null) || pack?.chat || null);
    }
    return { worldX, worldY };
  }
  const interactionTarget = worldInteractionAt(map, tileX, tileY);
  if (interactionTarget) {
    onWorldInteraction?.(interactionTarget);
    return { worldX, worldY };
  }
  const building = buildingAt(map, tileX, tileY);
  if (building) {
    walkTo(building.door[0], building.door[1], () => {
      if (building.to && hasMap(building.to)) {
        switchMap(building.to, building.spawn, { instanceId: building.instanceId });
      } else {
        openPanel({ type: building.opens, title: building.label, tab: building.panelTab });
      }
    });
    return { worldX, worldY };
  }
  const exactPortal = portalAt(map, tileX, tileY, 0);
  if (exactPortal) {
    activatePortal(exactPortal);
    return { worldX, worldY };
  }
  const nearbyPortal = portalAt(map, tileX, tileY);
  if (nearbyPortal) {
    activatePortal(nearbyPortal);
    return { worldX, worldY };
  }
  const exactPlotIndex = plotIndexAt(map, tileX, tileY);
  const plotIndex = exactPlotIndex >= 0
    ? exactPlotIndex
    : plotIndexNearPoint(map, worldX / TILE, worldY / TILE, scale);
  if (plotIndex >= 0) {
    if (!plotUnlocked(plotIndex, save.cultivation)) showToast("🔒 境界不足，尚未開墾");
    else {
      const plot = map.plots[plotIndex];
      walkTo(plot.x, plot.y, () => onPlotArrive(plotIndex));
    }
    return { worldX, worldY };
  }
  walkTo(tileX, tileY, null);
  return { worldX, worldY };
}
