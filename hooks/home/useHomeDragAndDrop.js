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
}) {
  const findSlotIndex = (slots, appId) => slots.findIndex((id) => id === appId);
  const moveAppToHomeSlot = (appId, targetSlotIndex) => {
    if (!allAppIds.includes(appId)) return;
    if (safeDock.includes(appId) && safeDock.length <= 2) return;
    const nextDock = safeDock.filter((id) => id !== appId);
    const nextSlots = [...cleanedSlots];
    const fromSlot = findSlotIndex(nextSlots, appId);
    if (fromSlot >= 0) nextSlots[fromSlot] = null;
    const occupant = nextSlots[targetSlotIndex];
    nextSlots[targetSlotIndex] = appId;
    if (occupant && occupant !== appId) {
      if (fromSlot >= 0) nextSlots[fromSlot] = occupant;
      else {
        const emptyIdx = nextSlots.findIndex((id) => id === null);
        if (emptyIdx >= 0) nextSlots[emptyIdx] = occupant;
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
    const nextSlots = cleanedSlots.map((id) => (id === appId ? null : id));
    setDockOrder(nextDock);
    setHomeSlots(nextSlots);
  };
  const onHomeTouchStart = (e) => {
    if (isDraggingApp || pointerDrag) return;
    swipeStartXRef.current = e.touches?.[0]?.clientX ?? null;
    swipeStartYRef.current = e.touches?.[0]?.clientY ?? null;
  };
  const switchHomePageBySwipe = (sx, sy, ex, ey) => {
    if (isDraggingApp) return;
    if (sx === null || ex === null || sy === null || ey === null) return;
    const diffX = sx - ex;
    const diffY = sy - ey;
    const absX = Math.abs(diffX);
    const absY = Math.abs(diffY);
    // 更接近手機手感：降低觸發門檻，並允許些微斜向滑動
    if (absX < 18) return;
    if (absY > absX * 1.35) return;
    if (diffX > 0) setHomePage(p => Math.min(p + 1, homePages.length - 1));
    else setHomePage(p => Math.max(p - 1, 0));
  };
  const onHomeTouchEnd = (e) => {
    if (isDraggingApp || pointerDrag) {
      swipeStartXRef.current = null;
      swipeStartYRef.current = null;
      return;
    }
    const sx = swipeStartXRef.current;
    const sy = swipeStartYRef.current;
    const ex = e.changedTouches?.[0]?.clientX ?? null;
    const ey = e.changedTouches?.[0]?.clientY ?? null;
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    switchHomePageBySwipe(sx, sy, ex, ey);
  };
  const onHomeMouseDown = (e) => {
    if (isDraggingApp || pointerDrag) return;
    swipeStartXRef.current = e.clientX ?? null;
    swipeStartYRef.current = e.clientY ?? null;
  };
  const onHomeMouseUp = (e) => {
    if (isDraggingApp || pointerDrag) {
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
    if (pointerDrag) return;
    swipeStartXRef.current = e.clientX ?? null;
    swipeStartYRef.current = e.clientY ?? null;
  };
  const onHomePointerUp = (e) => {
    if (pointerDrag) {
      const dragging = pointerDrag;
      setPointerDrag(null);
      setIsDraggingApp(false);
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
        if (!Number.isNaN(slot)) moveAppToHomeSlot(dragging.appId, slot);
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
    switchHomePageBySwipe(sx, sy, ex, ey);
  };
  const onHomePointerMove = (e) => {
    if (!pointerDrag) return;
    const dx = Math.abs((e.clientX || 0) - pointerDrag.startX);
    const dy = Math.abs((e.clientY || 0) - pointerDrag.startY);
    const moved = dx + dy > 8;
    setPointerDrag((p) => ({ ...p, x: e.clientX || 0, y: e.clientY || 0, moved }));
    const vw = window.innerWidth || 0;
    const x = e.clientX || 0;
    const edge = 28;
    let dir = null;
    const maxPage = Math.max(0, homePages.length - 1);
    if (x <= edge && homePage > 0) dir = -1;
    else if (x >= vw - edge && homePage < maxPage) dir = 1;
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
  };

  const onPointerDragStartApp = (e, appId, fromArea) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    clearTimeout(edgeTurnTimerRef.current);
    edgeTurnTimerRef.current = null;
    edgeTurnDirRef.current = null;
    setIsDraggingApp(true);
    setPointerDrag({
      appId,
      fromArea,
      startX: e.clientX || 0,
      startY: e.clientY || 0,
      x: e.clientX || 0,
      y: e.clientY || 0,
      moved: false,
    });
  };
  const cancelPointerDrag = () => {
    setPointerDrag(null);
    setIsDraggingApp(false);
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
    // 目前以主畫面(中間頁)為主：拖放一律落在中間頁 4x3
    const targetPage = 1;
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
