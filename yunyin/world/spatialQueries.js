export const buildingAt = (map, x, y) => (map.buildings || []).find((building) => (
  (x >= building.x - (building.collisionPadding?.left || 0)
    && x < building.x + building.w + (building.collisionPadding?.right || 0)
    && y >= building.y - (building.collisionPadding?.top || 0)
    && y < building.y + building.h + (building.collisionPadding?.bottom || 0))
  || (building.door?.[0] === x && building.door?.[1] === y)
)) || null;

// 容許 1 格誤差：傳送點視覺上有光暈延伸出格外，玩家點在光暈邊緣（尤其偏下，因為手指常擋住畫面）
// 若還卡在「精準點在那一格才算」，會常常點了卻沒反應。有多個候選時挑最近的那個。
export const portalAt = (map, x, y, radius = 1) => {
  let best = null, bestDist = Infinity;
  for (const portal of map.portals || []) {
    const dist = Math.max(Math.abs(portal.x - x), Math.abs(portal.y - y));
    if (dist <= radius && dist < bestDist) { best = portal; bestDist = dist; }
  }
  return best;
};

export const plotIndexAt = (map, x, y) => (map.plots || []).findIndex((plot) => plot.x === x && plot.y === y);

// 手指點擊需要比像素田格更寬鬆：0.5× 鏡頭時 32px tile 只剩 16px，
// 因此以畫面上的最小觸控尺寸反推世界座標命中範圍；範圍重疊時取最近地塊。
export const plotIndexNearPoint = (map, tilePointX, tilePointY, scale = 1, minHitSizePx = 56) => {
  const safeScale = Number(scale);
  const pointX = Number(tilePointX);
  const pointY = Number(tilePointY);
  if (!Number.isFinite(safeScale) || safeScale <= 0 || !Number.isFinite(pointX) || !Number.isFinite(pointY)) return -1;
  const halfHitTiles = Math.max(0.5, minHitSizePx / (2 * 32 * safeScale));
  let bestIndex = -1;
  let bestDistance = Infinity;
  (map.plots || []).forEach((plot, index) => {
    const dx = pointX - (plot.x + 0.5);
    const dy = pointY - (plot.y + 0.5);
    if (Math.abs(dx) > halfHitTiles || Math.abs(dy) > halfHitTiles) return;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
  });
  return bestIndex;
};
