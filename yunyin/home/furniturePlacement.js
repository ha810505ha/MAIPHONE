export function furnitureTiles(definition, x, y) {
  if (!definition) return [];
  const width = Math.max(1, definition.footprint?.w || 1);
  const height = Math.max(1, definition.footprint?.h || 1);
  const tiles = [];
  for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) tiles.push({ x: x + dx, y: y + dy });
  return tiles;
}

export function canPlaceFurniture({ definition, x, y, map, occupied = new Set(), reserved = new Set() }) {
  const tiles = furnitureTiles(definition, x, y);
  return tiles.length > 0 && tiles.every((tile) => {
    const key = `${tile.x},${tile.y}`;
    return !map.isBlocked(tile.x, tile.y) && !occupied.has(key) && !reserved.has(key);
  });
}

