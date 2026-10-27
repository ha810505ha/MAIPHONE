// 圖片下載（紀念卡、聊天截圖）的平台行為：
// - 一般 Android 瀏覽器按「下載」要直接下載（走 anchor），不能跳出分享面板；
// - Android 內嵌 WebView（LINE／FB 內建瀏覽器、原生 App 寫檔失敗時）才用分享面板；
// - 原生 App 先寫 Pictures/MaliPhone/（相簿看得到）再退回 Documents/；
// - 紀念卡畫卡圖時，crossOrigin 載入被快取擋掉要用 cache:"reload" 的請求重抓。
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const events = [];
globalThis.window = { Capacitor: { isNativePlatform: () => false } };
globalThis.document = {
  body: { appendChild() {} },
  createElement: () => ({ set download(value) { events.push(`anchor:${value}`); }, click() { events.push("anchor-click"); }, remove() {} }),
};
Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true, writable: true });
URL.createObjectURL = () => "blob:test";
URL.revokeObjectURL = () => {};

const { downloadImageFile } = await import("../utils/exportFile.js");
const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });

async function attempt(userAgent, options) {
  events.length = 0;
  globalThis.navigator = { userAgent, share: async () => { events.push("share"); }, canShare: () => true };
  const result = await downloadImageFile(png, "special-memory-card.png", options);
  return { result, events: [...events] };
}

const chromeAndroid = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const webViewAndroid = "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 Line/14.0.0";
const safariIos = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const desktopChrome = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

let outcome = await attempt(chromeAndroid);
assert.equal(outcome.result.method, "download", "Android Chrome must download instead of opening the share sheet");
assert.deepEqual(outcome.events, ["anchor:special-memory-card.png", "anchor-click"]);

outcome = await attempt(webViewAndroid);
assert.equal(outcome.result.method, "share", "Android in-app WebViews keep the share sheet because the download attribute is unreliable there");
assert.deepEqual(outcome.events, ["share"]);

outcome = await attempt(webViewAndroid, { preferBrowserDownload: true });
assert.equal(outcome.result.method, "download", "preferBrowserDownload still forces the anchor download");

for (const userAgent of [safariIos, desktopChrome]) {
  outcome = await attempt(userAgent);
  assert.equal(outcome.result.method, "download", `${userAgent.slice(0, 24)}… downloads directly`);
  assert.ok(!outcome.events.includes("share"));
}

// 使用者關掉分享面板不算失敗
events.length = 0;
globalThis.navigator = { userAgent: webViewAndroid, share: async () => { throw Object.assign(new Error("cancelled"), { name: "AbortError" }); }, canShare: () => true };
assert.equal((await downloadImageFile(png, "card.png")).method, "cancelled");

// 原生 App 的寫檔順序與紀念卡的卡圖重抓，以原始碼確認（Capacitor 外掛無法在 Node 載入）
const exportSource = await readFile(new URL("../utils/exportFile.js", import.meta.url), "utf8");
const nativeBlock = exportSource.slice(exportSource.indexOf("export async function downloadImageFile"), exportSource.indexOf("export function exportToastMessage"));
assert.ok(nativeBlock.indexOf("Directory.ExternalStorage") < nativeBlock.indexOf("Directory.Documents"), "native app tries the Pictures album before Documents");
assert.ok(exportSource.includes("const IMAGE_ALBUM_FOLDER = \"Pictures/MaliPhone\""), "album folder is Pictures/MaliPhone");
assert.match(nativeBlock, /album: target\.album/, "callers can tell whether the file landed in the album");

const cardSource = await readFile(new URL("../components/gacha/SpecialMemoryCard.jsx", import.meta.url), "utf8");
assert.match(cardSource, /fetchWithTimeout\(src, \{ mode: "cors", cache: "reload"/, "card art is refetched past the browser cache when the CORS load is blocked");
assert.match(cardSource, /result\.location/, "memory card notice shows the real save location");
assert.ok(!cardSource.includes("Documents/${result.path}"), "memory card notice no longer hardcodes Documents/");

console.log("ok: Android browsers download directly, in-app WebViews share, native app saves to the album first, card art survives a CORS-less cache");
