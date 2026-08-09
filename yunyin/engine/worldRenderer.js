import { TILE } from "./tilemap";
import { drawActor } from "./sprite";
import { actorRenderPos } from "./actorActions";
import { getImage, isReady } from "./assets";
import { BUILDING_IMAGES, WORLD_DECOR_IMAGES, TILE_IMAGES, CROP_IMAGES, FURNITURE_IMAGES } from "../data/assetUrls";
import { cropById, plotStage, plotUnlocked } from "../systems/farm";
import { furnitureById } from "../home/furnitureCatalog";

export function drawBuilding(ctx, building, camera, scale) {
  const sx = (building.x * TILE - camera.x) * scale;
  const sy = (building.y * TILE - camera.y) * scale;
  const width = building.w * TILE * scale;
  const height = building.h * TILE * scale;
  const image = building.img && getImage(BUILDING_IMAGES[building.img]);
  if (image && isReady(image)) {
    // 建築圖片可獨立放大，不改變實際碰撞占地與門口座標。
    const renderScale = Math.max(0.1, Number(building.renderScale) || 1);
    const drawWidth = width * renderScale;
    const drawHeight = drawWidth * (image.naturalHeight / image.naturalWidth);
    const drawX = sx + (width - drawWidth) / 2;
    ctx.drawImage(image, drawX, sy + height - drawHeight, drawWidth, drawHeight);
  } else {
    ctx.fillStyle = building.color;
    ctx.fillRect(sx, sy + height * 0.3, width, height * 0.7);
    ctx.fillStyle = building.roof;
    ctx.beginPath();
    ctx.moveTo(sx - width * 0.06, sy + height * 0.34);
    ctx.lineTo(sx + width / 2, sy - height * 0.08);
    ctx.lineTo(sx + width * 1.06, sy + height * 0.34);
    ctx.closePath(); ctx.fill();
    const doorX = (building.door[0] * TILE - camera.x) * scale;
    ctx.fillStyle = "#3a2c22";
    ctx.fillRect(doorX + TILE * scale * 0.25, sy + height - TILE * scale * 0.7, TILE * scale * 0.5, TILE * scale * 0.7);
  }
  if (building.showLabel !== false) {
    // 純白字+陰影在淺色地板（丹房木地板等）上對比度不夠、糊成一片，跟傳送點標籤同樣補一塊實色底板。
    const labelX = sx + width / 2, labelY = sy + height * 0.98;
    ctx.font = `${12 * scale}px sans-serif`;
    ctx.textAlign = "center";
    const labelWidth = ctx.measureText(building.label).width;
    const padX = 6 * scale, padY = 4 * scale;
    ctx.fillStyle = "rgba(0,0,0,.6)";
    ctx.beginPath();
    ctx.roundRect(labelX - labelWidth / 2 - padX, labelY - 11 * scale - padY / 2, labelWidth + padX * 2, 14 * scale + padY, 6 * scale);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.96)";
    ctx.fillText(building.label, labelX, labelY);
  }
}

export function drawWorldDecoration(ctx, decoration, camera, scale) {
  const tileSize = TILE * scale;
  const width = Math.max(1, decoration.w || 1) * tileSize;
  const footprintHeight = Math.max(1, decoration.h || 1) * tileSize;
  const sx = (decoration.x * TILE - camera.x) * scale;
  const sy = (decoration.y * TILE - camera.y) * scale;
  const image = decoration.img && getImage(WORLD_DECOR_IMAGES[decoration.img]);

  if (image && isReady(image)) {
    const renderScale = Math.max(0.1, Number(decoration.renderScale) || 1);
    const drawWidth = width * renderScale;
    const drawHeight = drawWidth * (image.naturalHeight / image.naturalWidth);
    const drawX = sx + (width - drawWidth) / 2;
    ctx.drawImage(image, drawX, sy + footprintHeight - drawHeight, drawWidth, drawHeight);
  } else {
    ctx.fillStyle = decoration.color || "#777";
    ctx.fillRect(sx, sy, width, footprintHeight);
  }
}

