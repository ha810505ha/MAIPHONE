import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * 對話框焦點管理（UI 巡檢第二輪 #3）：
 * - 打開時把焦點移進對話框（第一個可操作元素，沒有就對話框本身）。
 * - Tab／Shift+Tab 只在對話框內循環，鍵盤不會操作到背景。
 * - Esc 呼叫 onClose（可傳 null 停用，例如送出中）。
 * - 關閉後把焦點還給原本打開它的元素。
 * 回傳的 ref 掛在對話框本體（role="dialog" 那一層）。
 */
export default function useDialogFocus(active, onClose) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active || typeof document === "undefined") return undefined;
    const dialog = ref.current;
    if (!dialog) return undefined;
    const previous = document.activeElement;
    const focusables = () => [...dialog.querySelectorAll(FOCUSABLE)].filter((element) => element.offsetParent !== null || element === document.activeElement);
    const first = focusables()[0];
    if (first) first.focus({ preventScroll: true });
    else {
      if (!dialog.hasAttribute("tabindex")) dialog.setAttribute("tabindex", "-1");
      dialog.focus({ preventScroll: true });
    }
    const onKeyDown = (event) => {
      if (event.key === "Escape" && onCloseRef.current) {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) {
        event.preventDefault();
        return;
      }
      const head = items[0];
      const tail = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === head || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        tail.focus();
      } else if (!event.shiftKey && document.activeElement === tail) {
        event.preventDefault();
        head.focus();
      }
    };
    dialog.addEventListener("keydown", onKeyDown);
    return () => {
      dialog.removeEventListener("keydown", onKeyDown);
      if (previous && typeof previous.focus === "function" && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [active]);

  return ref;
}
