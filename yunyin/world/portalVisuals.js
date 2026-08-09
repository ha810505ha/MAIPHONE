const portalSignature = (portal) => JSON.stringify([
  portal.to || "",
  portal.instanceId || "",
  portal.label || "",
  portal.icon || "",
  portal.spawn || null,
]);

const adjacent = (left, right) => Math.abs(left.x - right.x) + Math.abs(left.y - right.y) === 1;

// A doorway can cover multiple tiles so it stays easy to tap. Adjacent tiles
// with the same destination are rendered as one centered portal while all
// original tiles remain in map.portals for hit testing.
export function mergedPortalVisuals(portals = []) {
  const visited = new Set();
  const visuals = [];

  for (let start = 0; start < portals.length; start += 1) {
    if (visited.has(start)) continue;
    const signature = portalSignature(portals[start]);
    const group = [];
    const queue = [start];
    visited.add(start);

    while (queue.length) {
      const index = queue.shift();
      const portal = portals[index];
      group.push(portal);
      for (let candidate = 0; candidate < portals.length; candidate += 1) {
        if (visited.has(candidate)) continue;
        if (portalSignature(portals[candidate]) !== signature) continue;
        if (!adjacent(portal, portals[candidate])) continue;
        visited.add(candidate);
        queue.push(candidate);
      }
    }

    visuals.push({
      ...group[0],
      x: group.reduce((sum, portal) => sum + portal.x, 0) / group.length,
      y: group.reduce((sum, portal) => sum + portal.y, 0) / group.length,
      visualTileCount: group.length,
    });
  }

  return visuals;
}
