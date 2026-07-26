export function resolveHomeSwipe({ startX, startY, endX, endY }) {
  if (![startX, startY, endX, endY].every(Number.isFinite)) return null;

  const diffX = startX - endX;
  const diffY = startY - endY;
  const absX = Math.abs(diffX);
  const absY = Math.abs(diffY);

  if (diffY > 70 && absY > absX * 1.25) return "open-library";
  if (absX < 18 || absY > absX * 1.35) return null;
  return diffX > 0 ? "next-page" : "previous-page";
}

export function resolveLibrarySwipe({ startX, startY, endX, endY }) {
  if (![startX, startY, endX, endY].every(Number.isFinite)) return null;

  const rise = startY - endY;
  const horizontal = startX - endX;
  const drift = Math.abs(horizontal);

  if (rise >= 58 && rise > drift * 1.15) return "home";
  if (drift < 42 || drift <= Math.abs(rise) * 1.15) return null;
  return horizontal > 0 ? "next-page" : "previous-page";
}
