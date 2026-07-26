import { TILE } from "./tilemap";

export const createCamera = () => ({ x: 0, y: 0, follow: true });

export function clampCamera(camera, map, viewport, scale) {
  const worldWidth = map.w * TILE;
  const worldHeight = map.h * TILE;
  const viewWidth = viewport.width / scale;
  const viewHeight = viewport.height / scale;
  camera.x = worldWidth <= viewWidth ? (worldWidth - viewWidth) / 2 : Math.max(0, Math.min(worldWidth - viewWidth, camera.x));
  camera.y = worldHeight <= viewHeight ? (worldHeight - viewHeight) / 2 : Math.max(0, Math.min(worldHeight - viewHeight, camera.y));
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

