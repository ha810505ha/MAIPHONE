export const NOTES_ENTITY_KEY = "ent_notes";

export function upsertNoteDraft(notes, draft, content, updatedAt = Date.now()) {
  const current = Array.isArray(notes) ? notes : [];
  if (!draft) return { item: null, notes: current };
  const item = {
    ...draft,
    title: String(draft.title || "").trim() || "未命名筆記",
    content: content ?? draft.content ?? "",
    updatedAt,
  };
  const next = current.some((note) => note.id === item.id)
    ? current.map((note) => (note.id === item.id ? item : note))
    : [item, ...current];
  return { item, notes: next };
}
