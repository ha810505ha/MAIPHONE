import { useMemo, useState } from "react";
import {
  HOME_PAGE_COUNT,
  HOME_PAGE_SIZE,
  addAppToFirstEmptySlot,
  normalizeHomeSlots,
  placedAppIds,
  removeAppFromSlots,
} from "../../utils/homeLayout";

export default function useHomeCustomization({ apps, homeSlots, setHomeSlots, dockOrder, setDockOrder }) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [openFolderId, setOpenFolderId] = useState(null);
  const allAppIds = useMemo(() => apps.map((app) => app.id), [apps]);
  const safeDock = dockOrder.filter((id) => allAppIds.includes(id)).slice(0, 4);
  const cleanedSlots = normalizeHomeSlots(homeSlots, allAppIds, safeDock);
  const homePages = Array.from({ length: HOME_PAGE_COUNT }, (_, page) => cleanedSlots.slice(page * HOME_PAGE_SIZE, (page + 1) * HOME_PAGE_SIZE));
  const placedIds = placedAppIds(cleanedSlots, safeDock);
  const openFolder = cleanedSlots.find((entry) => entry?.type === "folder" && entry.id === openFolderId) || null;

  const addToHome = (appId) => setHomeSlots((slots) => addAppToFirstEmptySlot(normalizeHomeSlots(slots, allAppIds, safeDock), appId));
  const removeFromHome = (appId) => {
    setHomeSlots((slots) => removeAppFromSlots(normalizeHomeSlots(slots, allAppIds, safeDock), appId));
    setDockOrder((dock) => dock.filter((id) => id !== appId));
  };
  const applyHomeSelection = (selectedIds) => {
    const selected = new Set(selectedIds.filter((id) => allAppIds.includes(id)));
    const nextDock = safeDock.filter((id) => selected.has(id));
    setDockOrder(nextDock);
    setHomeSlots((slots) => {
      let next = normalizeHomeSlots(slots, allAppIds, nextDock);
      allAppIds.forEach((id) => {
        if (!selected.has(id)) next = removeAppFromSlots(next, id);
      });
      selected.forEach((id) => {
        if (!nextDock.includes(id)) next = addAppToFirstEmptySlot(next, id);
      });
      return next;
    });
  };
  const renameFolder = (name) => setHomeSlots((slots) => slots.map((entry) => entry?.type === "folder" && entry.id === openFolderId ? { ...entry, name } : entry));
  const removeFromFolder = (appId) => {
    setHomeSlots((slots) => removeAppFromSlots(slots, appId));
    if (openFolder?.appIds.length <= 2) setOpenFolderId(null);
  };

  return {
    allAppIds, safeDock, cleanedSlots, homePages, placedIds, openFolder,
    libraryOpen, openLibrary: () => setLibraryOpen(true), closeLibrary: () => setLibraryOpen(false),
    showFolder: (folder) => setOpenFolderId(folder.id), closeFolder: () => setOpenFolderId(null),
    addToHome, removeFromHome, applyHomeSelection, renameFolder, removeFromFolder,
  };
}
