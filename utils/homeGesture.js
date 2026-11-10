export const HOME_GESTURE = Object.freeze({
  activationDistance: 8,
  directionRatio: 1.22,
  distanceRatio: 0.22,
  minimumDistance: 42,
  velocityThreshold: 0.45,
  projectionMs: 170,
  settleMs: 240,
  flickSettleMs: 180,
});

const finite = (...values) => values.every(Number.isFinite);

export function rubberBand(distance, dimension, constant = 0.42) {
  if (!Number.isFinite(distance) || !Number.isFinite(dimension) || dimension <= 0) {
    return 0;
  }
  return (distance * dimension * constant) /
    (dimension + constant * Math.abs(distance));
}

export function classifyHomeGesture({
  startX,
  startY,
  endX,
  endY,
  durationMs,
  viewportWidth = 390,
}) {
  if (!finite(startX, startY, endX, endY)) return null;

  const dx = endX - startX;
  const dy = endY - startY;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const hasDuration = Number.isFinite(durationMs) && durationMs > 0;
  const elapsed = hasDuration ? Math.max(1, durationMs) : 1;
  const vx = hasDuration ? dx / elapsed : 0;
  const vy = hasDuration ? dy / elapsed : 0;
  const horizontal = absX >= HOME_GESTURE.activationDistance &&
    absX > absY * HOME_GESTURE.directionRatio;
  const vertical = absY >= HOME_GESTURE.activationDistance &&
    absY > absX * HOME_GESTURE.directionRatio;
  const distanceThreshold = Math.max(
    HOME_GESTURE.minimumDistance,
    viewportWidth * HOME_GESTURE.distanceRatio,
  );

  if (horizontal) {
    const projected = dx + vx * HOME_GESTURE.projectionMs;
    if (Math.abs(dx) >= distanceThreshold ||
        Math.abs(vx) >= HOME_GESTURE.velocityThreshold ||
        Math.abs(projected) >= distanceThreshold) {
      return {
        axis: "x",
        direction: dx < 0 ? 1 : -1,
        velocity: vx,
        fast: Math.abs(vx) >= HOME_GESTURE.velocityThreshold,
      };
    }
  }

  if (vertical && dy < 0) {
    const projected = dy + vy * HOME_GESTURE.projectionMs;
    if (absY >= distanceThreshold ||
        -vy >= HOME_GESTURE.velocityThreshold ||
        -projected >= distanceThreshold) {
      return {
        axis: "y",
        direction: -1,
        velocity: vy,
        fast: -vy >= HOME_GESTURE.velocityThreshold,
      };
    }
  }

  return null;
}

export function resolveHomeSwipe(input) {
  const result = classifyHomeGesture(input);
  if (!result) return null;
  if (result.axis === "y") return "open-library";
  return result.direction > 0 ? "next-page" : "previous-page";
}

export function resolveLibrarySwipe(input) {
  const result = classifyHomeGesture(input);
  if (!result) return null;
  if (result.axis === "y") return "home";
  return result.direction > 0 ? "next-page" : "previous-page";
}
