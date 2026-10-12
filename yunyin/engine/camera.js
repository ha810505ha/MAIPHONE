import { TILE } from "./tilemap";

export const createCamera = () => ({ x: 0, y: 0, follow: true });

// topInset：畫面上方被 HUD（返回、地名、金幣結晶）蓋住的高度（px）。允許鏡頭往上多捲這段，
// 地圖最上排的傳送點、建築才不會永遠躲在 HUD 後面。
export function clampCamera(camera, map, viewport, scale, topInset = 0) {
  const worldWidth = map.w * TILE;
  const worldHeight = map.h * TILE;
  const viewWidth = viewport.width / scale;
  const viewHeight = viewport.height / scale;
  const minY = -Math.max(0, topInset) / scale;
  camera.x = worldWidth <= viewWidth ? (worldWidth - viewWidth) / 2 : Math.max(0, Math.min(worldWidth - viewWidth, camera.x));
  camera.y = worldHeight - minY <= viewHeight ? (worldHeight - viewHeight) / 2 : Math.max(minY, Math.min(worldHeight - viewHeight, camera.y));
}

export function centerCameraOnActor(camera, actor, viewport, scale) {
  camera.x = actor.px + TILE / 2 - viewport.width / scale / 2;
  camera.y = actor.py + TILE / 2 - viewport.height / scale / 2;
}

export function followActor(camera, actor, viewport, scale, smoothing = 0.12) {
  const targetX = actor.px + TILE / 2 - viewport.width / scale / 2;
  const targetY = actor.py + TILE / 2 - viewport.height / scale / 2;
  camera.x += (targetX - camera.x) * smoothing;
  camera.y += (targetY - camera.y) * smoothing;
}

