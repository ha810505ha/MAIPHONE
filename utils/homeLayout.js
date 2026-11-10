export const HOME_PAGE_SIZE = 12;
export const HOME_PAGE_COUNT = 3;
export const HOME_SLOT_COUNT = HOME_PAGE_SIZE * HOME_PAGE_COUNT;

export const appEntry = (appId) => ({ type: "app", appId });

export const folderEntry = (appIds, name = "") => ({
  type: "folder",
  id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name,
  appIds: [...new Set(appIds.filter(Boolean))],
});

export const entryAppIds = (entry) => {
  if (!entry) return [];
  if (typeof entry === "string") return [entry];
  if (entry.type === "app" && entry.appId) return [entry.appId];
  if (entry.type === "folder" && Array.isArray(entry.appIds)) return entry.appIds;
  return [];
};

export const normalizeHomeSlots = (slots, allAppIds, dockIds = []) => {
  const valid = new Set(allAppIds);
  const dock = new Set(dockIds);
  const seen = new Set();
  const source = Array.isArray(slots) ? slots : [];
  const normalized = Array.from({ length: HOME_SLOT_COUNT }, (_, index) => {
    const raw = source[index];
    if (!raw) return null;
    const entry = typeof raw === "string" ? appEntry(raw) : raw;
    if (entry.type === "app") {
      const id = entry.appId;
      if (!valid.has(id) || dock.has(id) || seen.has(id)) return null;
      seen.add(id);
      return appEntry(id);
    }
    if (entry.type === "folder") {
      const appIds = (entry.appIds || []).filter((id) => {
        if (!valid.has(id) || dock.has(id) || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      if (!appIds.length) return null;
      if (appIds.length === 1) return appEntry(appIds[0]);
      return { type: "folder", id: entry.id || folderEntry([]).id, name: String(entry.name || ""), appIds };
    }
    return null;
  });
  return normalized;
};

export const findAppSlot = (slots, appId) => slots.findIndex((entry) => entryAppIds(entry).includes(appId));

export const removeAppFromSlots = (slots, appId) => slots.map((entry) => {
  if (!entry) return null;
  if (entry.type === "app") return entry.appId === appId ? null : entry;
  if (entry.type !== "folder" || !entry.appIds.includes(appId)) return entry;
  const appIds = entry.appIds.filter((id) => id !== appId);
  if (!appIds.length) return null;
  if (appIds.length === 1) return appEntry(appIds[0]);
  return { ...entry, appIds };
});

export const placedAppIds = (slots, dockIds = []) => new Set([
  ...dockIds,
  ...slots.flatMap(entryAppIds),
]);

export const addAppToFirstEmptySlot = (slots, appId, preferredPage = 1) => {
  if (findAppSlot(slots, appId) >= 0) return slots;
  const next = [...slots];
  const pageStart = Math.max(0, preferredPage) * HOME_PAGE_SIZE;
  let index = next.findIndex((entry, i) => i >= pageStart && i < pageStart + HOME_PAGE_SIZE && !entry);
  if (index < 0) index = next.findIndex((entry) => !entry);
  if (index < 0) return slots;
  next[index] = appEntry(appId);
  return next;
};

export const previewInsertApp = (slots, appId, targetIndex, after = false) => {
  const sourceIndex = findAppSlot(slots, appId);
  if (targetIndex < 0 || targetIndex >= slots.length) return slots;
  const next = [...slots];
  if (sourceIndex >= 0) next.splice(sourceIndex, 1);
  let insertIndex = targetIndex + (after ? 1 : 0);
  if (sourceIndex >= 0 && sourceIndex < insertIndex) insertIndex -= 1;
  insertIndex = Math.max(0, Math.min(insertIndex, next.length - (sourceIndex < 0 ? 1 : 0)));
  next.splice(insertIndex, 0, { type: "placeholder", appId });
  return next.slice(0, slots.length);
};

export const previewAppAtSource = (slots, appId) => {
  const sourceIndex = findAppSlot(slots, appId);
  if (sourceIndex < 0) return slots;
  const next = [...slots];
  next[sourceIndex] = { type: "placeholder", appId };
  return next;
};

export const commitHomePreview = (slots, appId) => slots.map((entry) => (
  entry?.type === "placeholder" && entry.appId === appId ? appEntry(appId) : entry
));

export const homePreviewKey = (slots) => slots.map((entry) => {
  if (!entry) return "_";
  if (entry.type === "app") return `a:${entry.appId}`;
  if (entry.type === "folder") return `f:${entry.id}`;
  if (entry.type === "placeholder") return `p:${entry.appId}`;
  return "_";
}).join("|");
