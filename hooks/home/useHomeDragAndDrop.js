import { useRef } from "react";
import { appEntry, commitHomePreview, entryAppIds, findAppSlot, folderEntry, homePreviewKey, previewAppAtSource, previewInsertApp, removeAppFromSlots } from "../../utils/homeLayout";
import { resolveHomeSwipe } from "../../utils/homeGesture.js";

export default function useHomeDragAndDrop({
  allAppIds,
  safeDock,
  cleanedSlots,
  dockApps,
  homePages,
  homePage,
  setHomePage,
  setHomeSlots,
  setDockOrder,
  isDraggingApp,
  setIsDraggingApp,
  pointerDrag,
  setPointerDrag,
  swipeStartXRef,
  swipeStartYRef,
  edgeTurnTimerRef,
  edgeTurnDirRef,
  suppressAppClickUntilRef,
  pageSize,
  openApp,
  openAllApps,
}) {
  const folderHoverRef = useRef({ slot: null, timer: null });
  const dragPressRef = useRef(null);
  const pointerMoveRafRef = useRef(null);
  const pendingPointerMoveRef = useRef(null);
  const dragActiveRef = useRef(false);
  const suppressHomeGestureUntilRef = useRef(0);
  const touchSwipeRef = useRef(null);
  const lastPointerGestureAtRef = useRef(0);
  const clearFolderHover = () => {
    clearTimeout(folderHoverRef.current.timer);
    folderHoverRef.current = { slot: null, timer: null };
  };
  const moveAppToHomeSlot = (appId, targetSlotIndex, createFolder = false) => {
    if (!allAppIds.includes(appId)) return;
    const nextDock = safeDock.filter((id) => id !== appId);
    const nextSlots = removeAppFromSlots(cleanedSlots, appId);
    const fromSlot = findAppSlot(cleanedSlots, appId);
    const occupant = nextSlots[targetSlotIndex];
    if (createFolder && occupant?.type === "app" && occupant.appId !== appId) {
      nextSlots[targetSlotIndex] = folderEntry([occupant.appId, appId]);
    } else if (createFolder && occupant?.type === "folder") {
      nextSlots[targetSlotIndex] = { ...occupant, appIds: [...new Set([...occupant.appIds, appId])] };
    } else {
      nextSlots[targetSlotIndex] = appEntry(appId);
      if (occupant && fromSlot >= 0 && fromSlot !== targetSlotIndex) nextSlots[fromSlot] = occupant;
      else if (occupant && fromSlot < 0) {
        const emptyIndex = nextSlots.findIndex((entry) => !entry);
        if (emptyIndex >= 0) nextSlots[emptyIndex] = occupant;
      }
    }
    setDockOrder(nextDock);
    setHomeSlots(nextSlots);
  };
  const moveAppToDock = (appId, targetDockIndex) => {
    if (!allAppIds.includes(appId)) return;
    const isFromDock = safeDock.includes(appId);
    let nextDock = safeDock.filter((id) => id !== appId);
    if (!isFromDock && nextDock.length >= 4) return;
    if (isFromDock && nextDock.length < 2) return;
    const idx = Math.max(0, Math.min(targetDockIndex, nextDock.length));
    nextDock.splice(idx, 0, appId);
    const nextSlots = removeAppFromSlots(cleanedSlots, appId);
    setDockOrder(nextDock);
    setHomeSlots(nextSlots);
  };
  const onHomeTouchStart = (e) => {
    const touch = e.touches?.[0];
    touchSwipeRef.current = touch
      ? { x: touch.clientX, y: touch.clientY }
      : null;
  };
  const switchHomePageBySwipe = (sx, sy, ex, ey) => {
    // React state 在 pointerup 當幀可能仍保留 pointerdown 時的舊值。
    // 真正的同步拖曳狀態以 ref 為準，否則從 App 圖示起手的滑動會被誤判。
    if (dragActiveRef.current) return;
    if (Date.now() < suppressHomeGestureUntilRef.current) return;
    const action = resolveHomeSwipe({ startX: sx, startY: sy, endX: ex, endY: ey });
    if (action === "open-library") {
      openAllApps?.();
      return;
    }
    if (action === "next-page") setHomePage(p => Math.min(p + 1, homePages.length - 1));
    else if (action === "previous-page") setHomePage(p => Math.max(p - 1, 0));
  };
  const onHomeTouchEnd = (e) => {
    const start = touchSwipeRef.current;
    touchSwipeRef.current = null;
    if (!start || dragActiveRef.current || pointerDrag) return;
    // Chrome 會依序送出 pointerup 與 touchend；Pointer 已完成時不要再換一次頁。
    if (Date.now() - lastPointerGestureAtRef.current < 250) return;
    const touch = e.changedTouches?.[0];
    switchHomePageBySwipe(
      start.x,
      start.y,
      touch?.clientX ?? null,
      touch?.clientY ?? null,
    );
  };
  const onHomeTouchCancel = () => {
    touchSwipeRef.current = null;
  };
  const onHomeMouseDown = (e) => {
    if (dragActiveRef.current || isDraggingApp || pointerDrag) return;
    swipeStartXRef.current = e.clientX ?? null;
    swipeStartYRef.current = e.clientY ?? null;
  };
  const onHomeMouseUp = (e) => {
    if (dragActiveRef.current || isDraggingApp || pointerDrag) {
      swipeStartXRef.current = null;
      swipeStartYRef.current = null;
      return;
    }
    const sx = swipeStartXRef.current;
    const sy = swipeStartYRef.current;
    const ex = e.clientX ?? null;
    const ey = e.clientY ?? null;
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    switchHomePageBySwipe(sx, sy, ex, ey);
  };
  const onHomePointerDown = (e) => {
    if (dragActiveRef.current || pointerDrag) return;
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_) {}
    swipeStartXRef.current = e.clientX ?? null;
    swipeStartYRef.current = e.clientY ?? null;
  };
  const onHomePointerUp = (e) => {
    const pendingPress = dragPressRef.current;
    if (!pointerDrag && pendingPress) {
      clearTimeout(pendingPress.timer);
      dragPressRef.current = null;
      setIsDraggingApp(false);
      dragActiveRef.current = false;
      const ex = e.clientX ?? null;
      const ey = e.clientY ?? null;
      swipeStartXRef.current = null;
      swipeStartYRef.current = null;
      if (pendingPress.cancelled) {
        suppressAppClickUntilRef.current = Date.now() + 250;
        lastPointerGestureAtRef.current = Date.now();
        switchHomePageBySwipe(pendingPress.startX, pendingPress.startY, ex, ey);
      } else {
        lastPointerGestureAtRef.current = Date.now();
        openApp(pendingPress.appId);
      }
      return;
    }
    if (pointerDrag) {
      const dragging = pointerDrag;
      // Android WebView may emit touchend/mouseup after pointerup. Clear the
      // swipe origin and briefly suppress those compatibility end events so a
      // completed upward drag cannot also open the app library.
      swipeStartXRef.current = null;
      swipeStartYRef.current = null;
      lastPointerGestureAtRef.current = Date.now();
      suppressHomeGestureUntilRef.current = Date.now() + 450;
      if (pointerMoveRafRef.current) { cancelAnimationFrame(pointerMoveRafRef.current); pointerMoveRafRef.current = null; }
      pendingPointerMoveRef.current = null;
      setPointerDrag(null);
      setIsDraggingApp(false);
      dragActiveRef.current = false;
      clearFolderHover();
      clearTimeout(edgeTurnTimerRef.current);
      edgeTurnTimerRef.current = null;
      edgeTurnDirRef.current = null;
      const upDx = Math.abs((e.clientX || 0) - (dragging.startX || 0));
      const upDy = Math.abs((e.clientY || 0) - (dragging.startY || 0));
      const movedByDistance = (upDx + upDy) > 8;
      if (!dragging.moved && !movedByDistance) {
        openApp(dragging.appId);
        return;
      }
      suppressAppClickUntilRef.current = Date.now() + 350;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const slotEl = el?.closest?.("[data-drop-slot]");
      const dockEl = el?.closest?.("[data-drop-dock]");
      const dockWrap = el?.closest?.("[data-drop-dock-wrap]");
      if (slotEl) {
        const slot = Number(slotEl.getAttribute("data-drop-slot"));
        if (!Number.isNaN(slot) && dragging.folderArmedSlot === slot) moveAppToHomeSlot(dragging.appId, slot, true);
        else if (dragging.previewSlots) {
          setHomeSlots(commitHomePreview(dragging.previewSlots, dragging.appId));
          if (dragging.fromArea === "dock") setDockOrder((dock) => dock.filter((id) => id !== dragging.appId));
        }
      } else if (dockWrap) {
        const rect = dockWrap.getBoundingClientRect();
        const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const slotCount = Math.max(1, dockApps.length);
        const ratio = relX / rect.width;
        const targetIndex = Math.max(0, Math.min(dockApps.length, Math.round(ratio * slotCount)));
        moveAppToDock(dragging.appId, targetIndex);
      } else if (dockEl) {
        const idx = Number(dockEl.getAttribute("data-drop-dock"));
        if (!Number.isNaN(idx)) moveAppToDock(dragging.appId, idx);
      }
      return;
    }
    const sx = swipeStartXRef.current;
    const sy = swipeStartYRef.current;
    const ex = e.clientX ?? null;
    const ey = e.clientY ?? null;
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    lastPointerGestureAtRef.current = Date.now();
    switchHomePageBySwipe(sx, sy, ex, ey);
  };
  const onHomePointerMove = (e) => {
    const pendingPress = dragPressRef.current;
    if (!pointerDrag && pendingPress) {
      const dx = Math.abs((e.clientX || 0) - pendingPress.startX);
      const dy = Math.abs((e.clientY || 0) - pendingPress.startY);
      if (!pendingPress.cancelled && dx + dy > 8) {
        clearTimeout(pendingPress.timer);
        dragPressRef.current = { ...pendingPress, timer: null, cancelled: true };
      }
      return;
    }
    if (!pointerDrag) return;
    pendingPointerMoveRef.current = { clientX: e.clientX, clientY: e.clientY, currentTarget: e.currentTarget };
    if (pointerMoveRafRef.current) return;
    pointerMoveRafRef.current = requestAnimationFrame(() => {
      pointerMoveRafRef.current = null;
      const point = pendingPointerMoveRef.current;
      if (!point || !pointerDrag) return;
      const dx = Math.abs((point.clientX || 0) - pointerDrag.startX);
      const dy = Math.abs((point.clientY || 0) - pointerDrag.startY);
      const moved = dx + dy > 8;
      setPointerDrag((p) => ({ ...p, x: point.clientX || 0, y: point.clientY || 0, moved }));
      const hoverElement = document.elementFromPoint(point.clientX, point.clientY);
      const hoverSlotElement = hoverElement?.closest?.("[data-drop-slot]");
      const hoverSlot = Number(hoverSlotElement?.getAttribute("data-drop-slot"));
      const visualSlots = pointerDrag.previewSlots || cleanedSlots;
      const hoverEntry = !Number.isNaN(hoverSlot) ? visualSlots[hoverSlot] : null;
      const rect = hoverSlotElement?.getBoundingClientRect?.();
      const xRatio = rect ? (point.clientX - rect.left) / rect.width : .5;
      const centered = rect && xRatio > .28 && xRatio < .72 && point.clientY > rect.top + rect.height * .15 && point.clientY < rect.bottom - rect.height * .15;
      const canMerge = centered && hoverEntry && !entryAppIds(hoverEntry).includes(pointerDrag.appId);
      const placeholderElement = document.querySelector('[data-drag-placeholder="1"]');
      const placeholderRect = placeholderElement?.getBoundingClientRect?.();
      const holdsPreview = pointerDrag.previewSlots && placeholderRect
        && point.clientX >= placeholderRect.left - 16 && point.clientX <= placeholderRect.right + 16
        && point.clientY >= placeholderRect.top - 12 && point.clientY <= placeholderRect.bottom + 12;
      if (holdsPreview) {
        if (folderHoverRef.current.slot !== null) clearFolderHover();
        if (pointerDrag.folderArmedSlot !== null && pointerDrag.folderArmedSlot !== undefined) {
          setPointerDrag((p) => ({ ...p, folderArmedSlot: null }));
        }
      } else if (!canMerge) {
        if (folderHoverRef.current.slot !== null) clearFolderHover();
        const canInsert = hoverSlotElement && !Number.isNaN(hoverSlot);
        const hoveringPlaceholder = hoverEntry?.type === "placeholder" && hoverEntry.appId === pointerDrag.appId;
        const previewSlots = hoveringPlaceholder
          ? pointerDrag.previewSlots
          : canInsert ? previewInsertApp(cleanedSlots, pointerDrag.appId, hoverSlot, xRatio >= .5)
          : previewAppAtSource(cleanedSlots, pointerDrag.appId);
        const previewKey = homePreviewKey(previewSlots);
        const insertionSlot = hoveringPlaceholder ? hoverSlot : (canInsert ? hoverSlot : null);
        const insertionAfter = hoveringPlaceholder ? pointerDrag.insertionAfter : (canInsert ? xRatio >= .5 : false);
        setPointerDrag((p) => ({
          ...(p && homePreviewKey(p.previewSlots || []) === previewKey && p.insertionSlot === insertionSlot && p.insertionAfter === insertionAfter ? p : {
            ...p,
            previewSlots,
            insertionSlot,
            insertionAfter,
          }),
          folderArmedSlot: null,
        }));
      } else if (folderHoverRef.current.slot !== hoverSlot && pointerDrag.folderArmedSlot !== hoverSlot) {
        clearFolderHover();
        const sourcePreview = previewAppAtSource(cleanedSlots, pointerDrag.appId);
        setPointerDrag((p) => ({ ...p, previewSlots: sourcePreview, insertionSlot: null, insertionAfter: false }));
        folderHoverRef.current.slot = hoverSlot;
        folderHoverRef.current.timer = setTimeout(() => {
          setPointerDrag((p) => p ? { ...p, folderArmedSlot: hoverSlot } : p);
          folderHoverRef.current = { slot: hoverSlot, timer: null };
        }, 600);
      }
      const x = point.clientX || 0;
      const deskRect = point.currentTarget.getBoundingClientRect();
      const edge = 34;
      let dir = null;
      const maxPage = Math.max(0, homePages.length - 1);
      if (x <= deskRect.left + edge && homePage > 0) dir = -1;
      else if (x >= deskRect.right - edge && homePage < maxPage) dir = 1;
      if (dir !== edgeTurnDirRef.current) {
        clearTimeout(edgeTurnTimerRef.current);
        edgeTurnTimerRef.current = null;
        edgeTurnDirRef.current = dir;
        if (dir) {
          edgeTurnTimerRef.current = setTimeout(() => {
            setHomePage((p) => Math.max(0, Math.min(maxPage, p + dir)));
            edgeTurnTimerRef.current = null;
            edgeTurnDirRef.current = null;
          }, 450);
        }
      }
    });
  };

  const onPointerDragStartApp = (e, appId, fromArea) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_) {}
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    clearTimeout(edgeTurnTimerRef.current);
    edgeTurnTimerRef.current = null;
    edgeTurnDirRef.current = null;
    setIsDraggingApp(true);
    dragActiveRef.current = true;
    const startX = e.clientX || 0;
    const startY = e.clientY || 0;
    swipeStartXRef.current = startX;
    swipeStartYRef.current = startY;
    const press = { appId, fromArea, startX, startY, cancelled: false, timer: null };
    press.timer = setTimeout(() => {
      if (dragPressRef.current !== press || press.cancelled) return;
      dragPressRef.current = null;
      setPointerDrag({
        appId,
        fromArea,
        startX,
        startY,
        x: startX,
        y: startY,
        moved: false,
        folderArmedSlot: null,
        previewSlots: null,
        insertionSlot: null,
        insertionAfter: false,
      });
    }, e.pointerType === "touch" ? 420 : 320);
    dragPressRef.current = press;
  };
  const cancelPointerDrag = () => {
    // pendingPress 可能只是被 Chrome 的原生觸控流程取消；僅真正長按拖曳才抑制後續手勢。
    if (pointerDrag) {
      suppressHomeGestureUntilRef.current = Date.now() + 450;
    }
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    clearTimeout(dragPressRef.current?.timer);
    dragPressRef.current = null;
    if (pointerMoveRafRef.current) { cancelAnimationFrame(pointerMoveRafRef.current); pointerMoveRafRef.current = null; }
    pendingPointerMoveRef.current = null;
    setPointerDrag(null);
    setIsDraggingApp(false);
    dragActiveRef.current = false;
    clearFolderHover();
    clearTimeout(edgeTurnTimerRef.current);
    edgeTurnTimerRef.current = null;
    edgeTurnDirRef.current = null;
  };
  const onDropToHome = (e, slotIndex) => {
    e.preventDefault();
    try {
      const { appId } = JSON.parse(e.dataTransfer.getData("text/plain"));
      moveAppToHomeSlot(appId, slotIndex);
    } catch (_) {}
  };
  const onDropToHomeGrid = (e, pageIdx) => {
    e.preventDefault();
    const targetPage = pageIdx;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const relY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    const col = Math.max(0, Math.min(3, Math.floor((relX / rect.width) * 4)));
    const row = Math.max(0, Math.min(2, Math.floor((relY / rect.height) * 3)));
    const slot = targetPage * pageSize + row * 4 + col;
    onDropToHome(e, slot);
  };
  const onDropToDock = (e, index) => {
    e.preventDefault();
    try {
      const { appId } = JSON.parse(e.dataTransfer.getData("text/plain"));
      moveAppToDock(appId, index);
    } catch (_) {}
  };
  const onDropToDockContainer = (e) => {
    e.preventDefault();
    try {
      const { appId } = JSON.parse(e.dataTransfer.getData("text/plain"));
      const rect = e.currentTarget.getBoundingClientRect();
      const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const slotCount = Math.max(1, dockApps.length);
      const ratio = relX / rect.width;
      const targetIndex = Math.max(0, Math.min(dockApps.length, Math.round(ratio * slotCount)));
      moveAppToDock(appId, targetIndex);
    } catch (_) {}
  };
  const onHomeDragOverPageEdge = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const edge = 28;
    const maxPage = Math.max(0, homePages.length - 1);
    if (x <= rect.left + edge) setHomePage(p => Math.max(0, p - 1));
    else if (x >= rect.right - edge) setHomePage(p => Math.min(maxPage, p + 1));
  };

  return {
    onHomeTouchStart,
    onHomeTouchEnd,
    onHomeTouchCancel,
    onHomeMouseDown,
    onHomeMouseUp,
    onHomePointerDown,
    onHomePointerUp,
    onHomePointerMove,
    onPointerDragStartApp,
    cancelPointerDrag,
    onDropToHome,
    onDropToHomeGrid,
    onDropToDock,
    onDropToDockContainer,
    onHomeDragOverPageEdge,
  };
}
