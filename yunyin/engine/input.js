// 輸入判定：pointer 位移 > 8px 視為拖曳（平移鏡頭），否則放開時視為 tap（尋路）。
const DRAG_THRESHOLD = 8;

export function createInput(el, handlers) {
  let active = false, dragging = false;
  let startX = 0, startY = 0, lastX = 0, lastY = 0;

  const down = (e) => {
    active = true; dragging = false;
    startX = lastX = e.clientX; startY = lastY = e.clientY;
    el.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (!active) return;
    if (!dragging && Math.hypot(e.clientX - startX, e.clientY - startY) > DRAG_THRESHOLD) dragging = true;
    if (dragging) {
      handlers.onDrag?.(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX; lastY = e.clientY;
    }
  };
  const up = (e) => {
    if (!active) return;
    active = false;
    if (!dragging) {
      const rect = el.getBoundingClientRect();
      handlers.onTap?.(e.clientX - rect.left, e.clientY - rect.top);
    }
    dragging = false;
  };

  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  return () => {
    el.removeEventListener("pointerdown", down);
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("pointercancel", up);
  };
}
