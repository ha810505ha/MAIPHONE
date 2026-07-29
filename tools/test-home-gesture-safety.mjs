import { readFile } from "node:fs/promises";
import { resolveHomeSwipe, resolveLibrarySwipe, rubberBand } from "../utils/homeGesture.js";

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
assertEqual(
  resolveHomeSwipe({
    startX: 260,
    startY: 300,
    endX: 225,
    endY: 298,
    durationMs: 45,
    viewportWidth: 390,
  }),
  "next-page",
  "a short fast flick should advance",
);
assertEqual(
  resolveHomeSwipe({
    startX: 260,
    startY: 300,
    endX: 225,
    endY: 298,
    durationMs: 420,
    viewportWidth: 390,
  }),
  null,
  "a short slow drag should settle back",
);
if (!(rubberBand(120, 390) > 0 && rubberBand(120, 390) < 120)) {
  throw new Error("edge rubber banding must stay responsive while resisting overscroll");
}

const hook = await readFile(new URL("../hooks/home/useHomeDragAndDrop.js", import.meta.url), "utf8");
const css = await readFile(new URL("../styles/maliPhone.css", import.meta.url), "utf8");
const maliPhone = await readFile(new URL("../MaliPhone.jsx", import.meta.url), "utf8");
const appLibrary = await readFile(new URL("../components/home/HomeAppLibrary.jsx", import.meta.url), "utf8");
const homeScreen = await readFile(new URL("../components/shell/HomeScreen.jsx", import.meta.url), "utf8");
const switchBody = hook.slice(
  hook.indexOf("const switchHomePageBySwipe"),
  hook.indexOf("const onHomeTouchEnd"),
);
const pageTrackRule = css.match(/\.mp-pages-track\{([^}]*)\}/)?.[1] || "";
const desktopRule = css.match(/\.mp-desk\{([^}]*)\}/)?.[1] || "";
const libraryRule = css.match(/\.mp-app-library\{([^}]*)\}/)?.[1] || "";
const libraryPagerRule = css.match(/\.mp-library-pager\{([^}]*)\}/)?.[1] || "";
const allAppsHandleRule = css.match(/\.mp-all-apps-handle\{([^}]*)\}/)?.[1] || "";

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
if (!homeScreen.includes("if (folder) onOpenApp(folder);")
  || homeScreen.includes("folder && !dragging")
  || !homeScreen.includes("data-folder-id={folder?.id || undefined}")) {
  throw new Error("folder clicks must not depend on stale app-dragging state");
}
if (!homeScreen.includes("if (folder) {\n                        event.stopPropagation();")) {
  throw new Error("folder pointer events must not start the home-page gesture");
}
if (!homeScreen.includes("onPointerDown={stopHomeGesture}")
  || !homeScreen.includes("onPointerUp={stopHomeGesture}")
  || !homeScreen.includes("event.stopPropagation();\n              onOpenAllApps();")) {
  throw new Error("the all-apps button must not be retargeted into the desktop home gesture");
}
if (!allAppsHandleRule.includes("min-width:96px") || !allAppsHandleRule.includes("min-height:44px")) {
  throw new Error("the all-apps button must keep a desktop-safe pointer target");
}

console.log("ok: home and app-library gestures survive mobile pointer cancellation");
