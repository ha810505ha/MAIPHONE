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
