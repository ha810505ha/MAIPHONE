import { TILE } from "../engine/tilemap";
import { activePackLines, activeResidentPackLines } from "../systems/ai";
import { COMPANION_LINES } from "../data/lines";
import { npcAtTile, talkToNpc } from "../systems/npc";
import { npcAtWorldPoint } from "./npcHitTest";
import { plotUnlocked } from "../systems/farm";
import { npcFieldEdgeAt, npcFieldPlotAt, npcFieldPlotNear } from "../systems/npcFields.js";
import { buildingAt, buildingAtPoint, plotIndexAt, plotIndexNearPoint, portalAt } from "./spatialQueries";
import { getImage, isReady } from "../engine/assets";
import { BUILDING_IMAGES } from "../data/assetUrls";

// 互動站（丹爐、櫃台、貨架、訂單攤）：點了開面板、不換地圖的建築。
const isStation = (building) => !!building.opens && !building.to;
const imageAspectOf = (building) => {
  const image = building.img && getImage(BUILDING_IMAGES[building.img]);
  return image && isReady(image) ? image.naturalHeight / image.naturalWidth : null;
};
import { worldInteractionAt } from "./worldInteractions";

export function routeWorldTap({ screenX, screenY, camera, scale, map, player, npcs, save, hasMap, walkTo, switchMap, openPanel, showToast, onPlotArrive, onNpcField, onWorldInteraction, translateText = (key) => key, localizeValue = (value) => value }) {
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
  const openBuilding = (building) => {
    walkTo(building.door[0], building.door[1], () => {
      if (building.to && hasMap(building.to)) {
        switchMap(building.to, building.spawn, { instanceId: building.instanceId });
      } else {
        openPanel({ type: building.opens, title: localizeValue(building.label), tab: building.panelTab });
      }
    });
  };
  // 點在互動站「畫出來的圖」上就算點到站，優先於剛好走過的 NPC（站前常有人經過，會把點擊搶走）
  const stationOnImage = buildingAtPoint(map, worldX / TILE, worldY / TILE, { scale, aspectOf: imageAspectOf, minHitSizePx: 0, filter: isStation });
  if (stationOnImage) {
    openBuilding(stationOnImage);
    return { worldX, worldY };
  }
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
    openBuilding(building);
    return { worldX, worldY };
  }
  // 互動站再放寬一點：圖邊外約 1/3 格、且畫面上至少 56px 見方，手指稍微點偏也能命中
  const nearStation = buildingAtPoint(map, worldX / TILE, worldY / TILE, { scale, aspectOf: imageAspectOf, slackTiles: 0.35, filter: isStation });
  if (nearStation) {
    openBuilding(nearStation);
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
  // 住客角色田：走進田裡點作物格 → 走到那格才打開幫忙／偷菜；
  // 點圍欄或田邊木牌 → 走到柵門外只看田的資訊；田裡其他空地就是一般走路
  const npcPlot = onNpcField
    ? npcFieldPlotAt(map.fieldZones, tileX, tileY) || npcFieldPlotNear(map.fieldZones, worldX / TILE, worldY / TILE)
    : null;
  if (npcPlot) {
    const [plotX, plotY] = npcPlot.zone.plots[npcPlot.index];
    walkTo(plotX, plotY, () => onNpcField(npcPlot.zone, { plotIndex: npcPlot.index }));
    return { worldX, worldY };
  }
  const npcFieldEdge = onNpcField ? npcFieldEdgeAt(map.fieldZones, tileX, tileY) : null;
  if (npcFieldEdge) {
    walkTo(npcFieldEdge.stand[0], npcFieldEdge.stand[1], () => onNpcField(npcFieldEdge));
    return { worldX, worldY };
  }
  const exactPlotIndex = plotIndexAt(map, tileX, tileY);
  const nearPlotIndex = exactPlotIndex >= 0 ? exactPlotIndex : plotIndexNearPoint(map, worldX / TILE, worldY / TILE, scale);
  // 上鎖的田格：只有剛好點在那塊土上才提示境界不足；點在旁邊就照常走路（才走得進還沒開墾的田）。
  // 已開墾的田格維持寬鬆命中，手指點偏也能種／收。
  const plotIndex = exactPlotIndex >= 0 ? exactPlotIndex
    : nearPlotIndex >= 0 && plotUnlocked(nearPlotIndex, save.cultivation) ? nearPlotIndex : -1;
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
