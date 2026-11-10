import { TILE } from "./tilemap";

export function createPlayerRuntime(spawn, facing = "down") {
  return { x: spawn[0], y: spawn[1], px: spawn[0] * TILE, py: spawn[1] * TILE, path: [], stepT: 0, from: null, facing, moving: false };
}

export function placeActor(actor, spawn, facing = actor.facing || "down") {
  Object.assign(actor, { x: spawn[0], y: spawn[1], px: spawn[0] * TILE, py: spawn[1] * TILE, path: [], stepT: 0, from: null, facing, moving: false });
}

export function updateActorMovement(actor, dt, stepMs, onArrive) {
  if (!actor.path.length) { actor.moving = false; return; }
  actor.moving = true;
  actor.stepT += dt;
  while (actor.path.length && actor.stepT >= stepMs) {
    const next = actor.path.shift();
    actor.x = next.x; actor.y = next.y; actor.stepT -= stepMs;
    if (!actor.path.length) onArrive?.();
  }
  if (actor.path.length) {
    const next = actor.path[0];
    actor.facing = next.x > actor.x ? "right" : next.x < actor.x ? "left" : next.y > actor.y ? "down" : "up";
    const progress = actor.stepT / stepMs;
    actor.px = (actor.x + (next.x - actor.x) * progress) * TILE;
    actor.py = (actor.y + (next.y - actor.y) * progress) * TILE;
  } else {
    actor.px = actor.x * TILE; actor.py = actor.y * TILE; actor.stepT = 0;
  }
}