export function drawPortal(ctx, portal, camera, scale, now) {
  const sx = (portal.x * TILE + TILE / 2 - camera.x) * scale;
  const sy = (portal.y * TILE + TILE / 2 - camera.y) * scale;
  const pulse = 1 + Math.sin(now / 400) * 0.1;
  // 外圈光暈 + 內圈亮盤，在樹叢/草地上都醒目（整體再放大一輪，遠遠就能看清是傳送點）
  const glow = ctx.createRadialGradient(sx, sy, 2, sx, sy, TILE * scale * 0.95 * pulse);
  glow.addColorStop(0, "rgba(255, 232, 150, .55)");
  glow.addColorStop(1, "rgba(255, 232, 150, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(sx, sy, TILE * scale * 0.95 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.4)";
  ctx.beginPath(); ctx.arc(sx, sy, TILE * scale * 0.52 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(255, 224, 130, .9)";
  ctx.lineWidth = Math.max(1.5, 1.5 * scale);
  ctx.beginPath(); ctx.arc(sx, sy, TILE * scale * 0.56 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.font = `${21 * scale}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(portal.icon, sx, sy - 2);
  ctx.textBaseline = "alphabetic";
  // 標籤加底板，避免糊在地形上看不清
  const labelY = sy + TILE * scale * 0.72;
  ctx.font = `${9.5 * scale}px sans-serif`;
  const labelWidth = ctx.measureText(portal.label).width;
  ctx.fillStyle = "rgba(0,0,0,.55)";
  const padX = 5 * scale, padY = 4 * scale;
  ctx.beginPath();
  ctx.roundRect(sx - labelWidth / 2 - padX, labelY - 9 * scale - padY / 2, labelWidth + padX * 2, 12 * scale + padY, 6 * scale);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.95)";
  ctx.fillText(portal.label, sx, labelY);
}

export function drawFurniture(ctx, instance, camera, scale, selected = false) {
  const definition = furnitureById(instance.furnitureId);
  if (!definition) return;
  const tileSize = TILE * scale;
  const width = Math.max(1, definition.footprint?.w || 1) * tileSize;
  const height = Math.max(1, definition.footprint?.h || 1) * tileSize;
  const sx = (instance.x * TILE - camera.x) * scale;
  const sy = (instance.y * TILE - camera.y) * scale;
  const fallback = definition.fallback || {};
  const image = getImage(FURNITURE_IMAGES[instance.furnitureId]);

  if (image && isReady(image)) {
    // 以素材原始像素 × 統一縮放率繪製（素材包 32px = 1 格，跟角色貼圖同基準），
    // footprint 只管碰撞占地、不拉伸圖片——家具彼此、家具與角色的比例才會一致。
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const drawX = sx + (width - drawWidth) / 2;
    if (definition.placement === "rug") {
      // 地毯貼平：置中在占地範圍內。
      ctx.drawImage(image, drawX, sy + (height - drawHeight) / 2, drawWidth, drawHeight);
    } else {
      // 直立家具：水平置中、底部對齊占地底邊（圖可高出占地，蓋在後方牆上）。
      ctx.drawImage(image, drawX, sy + height - drawHeight, drawWidth, drawHeight);
    }
  } else if (definition.placement === "rug") {
    ctx.fillStyle = fallback.color || "#a96f63";
    ctx.fillRect(sx + tileSize * 0.08, sy + tileSize * 0.08, width - tileSize * 0.16, height - tileSize * 0.16);
    ctx.strokeStyle = fallback.accent || "rgba(255,255,255,.5)";
    ctx.lineWidth = Math.max(1, scale);
    ctx.strokeRect(sx + tileSize * 0.16, sy + tileSize * 0.16, width - tileSize * 0.32, height - tileSize * 0.32);
  } else {
    ctx.fillStyle = "rgba(43, 29, 20, .22)";
    ctx.fillRect(sx + tileSize * 0.12, sy + height * 0.68, width - tileSize * 0.24, height * 0.22);
    ctx.fillStyle = fallback.color || "#8f6545";
    ctx.fillRect(sx + tileSize * 0.08, sy + tileSize * 0.18, width - tileSize * 0.16, height - tileSize * 0.28);
    ctx.fillStyle = fallback.accent || "#d1aa82";
    ctx.fillRect(sx + tileSize * 0.16, sy + tileSize * 0.24, width - tileSize * 0.32, Math.max(3, tileSize * 0.12));
    if (definition.icon) {
      ctx.font = `${Math.min(18, 13 + (definition.footprint?.w || 1) * 2) * scale}px sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(definition.icon, sx + width / 2, sy + height * 0.56);
      ctx.textBaseline = "alphabetic";
    }
  }
  if (selected) {
    ctx.strokeStyle = "#ffe47d";
    ctx.lineWidth = Math.max(2, 2 * scale);
    ctx.setLineDash([4 * scale, 3 * scale]);
    ctx.strokeRect(sx + 2, sy + 2, width - 4, height - 4);
    ctx.setLineDash([]);
  }
}

export function drawFarmPlot(ctx, plotDefinition, index, now, { camera, scale, save }) {
  const tileSize = TILE * scale;
  const sx = (plotDefinition.x * TILE - camera.x) * scale;
  const sy = (plotDefinition.y * TILE - camera.y) * scale;
  const unlocked = plotUnlocked(index, save.cultivation);
  const soil = getImage(TILE_IMAGES.soil);
  if (isReady(soil)) {
    ctx.drawImage(soil, sx, sy, tileSize, tileSize);
    if (!unlocked) { ctx.fillStyle = "rgba(20,18,15,.55)"; ctx.fillRect(sx, sy, tileSize, tileSize); }
  } else {
    ctx.fillStyle = unlocked ? "#6e5137" : "#5a5248"; ctx.fillRect(sx + tileSize * 0.06, sy + tileSize * 0.06, tileSize * 0.88, tileSize * 0.88);
    ctx.fillStyle = unlocked ? "#83644a" : "#6b6357"; ctx.fillRect(sx + tileSize * 0.14, sy + tileSize * 0.14, tileSize * 0.72, tileSize * 0.72);
  }
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (!unlocked) {
    ctx.font = `${11 * scale}px sans-serif`; ctx.fillText("🔒", sx + tileSize / 2, sy + tileSize / 2);
  } else {
    const plot = save.farm.plots[index];
    const stage = plotStage(plot, Date.now());
    if (stage !== null) {
      const crop = cropById(plot.cropId);
      const cropImage = CROP_IMAGES[crop.id] && getImage(CROP_IMAGES[crop.id][stage]);
      if (stage === 3) {
        const pulse = 1 + Math.sin(now / 300) * 0.1;
        ctx.strokeStyle = "rgba(255, 205, 90, .9)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx + tileSize / 2, sy + tileSize / 2, tileSize * 0.4 * pulse, 0, Math.PI * 2); ctx.stroke();
      }
      if (cropImage && isReady(cropImage)) {
        // 等比例繪製、底部貼齊土壤格：作物素材有 32×32 也有 32×64（高的作物往上長），
        // 原本寬高都塞成正方形，會把兩格高的成熟作物（例：星露籽）壓扁。
        const drawWidth = tileSize * 0.9;
        const drawHeight = drawWidth * (cropImage.naturalHeight / cropImage.naturalWidth);
        ctx.drawImage(cropImage, sx + tileSize * 0.05, sy + tileSize * 0.95 - drawHeight, drawWidth, drawHeight);
      } else if (stage === 0) {
        ctx.fillStyle = "#4a3826";
        ctx.fillRect(sx + tileSize * 0.34, sy + tileSize * 0.46, tileSize * 0.08, tileSize * 0.08);
        ctx.fillRect(sx + tileSize * 0.58, sy + tileSize * 0.46, tileSize * 0.08, tileSize * 0.08);
      } else {
        ctx.font = `${(stage === 1 ? 9 : stage === 2 ? 11 : 14) * scale}px sans-serif`;
        ctx.fillText(stage === 1 ? "🌱" : crop.icon, sx + tileSize / 2, sy + tileSize * 0.5);
      }
    }
  }
  ctx.textBaseline = "alphabetic";
}

export function drawCharacter(ctx, actor, appearance, camera, scale, now) {
  const pos = actorRenderPos(actor);
  drawActor(ctx, appearance, {
    sx: (pos.x - camera.x) * scale,
    sy: (pos.y - camera.y) * scale,
    ts: TILE * scale,
    facing: actor.facing,
    moving: actor.moving,
    action: actor.action,
    now,
  });
}

export function drawNpcLabel(ctx, npc, label, camera, scale, helperLabel = "照料中") {
  if (!label) return;
  const tileSize = TILE * scale;
  const pos = actorRenderPos(npc);
  const x = (pos.x - camera.x) * scale + tileSize / 2;
  const y = (pos.y - camera.y) * scale - tileSize * 0.9;
  ctx.font = `${8 * scale}px sans-serif`; ctx.textAlign = "center"; ctx.fillStyle = "rgba(255,255,255,.95)";
  ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 3; ctx.strokeText(label, x, y); ctx.fillText(label, x, y);
  if (npc.helper) {
    ctx.font = `${6.5 * scale}px sans-serif`; ctx.fillStyle = "rgba(255,239,180,.98)"; ctx.strokeStyle = "rgba(70,45,35,.72)"; ctx.lineWidth = 2;
    ctx.fillText(helperLabel, x, y + 8 * scale);
  }
}

export function drawSpeechBubble(ctx, npc, camera, scale, viewWidth) {
  const tileSize = TILE * scale;
  const pos = actorRenderPos(npc);
  const centerX = (pos.x - camera.x) * scale + tileSize / 2;
  const topY = (pos.y - camera.y) * scale - tileSize * 1.4;
  ctx.font = `${10 * scale}px sans-serif`;
  const maxWidth = Math.min(220, viewWidth - 24), padding = 12, lineHeight = 13 * scale;
  const lines = []; let line = "";
  for (const char of String(npc.bubble.text || "").replace(/[\r\n]+/g, " ").trim()) {
    const candidate = line + char;
    if (line && ctx.measureText(candidate).width > maxWidth - padding * 2) { lines.push(line); line = char; } else line = candidate;
  }
  if (line) lines.push(line);
  const visible = lines.slice(0, 3);
  if (lines.length > 3) {
    let last = visible[visible.length - 1] || "";
    while (last && ctx.measureText(`${last}…`).width > maxWidth - padding * 2) last = last.slice(0, -1);
    visible[visible.length - 1] = `${last}…`;
  }
  const width = Math.min(maxWidth, Math.max(72, ...visible.map((value) => ctx.measureText(value).width + padding * 2)));
  const height = visible.length * lineHeight + 10;
  const x = Math.max(4, Math.min(viewWidth - width - 4, centerX - width / 2));
  ctx.fillStyle = "rgba(255,255,255,.94)"; ctx.beginPath(); ctx.roundRect(x, topY - height, width, height, 8); ctx.fill();
  ctx.fillStyle = "#4a4038"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  visible.forEach((value, index) => ctx.fillText(value, x + width / 2, topY - height / 2 + lineHeight * (index - (visible.length - 1) / 2)));
  ctx.textBaseline = "alphabetic";
}
