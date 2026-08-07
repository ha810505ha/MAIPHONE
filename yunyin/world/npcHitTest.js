import { actorRenderPos } from "../engine/actorActions.js";

const ACTOR_TILE_SIZE = 32;

// 角色圖實際從所在格往上延伸一格，總高度為兩格。互動範圍必須和畫面
// 上的完整角色一致，否則縮小鏡頭時點身體或頭部只會被判定成上方地面。
// 位置一律走 actorRenderPos，坐在椅子上被往上抬時點擊範圍才會跟著移動。
export function npcAtWorldPoint(npcs, worldX, worldY) {
  const candidates = (Array.isArray(npcs) ? npcs : []).filter((npc) => {
    const pos = actorRenderPos(npc);
    return worldX >= pos.x && worldX <= pos.x + ACTOR_TILE_SIZE
      && worldY >= pos.y - ACTOR_TILE_SIZE && worldY <= pos.y + ACTOR_TILE_SIZE;
  });
  if (candidates.length <= 1) return candidates[0];
  return candidates.reduce((nearest, npc) => {
    const pos = actorRenderPos(npc);
    const distance = Math.hypot(worldX - (pos.x + ACTOR_TILE_SIZE / 2), worldY - pos.y);
    return !nearest || distance < nearest.distance ? { npc, distance } : nearest;
  }, null)?.npc;
}
