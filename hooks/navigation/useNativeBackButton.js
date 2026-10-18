// Android 系統返回鍵（MP-064）：照「彈窗 → 頁面返回鍵 → 關 App → 主畫面再按一次離開」的順序處理。
// 只在 Capacitor 原生 App 註冊；網頁版不受影響。沒按的時候不做任何事。
import { useEffect, useRef } from "react";

export const EXIT_CONFIRM_MS = 2000;

const isVisible = (element) => {
  if (!element || typeof element.getBoundingClientRect !== "function") return false;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = typeof window !== "undefined" ? window.getComputedStyle(element) : null;
  return !style || (style.visibility !== "hidden" && style.display !== "none" && style.pointerEvents !== "none");
};

/**
 * 決定這次返回要做什麼。純函式，方便測試：
 * overlays／backButtons 是畫面上看得到的元素（依 DOM 順序，後面的在上層）。
 */
export function pickBackAction({ locked = false, overlays = [], backButtons = [], currentApp = null, folderOpen = false, libraryOpen = false, lastBackAt = 0, now = Date.now() }) {
  // 鎖定畫面蓋住一切，後面的 App 不該被關掉；直接走離開確認。
  if (!locked) {
    if (overlays.length) return { type: "dismiss-overlay", target: overlays[overlays.length - 1] };
    if (backButtons.length) return { type: "press-back", target: backButtons[backButtons.length - 1] };
    if (currentApp) return { type: "close-app" };
    if (folderOpen) return { type: "close-folder" };
    if (libraryOpen) return { type: "close-library" };
  }
  if (lastBackAt && now - lastBackAt <= EXIT_CONFIRM_MS) return { type: "exit" };
  return { type: "confirm-exit" };
}

// 共用彈窗遮罩（點遮罩就會關閉）；其他自製遮罩可加 data-back-dismiss 讓返回鍵也能關。
const OVERLAY_SELECTOR = ".mp-overlay, [data-back-dismiss]";
// 頁面左上角共用返回鍵（components/common/BackButton.jsx）。
const BACK_BUTTON_SELECTOR = "button.mp-back";

function collectVisible(root, selector) {
  return Array.from(root.querySelectorAll(selector)).filter(isVisible);
}

export function useNativeBackButton({ enabled, locked, currentApp, closeApp, folderOpen, closeFolder, libraryOpen, closeLibrary, onConfirmExit }) {
  const stateRef = useRef({});
  stateRef.current = { locked, currentApp, closeApp, folderOpen, closeFolder, libraryOpen, closeLibrary, onConfirmExit };
  const lastBackAtRef = useRef(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let removed = false;
    let handle = null;
    import("@capacitor/app").then(({ App }) => App.addListener("backButton", () => {
      const root = document.querySelector(".mp-phone") || document.body;
      const state = stateRef.current;
      const action = pickBackAction({
        locked: state.locked,
        overlays: collectVisible(root, OVERLAY_SELECTOR),
        backButtons: collectVisible(root, BACK_BUTTON_SELECTOR),
        currentApp: state.currentApp,
        folderOpen: state.folderOpen,
        libraryOpen: state.libraryOpen,
        lastBackAt: lastBackAtRef.current,
      });
      if (action.type !== "confirm-exit") lastBackAtRef.current = 0;
      switch (action.type) {
        case "dismiss-overlay":
          // 以遮罩本身為點擊目標，等同玩家點視窗外面。
          action.target.click();
          break;
        case "press-back":
          action.target.click();
          break;
        case "close-app":
          state.closeApp?.();
          break;
        case "close-folder":
          state.closeFolder?.();
          break;
        case "close-library":
          state.closeLibrary?.();
          break;
        case "exit":
          App.exitApp();
          break;
        default:
          lastBackAtRef.current = Date.now();
          state.onConfirmExit?.();
      }
    })).then((listener) => {
      handle = listener;
      if (removed) handle.remove();
    }).catch(() => {});
    return () => {
      removed = true;
      handle?.remove();
    };
  }, [enabled]);
}
