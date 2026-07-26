// Draw a softly winding, tile-based road through a list of waypoints.
// A square brush keeps diagonal bends and junctions from collapsing into one-tile bottlenecks.
export function drawRoadPath(paint, points, width = 3) {
  if (typeof paint !== "function" || !Array.isArray(points) || points.length < 2) return;

  const brushSize = Math.max(1, Math.trunc(Number(width) || 1));
  const brushStart = -Math.floor((brushSize - 1) / 2);
  const brushEnd = brushStart + brushSize - 1;
  const stamp = (x, y) => {
    for (let offsetY = brushStart; offsetY <= brushEnd; offsetY += 1) {
      for (let offsetX = brushStart; offsetX <= brushEnd; offsetX += 1) {
        paint(x + offsetX, y + offsetY);
      }
    }
  };

  for (let index = 1; index < points.length; index += 1) {
    const [fromX, fromY] = points[index - 1];
    const [toX, toY] = points[index];
    const dx = toX - fromX;
    const dy = toY - fromY;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));

    for (let step = 0; step <= steps; step += 1) {
      const progress = steps ? step / steps : 0;
      const x = Math.round(fromX + dx * progress);
      const y = Math.round(fromY + dy * progress);
      stamp(x, y);
    }
  }
}
