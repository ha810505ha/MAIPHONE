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
    const toExit = Math.max(Math.abs(portal.x - x), Math.abs(portal.y - y));
    // 戶外路口另有木牌（portal.sign）：點木牌附近也算點到出口
    const toSign = portal.sign ? Math.max(Math.abs(portal.sign[0] - x), Math.abs(portal.sign[1] - y)) : Infinity;
    const dist = Math.min(toExit, toSign);
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

// 建築／互動站實際畫出來的範圍（格座標）：圖片依 renderScale 放大、底部對齊占地底線，
// 常比占地高很多（例如丹爐只占 1 格、圖卻高出一截）。aspect = 圖高 / 圖寬，圖還沒載入就退回占地高度。
export const buildingVisualRect = (building, aspect = null) => {
  const renderScale = Math.max(0.1, Number(building.renderScale) || 1);
  const width = building.w * renderScale;
  const height = aspect > 0 ? width * aspect : building.h;
  const bottom = building.y + building.h;
  return { left: building.x + (building.w - width) / 2, right: building.x + (building.w + width) / 2, top: bottom - height, bottom };
};

// 以「畫面上看到的圖」判定點擊，並保證最小觸控尺寸（預設 56px）：
// 0.5× 鏡頭時 1 格只剩 16px，只認占地格的話丹爐這類小站幾乎點不到。範圍重疊時取最近的。
export const buildingAtPoint = (map, pointX, pointY, { scale = 1, aspectOf = () => null, minHitSizePx = 56, slackTiles = 0, filter = () => true } = {}) => {
  const safeScale = Number(scale) > 0 ? Number(scale) : 1;
  const minTiles = minHitSizePx / (32 * safeScale);
  let best = null;
  let bestDistance = Infinity;
  for (const building of map.buildings || []) {
    if (!filter(building)) continue;
    const rect = buildingVisualRect(building, aspectOf(building));
    const padX = Math.max(slackTiles, (minTiles - (rect.right - rect.left)) / 2);
    const padY = Math.max(slackTiles, (minTiles - (rect.bottom - rect.top)) / 2);
    if (pointX < rect.left - padX || pointX > rect.right + padX || pointY < rect.top - padY || pointY > rect.bottom + padY) continue;
    const dx = pointX - (rect.left + rect.right) / 2;
    const dy = pointY - (rect.top + rect.bottom) / 2;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) { best = building; bestDistance = distance; }
  }
  return best;
};
