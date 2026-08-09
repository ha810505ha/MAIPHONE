export function parseChangelogItem(item) {
  const text = String(item ?? "");
  const divider = text.match(/\s*(?:｜|\|)\s*/);

  if (!divider || divider.index == null) {
    return { title: "", detail: text };
  }

  return {
    title: text.slice(0, divider.index).trim(),
    detail: text.slice(divider.index + divider[0].length),
  };
}
