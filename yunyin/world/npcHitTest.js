const ACTOR_TILE_SIZE = 32;

// 角色圖實際從所在格往上延伸一格，總高度為兩格。互動範圍必須和畫面
// 上的完整角色一致，否則縮小鏡頭時點身體或頭部只會被判定成上方地面。
export function npcAtWorldPoint(npcs, worldX, worldY) {
  const candidates = (Array.isArray(npcs) ? npcs : []).filter((npc) => {
    const offset = npc.action?.renderOffset || { x: 0, y: 0 };
    const left = npc.px + (offset.x || 0) * ACTOR_TILE_SIZE;
    const top = npc.py + (offset.y || 0) * ACTOR_TILE_SIZE - ACTOR_TILE_SIZE;
    return worldX >= left && worldX <= left + ACTOR_TILE_SIZE
      && worldY >= top && worldY <= top + ACTOR_TILE_SIZE * 2;
  });
  if (candidates.length <= 1) return candidates[0];
  return candidates.reduce((nearest, npc) => {
    const offset = npc.action?.renderOffset || { x: 0, y: 0 };
    const centerX = npc.px + (offset.x || 0) * ACTOR_TILE_SIZE + ACTOR_TILE_SIZE / 2;
    const centerY = npc.py + (offset.y || 0) * ACTOR_TILE_SIZE;
    const distance = Math.hypot(worldX - centerX, worldY - centerY);
    return !nearest || distance < nearest.distance ? { npc, distance } : nearest;
  }, null)?.npc;
}
