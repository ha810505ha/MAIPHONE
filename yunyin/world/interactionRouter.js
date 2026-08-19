import { TILE } from "../engine/tilemap";
import { activePackLines, activeResidentPackLines } from "../systems/ai";
import { COMPANION_LINES } from "../data/lines";
import { npcAtTile, talkToNpc } from "../systems/npc";
import { npcAtWorldPoint } from "./npcHitTest";
import { plotUnlocked } from "../systems/farm";
import { buildingAt, plotIndexAt, plotIndexNearPoint, portalAt } from "./spatialQueries";
import { worldInteractionAt } from "./worldInteractions";

export function routeWorldTap({ screenX, screenY, camera, scale, map, player, npcs, save, hasMap, walkTo, switchMap, openPanel, showToast, onPlotArrive, onWorldInteraction, translateText = (key) => key, localizeValue = (value) => value }) {
  const worldX = camera.x + screenX / scale;
  const worldY = camera.y + screenY / scale;
  const tileX = Math.floor(worldX / TILE);
  const tileY = Math.floor(worldY / TILE);
  const activatePortal = (portal) => {
    walkTo(portal.x, portal.y, () => {
      if (hasMap(portal.to)) switchMap(portal.to, portal.spawn, { instanceId: portal.instanceId });
      else if (portal.to === "dungeon") openPanel({ type: "dungeon", titleKey: "panel.dungeon" });
      else openPanel({ type: "portal", title: `${portal.icon} ${localizeValue(portal.label)}` });
    });
  };
  const npc = npcAtWorldPoint(npcs, worldX, worldY) || npcAtTile(npcs, tileX, tileY);
  if (npc) {
    if (npc.helper) openPanel({ type: "farmAssist", titleKey: "panel.farmAssist", titleVariables: { name: localizeValue(npc.name) }, npc });
    else {
      // 住客（npc.charId）只用獨立入住句庫；未生成時使用通用居家台詞，不混入一般 chat 池。
      const characterId = npc.charId || save.settings.bindings[npc.seed];
      const pack = characterId ? activePackLines(save, characterId) : null;
      const residentPack = npc.charId ? activeResidentPackLines(save, npc.charId) : null;
      const lines = npc.charId
        ? residentPack?.home || npc.homeLines || COMPANION_LINES.home
        : pack?.chat || null;
      talkToNpc(npc, performance.now(), lines);
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
        openPanel({ type: building.opens, title: localizeValue(building.label), tab: building.panelTab });
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
    if (!plotUnlocked(plotIndex, save.cultivation)) showToast(translateText("world.plotLocked"));
    else {
      const plot = map.plots[plotIndex];
      walkTo(plot.x, plot.y, () => onPlotArrive(plotIndex));
    }
    return { worldX, worldY };
  }
  walkTo(tileX, tileY, null);
  return { worldX, worldY };
}
