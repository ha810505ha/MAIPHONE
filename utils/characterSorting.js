export function sortDisplayCharacters(characters) {
  const source = Array.isArray(characters) ? characters : [];
  const originalIndex = new Map(source.map((character, index) => [character, index]));

  return [...source].sort((a, b) => {
    if (Boolean(a.displayPinned) !== Boolean(b.displayPinned)) {
      return a.displayPinned ? -1 : 1;
    }
    const orderA = Number.isFinite(Number(a.displayOrder))
      ? Number(a.displayOrder)
      : Number.MAX_SAFE_INTEGER;
    const orderB = Number.isFinite(Number(b.displayOrder))
      ? Number(b.displayOrder)
      : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return originalIndex.get(a) - originalIndex.get(b);
  });
}
