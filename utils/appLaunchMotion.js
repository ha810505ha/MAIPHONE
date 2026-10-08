// 首頁 ⇄ App 的「從圖示展開／縮回圖示」轉場。
// 只操作 DOM 與 CSS 變數，不碰 React 狀態；找不到圖示或使用者要求減少動態時直接略過，
// 讓頁面維持原本的進場動畫。
const OPEN_MS = 420;
const CLOSE_MS = 360;
const MIN_SCALE = 0.32;
const MAX_SCALE = 0.62;
const ICON_RADIUS = 18;

let finishTimer = null;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;

const findPhone = () => (typeof document === "undefined" ? null : document.querySelector('[data-runtime-phone="true"]'));

function findIconRect(phone, appId) {
  if (!appId) return null;
  const phoneRect = phone.getBoundingClientRect();
  const selector = `.mp-desk [data-app-id="${typeof CSS !== "undefined" && CSS.escape ? CSS.escape(appId) : appId}"]`;
  for (const node of phone.querySelectorAll(selector)) {
    const rect = (node.querySelector(".mp-icon-c") || node).getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) continue;
    // 其他首頁分頁的圖示在畫面外，不能當作起點。
    if (rect.right <= phoneRect.left || rect.left >= phoneRect.right || rect.bottom <= phoneRect.top || rect.top >= phoneRect.bottom) continue;
    return {
      x: rect.left - phoneRect.left,
      y: rect.top - phoneRect.top,
      width: rect.width,
      height: rect.height,
    };
  }
  return null;
}

// 以圖示中心為原點縮放整頁，再用 clip-path 把可見範圍裁成圖示大小；
// 縮放倍率會依圖示離邊緣的距離調高，確保裁切框不超出頁面。
function applyGeometry(phone, icon) {
  const width = phone.clientWidth;
  const height = phone.clientHeight;
  const cx = icon.x + icon.width / 2;
  const cy = icon.y + icon.height / 2;
  const roomX = Math.max(1, Math.min(cx, width - cx));
  const roomY = Math.max(1, Math.min(cy, height - cy));
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, icon.width / 2 / roomX, icon.height / 2 / roomY));
  const halfW = icon.width / 2 / scale;
  const halfH = icon.height / 2 / scale;
  const inset = [cy - halfH, width - (cx + halfW), height - (cy + halfH), cx - halfW].map((value) => `${Math.max(0, value).toFixed(1)}px`).join(" ");
  phone.style.setProperty("--mp-launch-origin", `${cx.toFixed(1)}px ${cy.toFixed(1)}px`);
  phone.style.setProperty("--mp-launch-scale", scale.toFixed(3));
  phone.style.setProperty("--mp-launch-clip", `inset(${inset} round ${(ICON_RADIUS / scale).toFixed(1)}px)`);
  // 展開終點的圓角跟手機外框一致，避免最後一格角落突然變方。
  const endRadius = Number.parseFloat(getComputedStyle(phone).borderTopLeftRadius) || 0;
  phone.style.setProperty("--mp-launch-end-clip", `inset(0px 0px 0px 0px round ${endRadius}px)`);
}

function finishLater(phone, ms, cleanup) {
  clearTimeout(finishTimer);
  finishTimer = setTimeout(() => {
    finishTimer = null;
    delete phone.dataset.appMotion;
    cleanup?.();
  }, ms);
}

function clearGhost(phone) {
  const ghost = phone.querySelector(".mp-app-ghost");
  if (ghost) ghost.replaceChildren();
}

export function resetAppLaunch() {
  const stage = findPhone()?.querySelector(".mp-app-stage");
  if (stage) delete stage.dataset.launched;
}

export function playAppOpen(appId) {
  const phone = findPhone();
  if (!phone) return false;
  clearGhost(phone);
  delete phone.dataset.appMotion;
  if (prefersReducedMotion()) return false;
  const icon = findIconRect(phone, appId);
  if (!icon) return false;
  applyGeometry(phone, icon);
  // 標記這頁已由圖示展開進場；動畫結束後也不能讓 .mp-page 原本的 mpAppOpen 再播一次（會閃一下）。
  const stage = phone.querySelector(".mp-app-stage");
  if (stage) stage.dataset.launched = "true";
  phone.dataset.appMotion = "opening";
  finishLater(phone, OPEN_MS + 40);
  return true;
}

// 關閉時 React 會立刻卸載 App 頁面，所以要在狀態更新前複製一份靜態畫面做退場。
function cloneStage(stage) {
  const fragment = document.createDocumentFragment();
  for (const child of stage.children) {
    const copy = child.cloneNode(true);
    const sources = [child, ...child.querySelectorAll("*")];
    const copies = [copy, ...copy.querySelectorAll("*")];
    sources.forEach((source, index) => {
      const target = copies[index];
      if (!target) return;
      if (source.scrollTop || source.scrollLeft) target.dataset.mpGhostScroll = `${source.scrollLeft},${source.scrollTop}`;
      if (source instanceof HTMLCanvasElement && target instanceof HTMLCanvasElement) {
        try { target.getContext("2d")?.drawImage(source, 0, 0); } catch { /* 無法複製的畫布保持空白即可 */ }
      }
    });
    copy.querySelectorAll("audio,video").forEach((media) => {
      media.removeAttribute("autoplay");
      media.muted = true;
      media.pause?.();
    });
    copy.querySelectorAll("iframe").forEach((frame) => frame.remove());
    copy.removeAttribute("id");
    fragment.appendChild(copy);
  }
  return fragment;
}

export function playAppClose() {
  const phone = findPhone();
  if (!phone) return false;
  const stage = phone.querySelector(".mp-app-stage");
  const ghost = phone.querySelector(".mp-app-ghost");
  if (!stage || !ghost || !stage.children.length || prefersReducedMotion()) return false;
  const icon = findIconRect(phone, stage.dataset.appId);
  if (!icon) return false;
  applyGeometry(phone, icon);
  ghost.replaceChildren(cloneStage(stage));
  ghost.querySelectorAll("[data-mp-ghost-scroll]").forEach((node) => {
    const [left, top] = node.dataset.mpGhostScroll.split(",").map(Number);
    node.scrollLeft = left;
    node.scrollTop = top;
  });
  phone.dataset.appMotion = "closing";
  finishLater(phone, CLOSE_MS + 40, () => clearGhost(phone));
  return true;
}

const HOME_ENTER_MS = 520;
let homeEnterTimer = null;

export function playHomeEnter() {
  const phone = findPhone();
  if (!phone || prefersReducedMotion()) return false;
  phone.dataset.homeEnter = "true";
  clearTimeout(homeEnterTimer);
  homeEnterTimer = setTimeout(() => {
    homeEnterTimer = null;
    delete phone.dataset.homeEnter;
  }, HOME_ENTER_MS + 40);
  return true;
}
