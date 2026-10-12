// Draw a softly winding, tile-based road through a list of waypoints.
// A square brush keeps diagonal bends and junctions from collapsing into one-tile bottlenecks.
export function drawRoadPath(paint, points, width = 3) {
  if (typeof paint !== "function" || !Array.isArray(points) || points.length < 2) return;

  const brushSize = Math.max(1, Math.trunc(Number(width) || 1));
  const brushStart = -Math.floor((brushSize - 1) / 2);
  const brushEnd = brushStart + brushSize - 1;
  const stamp = (x, y) => {
    for (let offsetY = brushStart; offsetY <= brushEnd; offsetY += 1) {
      for (let offsetX = brushStart; offsetX <= brushEnd; offsetX += 1) {
        paint(x + offsetX, y + offsetY);
      }
    }
  };

  for (let index = 1; index < points.length; index += 1) {
    const [fromX, fromY] = points[index - 1];
    const [toX, toY] = points[index];
    const dx = toX - fromX;
    const dy = toY - fromY;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));

    for (let step = 0; step <= steps; step += 1) {
      const progress = steps ? step / steps : 0;
      const x = Math.round(fromX + dx * progress);
      const y = Math.round(fromY + dy * progress);
      stamp(x, y);
    }
  }
}

// ---- 戶外地圖外框：四周樹林＋依方位開路口 ----
// 2026-10-10：各區原本四面環水、靠傳送點連接，像一座座島。改成：
//   - 內容（房子、田、路）維持原座標寫法，外面再包一圈 margin 格的樹林，全部座標統一往內移 margin。
//   - 出口用「哪一邊、哪個位置、通往哪裡」描述，路口、出口格、進場位置都由這裡算出來，
//     之後要加新地圖，只要在對應的邊補一筆 exit，不必重排既有地圖。
export const OUTDOOR_MARGIN = 3;
const SIDES = new Set(["north", "south", "east", "west"]);

export function frameOutdoorMap(def, { margin = OUTDOOR_MARGIN, riverRows = 0, exits = [] } = {}) {
  const inner = def.tiles;
  const innerW = inner[0].length;
  const innerH = inner.length;
  const width = innerW + margin * 2;
  const height = innerH + margin * 2;
  const grid = Array.from({ length: height }, (_, y) => Array.from({ length: width }, () => (y < riverRows ? "~" : "T")));
  for (let y = 0; y < innerH; y += 1) for (let x = 0; x < innerW; x += 1) grid[y + margin][x + margin] = inner[y][x];

  const shiftPoint = (point) => (Array.isArray(point) ? [point[0] + margin, point[1] + margin] : point);
  const shiftRect = (item) => (item ? {
    ...item, x: item.x + margin, y: item.y + margin,
    ...(item.door ? { door: shiftPoint(item.door) } : {}),
    // 角色田（MP-030）內嵌的格子座標也要一起平移
    ...(item.crop ? { crop: { ...item.crop, x: item.crop.x + margin, y: item.crop.y + margin } } : {}),
    ...(item.plots ? { plots: item.plots.map(shiftPoint) } : {}),
    ...(item.gateTile ? { gateTile: shiftPoint(item.gateTile) } : {}),
    ...(item.gateTiles ? { gateTiles: item.gateTiles.map(shiftPoint) } : {}),
    ...(item.stand ? { stand: shiftPoint(item.stand) } : {}),
    ...(item.sign ? { sign: shiftPoint(item.sign) } : {}),
  } : item);
  const road = (x, y) => { if (x >= 0 && y >= 0 && x < width && y < height) grid[y][x] = "="; };

  const portals = exits.map((exit) => {
    if (!SIDES.has(exit.side)) throw new Error(`Unknown exit side: ${exit.side}`);
    const along = exit.at + margin;
    let tile;   // 出口光圈所在格：樹林內緣的路上（看得到、點得到）
    let inward;
    let sign;   // 路口旁的木牌：放在路的右手邊、樹林內緣那一格（點木牌也能走過去）
    let zone;   // 從光圈一路到地圖邊緣的路段：走進這段就換圖
    // 路口 3 格寬，從內圈邊緣一路鋪到地圖外緣；出口格在最外緣那一格
    if (exit.side === "north") {
      for (let y = riverRows; y < margin + 1; y += 1) for (let dx = -1; dx <= 1; dx += 1) road(along + dx, y);
      tile = [along, margin - 1]; inward = [along, margin + 1]; sign = [along + 2, margin];
      zone = { x0: along - 1, x1: along + 1, y0: riverRows, y1: margin - 1 };
    } else if (exit.side === "south") {
      for (let y = height - margin - 1; y < height; y += 1) for (let dx = -1; dx <= 1; dx += 1) road(along + dx, y);
      tile = [along, height - margin]; inward = [along, height - margin - 2]; sign = [along + 2, height - margin - 1];
      zone = { x0: along - 1, x1: along + 1, y0: height - margin, y1: height - 1 };
    } else if (exit.side === "west") {
      for (let x = 0; x < margin + 1; x += 1) for (let dy = -1; dy <= 1; dy += 1) road(x, along + dy);
      tile = [margin - 1, along]; inward = [margin + 1, along]; sign = [margin, along - 2];
      zone = { x0: 0, x1: margin - 1, y0: along - 1, y1: along + 1 };
    } else {
      for (let x = width - margin - 1; x < width; x += 1) for (let dy = -1; dy <= 1; dy += 1) road(x, along + dy);
      tile = [width - margin, along]; inward = [width - margin - 2, along]; sign = [width - margin - 1, along - 2];
      zone = { x0: width - margin, x1: width - 1, y0: along - 1, y1: along + 1 };
    }
    return {
      x: tile[0], y: tile[1], to: exit.to, label: exit.label, icon: exit.icon,
      side: exit.side, edge: true, arrival: inward, sign, zone, keepTrees: !!exit.keepTrees,
      // spawn 由 mapRegistry 依目的地對應出口的 arrival 補上；目的地不是地圖（例如秘境面板）就沒有 spawn
      spawn: exit.spawn ? shiftPoint(exit.spawn) : null,
    };
  });

  return {
    ...def,
    tiles: grid.map((row) => row.join("")),
    frameMargin: margin,
    spawn: shiftPoint(def.spawn),
    buildings: (def.buildings || []).map(shiftRect),
    decorations: (def.decorations || []).map(shiftRect),
    cityLots: (def.cityLots || []).map(shiftRect),
    homeLots: (def.homeLots || []).map(shiftRect),
    fieldZones: (def.fieldZones || []).map(shiftRect),
    futureZones: (def.futureZones || []).map(shiftRect),
    zones: (def.zones || []).map(shiftRect),
    plots: (def.plots || []).map((plot) => ({ ...plot, x: plot.x + margin, y: plot.y + margin })),
    portals: [...(def.portals || []).map(shiftRect), ...portals],
  };
}

// 出口互相對應：A 地圖往 B 的出口，進場位置 = B 地圖「往 A 的出口」往內一格的位置。
export function linkOutdoorExits(definitions) {
  for (const [mapId, def] of Object.entries(definitions)) {
    for (const portal of def.portals || []) {
      if (!portal.edge || portal.spawn || !definitions[portal.to]) continue;
      const back = (definitions[portal.to].portals || []).find((item) => item.edge && item.to === mapId);
      if (back?.arrival) portal.spawn = back.arrival;
    }
  }
  return definitions;
}
