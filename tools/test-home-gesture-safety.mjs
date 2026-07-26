import { readFile } from "node:fs/promises";
import { resolveHomeSwipe, resolveLibrarySwipe } from "../utils/homeGesture.js";

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

assertEqual(
  resolveHomeSwipe({ startX: 300, startY: 300, endX: 180, endY: 294 }),
  "next-page",
  "left swipe",
);
assertEqual(
  resolveHomeSwipe({ startX: 80, startY: 300, endX: 210, endY: 306 }),
  "previous-page",
  "right swipe",
);
assertEqual(
  resolveHomeSwipe({ startX: 180, startY: 430, endX: 176, endY: 320 }),
  "open-library",
  "up swipe",
);
assertEqual(
  resolveHomeSwipe({ startX: 180, startY: 300, endX: 174, endY: 294 }),
  null,
  "tap jitter",
);
assertEqual(
  resolveHomeSwipe({ startX: 180, startY: 300, endX: 215, endY: 380 }),
  null,
  "downward diagonal motion",
);
assertEqual(
  resolveLibrarySwipe({ startX: 180, startY: 620, endX: 176, endY: 500 }),
  "home",
  "library swipe up for home",
);
assertEqual(
  resolveLibrarySwipe({ startX: 300, startY: 400, endX: 210, endY: 402 }),
  "next-page",
  "library left swipe",
);

const hook = await readFile(new URL("../hooks/home/useHomeDragAndDrop.js", import.meta.url), "utf8");
const css = await readFile(new URL("../styles/maliPhoneCss.js", import.meta.url), "utf8");
const maliPhone = await readFile(new URL("../MaliPhone.jsx", import.meta.url), "utf8");
const appLibrary = await readFile(new URL("../components/home/HomeAppLibrary.jsx", import.meta.url), "utf8");
const switchBody = hook.slice(
  hook.indexOf("const switchHomePageBySwipe"),
  hook.indexOf("const onHomeTouchEnd"),
);
const pageTrackRule = css.match(/\.mp-pages-track\{([^}]*)\}/)?.[1] || "";
const desktopRule = css.match(/\.mp-desk\{([^}]*)\}/)?.[1] || "";
const libraryRule = css.match(/\.mp-app-library\{([^}]*)\}/)?.[1] || "";
const libraryPagerRule = css.match(/\.mp-library-pager\{([^}]*)\}/)?.[1] || "";

if (switchBody.includes("dragActiveRef.current || isDraggingApp")) {
  throw new Error("home swipe must not depend on stale React dragging state");
}
if (!pageTrackRule.includes("touch-action:none")) {
  throw new Error("home page gesture surface must retain pointer events under mobile emulation");
}
if (!desktopRule.includes("touch-action:none")) {
  throw new Error("the entire home surface must retain touch events under mobile emulation");
}
if (!hook.includes("touchSwipeRef") || !hook.includes("lastPointerGestureAtRef")) {
  throw new Error("home gestures must keep an independent Touch Event fallback without duplicate pointer actions");
}
if (!maliPhone.includes("onTouchStart: onHomeTouchStart")
  || !maliPhone.includes("onTouchEnd: onHomeTouchEnd")
  || !maliPhone.includes("onTouchCancel: onHomeTouchCancel")) {
  throw new Error("home screen must wire its Touch Event fallback");
}
if (!libraryRule.includes("touch-action:none") || !libraryPagerRule.includes("touch-action:none")) {
  throw new Error("app library must retain vertical touch gestures under mobile emulation");
}
if (!appLibrary.includes("onTouchStart={onHomeTouchStart}")
  || !appLibrary.includes("onTouchEnd={onHomeTouchEnd}")
  || !appLibrary.includes("resolveLibrarySwipe")) {
  throw new Error("app library must wire Touch Event fallback through the shared gesture classifier");
}

console.log("ok: home and app-library gestures survive mobile pointer cancellation");
