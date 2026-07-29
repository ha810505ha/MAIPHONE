import { useEffect, useRef } from "react";

const DEFAULT_CLICK_SUPPRESSION_MS = 220;
const DEFAULT_UNLOCK_DELAY_MS = 450;
const DEFAULT_UNLOCK_SWIPE_DISTANCE = 70;

export default function usePhoneNavigation({
  canOpenApp = () => true,
  onOpenApp,
  onCloseApp,
  onUnlockStart,
  onUnlockComplete,
  preloadApp,
  unlockDelayMs = DEFAULT_UNLOCK_DELAY_MS,
  unlockSwipeDistance = DEFAULT_UNLOCK_SWIPE_DISTANCE,
}) {
  const lockStartYRef = useRef(null);
  const suppressAppClickUntilRef = useRef(0);
  const unlockTimerRef = useRef(null);

  useEffect(() => () => {
    clearTimeout(unlockTimerRef.current);
  }, []);

  const armAppClickSuppression = (ms = 600) => {
    suppressAppClickUntilRef.current = Date.now() + ms;
  };

  const handleUnlock = () => {
    onUnlockStart?.();
    clearTimeout(unlockTimerRef.current);
    unlockTimerRef.current = setTimeout(() => {
      onUnlockComplete?.();
      unlockTimerRef.current = null;
    }, unlockDelayMs);
  };

  const startLockGesture = (clientY) => {
    lockStartYRef.current = clientY ?? null;
  };

  const finishLockGesture = (clientY) => {
    const startY = lockStartYRef.current;
    lockStartYRef.current = null;
    if (startY === null || clientY === null || clientY === undefined) return;
    if (startY - clientY > unlockSwipeDistance) handleUnlock();
  };

  const openApp = (appId) => {
    if (!canOpenApp(appId)) return false;
    void preloadApp?.(appId);
    armAppClickSuppression(DEFAULT_CLICK_SUPPRESSION_MS);
    onOpenApp?.(appId);
    return true;
  };

  const openAppFromTouch = (appId, event) => {
    if (!event) return false;
    event.preventDefault();
    event.stopPropagation();
    armAppClickSuppression(DEFAULT_CLICK_SUPPRESSION_MS);
    return openApp(appId);
  };

  const blockRecentAppClicks = (event) => {
    if (Date.now() > suppressAppClickUntilRef.current) return false;
    event.stopPropagation();
    event.preventDefault();
    return true;
  };

  const closeApp = () => {
    armAppClickSuppression(DEFAULT_CLICK_SUPPRESSION_MS);
    onCloseApp?.();
  };

  return {
    armAppClickSuppression,
    blockRecentAppClicks,
    closeApp,
    handleUnlock,
    lockGestureHandlers: {
      onTouchStart: (event) => startLockGesture(event.touches?.[0]?.clientY),
      onTouchEnd: (event) => finishLockGesture(event.changedTouches?.[0]?.clientY),
      onMouseDown: (event) => startLockGesture(event.clientY),
      onMouseUp: (event) => finishLockGesture(event.clientY),
      onPointerDown: (event) => startLockGesture(event.clientY),
      onPointerUp: (event) => finishLockGesture(event.clientY),
    },
    openApp,
    openAppFromTouch,
    suppressAppClickUntilRef,
  };
}
