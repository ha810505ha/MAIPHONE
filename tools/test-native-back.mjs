// MP-064：Android 系統返回鍵的處理順序與接線。
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EXIT_CONFIRM_MS, pickBackAction } from "../hooks/navigation/useNativeBackButton.js";

const overlay = { id: "overlay-top" };
const back = { id: "page-back" };
const now = 100_000;

assert.deepEqual(pickBackAction({ overlays: [{ id: "under" }, overlay], backButtons: [back], currentApp: "wallet", now }), { type: "dismiss-overlay", target: overlay }, "the top popup closes first");
assert.deepEqual(pickBackAction({ backButtons: [{ id: "hidden-parent" }, back], currentApp: "wallet", now }), { type: "press-back", target: back }, "then the page's own back button");
assert.equal(pickBackAction({ currentApp: "yunyin", now }).type, "close-app", "apps without a back button return to home");
assert.equal(pickBackAction({ folderOpen: true, libraryOpen: true, now }).type, "close-folder");
assert.equal(pickBackAction({ libraryOpen: true, now }).type, "close-library");
assert.equal(pickBackAction({ now }).type, "confirm-exit", "home asks for a second press");
assert.equal(pickBackAction({ lastBackAt: now - 500, now }).type, "exit", "a second press within the window exits");
assert.equal(pickBackAction({ lastBackAt: now - EXIT_CONFIRM_MS - 1, now }).type, "confirm-exit", "a late second press asks again");
assert.equal(pickBackAction({ locked: true, overlays: [overlay], backButtons: [back], currentApp: "chat", now }).type, "confirm-exit", "the lock screen never closes apps hidden behind it");
console.log("ok: back closes popups, then pages, then apps, and exits only on a second press from home");

const app = await readFile(new URL("../MaliPhone.jsx", import.meta.url), "utf8");
assert.match(app, /useNativeBackButton\(\{\s*\n\s*enabled: typeof window !== "undefined" && !!window\.Capacitor\?\.isNativePlatform\?\.\(\)/, "the listener is only registered in the native app");
assert.match(app, /onConfirmExit: \(\) => showToast\(tr\(/, "the exit hint is translated");
const hook = await readFile(new URL("../hooks/navigation/useNativeBackButton.js", import.meta.url), "utf8");
assert.match(hook, /App\.addListener\("backButton"/);
assert.match(hook, /handle\?\.remove\(\)/, "the listener is removed on unmount");
const backButton = await readFile(new URL("../components/common/BackButton.jsx", import.meta.url), "utf8");
assert.match(backButton, /<button type="button" className=\{`mp-back /, "shared back buttons keep the selector the back key relies on");
for (const file of ["components/wallet/AiCostBookView.jsx", "components/chat/MemoryToastCard.jsx", "components/gacha/SpecialMemoryCard.jsx"]) {
  assert.match(await readFile(new URL(`../${file}`, import.meta.url), "utf8"), /data-back-dismiss/, `${file} popup must close with the back key`);
}
console.log("ok: native-only listener, translated exit hint, and custom popups opt in to back dismissal");
