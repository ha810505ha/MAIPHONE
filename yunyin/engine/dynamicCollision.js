export const tileKey = (x, y) => `${x},${y}`;

export function buildDynamicCollision({ furniture = [], furnitureById }) {
  const blocked = new Set();
  for (const instance of furniture) {
    const definition = furnitureById(instance.furnitureId);
    if (!definition || definition.placement !== "floor") continue;
    const cells = definition.collision || [];
    for (const [dx, dy] of cells) blocked.add(tileKey(instance.x + dx, instance.y + dy));
  }
  return blocked;
}

export function withDynamicCollision(map, blocked = new Set()) {
  const baseIsBlocked = map.isBlocked;
  return { ...map, baseIsBlocked, dynamicCollision: blocked, isBlocked: (x, y) => baseIsBlocked(x, y) || blocked.has(tileKey(x, y)) };
}
