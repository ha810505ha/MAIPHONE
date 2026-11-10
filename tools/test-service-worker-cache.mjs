// MP-048：Service Worker 不得快取雲端存檔、帶登入身分或其他網域的請求，
// 靜態資源仍要能離線開啟；Android App 不註冊 SW 並清掉舊快取。
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const ORIGIN = "https://app.example";
const SCOPE = `${ORIGIN}/MAIPHONE/`;
const swSource = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

function createWorker() {
  const stores = new Map();
  const listeners = {};
  let networkCalls = 0;
  let networkHandler = () => new Response("network");

  const openStore = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return {
      async put(request, response) { store.set(request.url, response); },
      async addAll(urls) { for (const url of urls) store.set(new URL(url, ORIGIN).href, new Response(`shell:${url}`)); },
      async match(request) { return store.get(typeof request === "string" ? new URL(request, ORIGIN).href : request.url); },
    };
  };
  const caches = {
    async open(name) { return openStore(name); },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
    async match(request) {
      for (const name of stores.keys()) {
        const hit = await openStore(name).match(request);
        if (hit) return hit;
      }
      return undefined;
    },
  };
  const self = {
    location: new URL(SCOPE),
    registration: { scope: SCOPE },
    clients: { async claim() {}, async matchAll() { return []; } },
    skipWaiting() {},
    addEventListener(type, handler) { listeners[type] = handler; },
  };
  const context = vm.createContext({
    self,
    caches,
    URL,
    Response,
    Promise,
    fetch: async (request) => {
      networkCalls += 1;
      return networkHandler(request);
    },
  });
  vm.runInContext(swSource, context);

  const runLifecycle = async (type) => {
    let pending = Promise.resolve();
    listeners[type]({ waitUntil(promise) { pending = promise; } });
    await pending;
  };
  // 回傳 null 代表 SW 沒有攔截，瀏覽器會直接連網。
  const dispatchFetch = async ({ url, headers = {}, method = "GET", destination = "", mode = "cors" }) => {
    const request = {
      url: new URL(url, ORIGIN).href,
      method,
      destination,
      mode,
      headers: new Headers(headers),
    };
    let responded = null;
    listeners["fetch"]({ request, respondWith(promise) { responded = promise; } });
    if (!responded) return null;
    // 讓 cache.put 的非同步寫入跑完。
    const response = await responded;
    await new Promise((resolve) => setTimeout(resolve, 0));
    return response;
  };
  return {
    stores,
    runLifecycle,
    dispatchFetch,
    setNetwork(handler) { networkHandler = handler; },
    get networkCalls() { return networkCalls; },
  };
}

const sw = createWorker();
sw.stores.set("maliphone-shell-v1.2.13", new Map([[`${ORIGIN}/v1/documents/app-text-sync-v1`, new Response("stale")]]));
sw.stores.set("other-app-cache", new Map());
await sw.runLifecycle("install");
await sw.runLifecycle("activate");
const cacheNames = [...sw.stores.keys()];
assert.ok(!cacheNames.includes("maliphone-shell-v1.2.13"), "activate must delete old MaliPhone shell caches");
assert.ok(cacheNames.includes("other-app-cache"), "activate must not delete caches without the MaliPhone prefix");
assert.equal(cacheNames.filter((name) => name.startsWith("maliphone-shell-")).length, 1);
console.log("ok: activate clears only old maliphone-shell- caches");

// 雲端存檔：跨網域 worker、同源 /v1/、帶 Authorization 都不攔截。
assert.equal(await sw.dispatchFetch({
  url: "https://worker.example/v1/documents/app-text-sync-v1",
  headers: { Authorization: "Bearer token-a" },
}), null);
assert.equal(await sw.dispatchFetch({ url: `${ORIGIN}/v1/documents/app-text-sync-v1` }), null);
assert.equal(await sw.dispatchFetch({ url: `${ORIGIN}/MAIPHONE/data.json`, headers: { Authorization: "Bearer token-b" } }), null);
assert.equal(await sw.dispatchFetch({ url: "https://cdn.example/avatar.png", destination: "image" }), null);
assert.equal(await sw.dispatchFetch({ url: `${ORIGIN}/v1/documents/x`, method: "PUT" }), null);
console.log("ok: cloud documents, authorized and cross-origin requests bypass the service worker");

// 靜態資源仍走快取：第一次連網後存起來，斷網時拿得到。
sw.setNetwork(() => new Response("icon-bytes"));
const firstIcon = await sw.dispatchFetch({ url: `${ORIGIN}/MAIPHONE/assets/icon.png`, destination: "image" });
assert.equal(await firstIcon.text(), "icon-bytes");
const callsAfterFirst = sw.networkCalls;
sw.setNetwork(() => { throw new TypeError("offline"); });
const offlineIcon = await sw.dispatchFetch({ url: `${ORIGIN}/MAIPHONE/assets/icon.png`, destination: "image" });
assert.equal(await offlineIcon.text(), "icon-bytes");
assert.equal(sw.networkCalls, callsAfterFirst, "cached static asset should be served without network");
const offlinePage = await sw.dispatchFetch({ url: SCOPE, mode: "navigate", destination: "document" });
assert.ok(offlinePage, "navigation must fall back to the cached app shell when offline");
console.log("ok: same-origin static assets and the app shell still work offline");

// Pages 對不存在的檔案回 200 首頁 HTML：不得存成圖片快取，舊快取裡的 HTML 也不拿來用。
const htmlFallback = () => new Response("<!doctype html>", { headers: { "content-type": "text/html; charset=utf-8" } });
sw.setNetwork(htmlFallback);
await sw.dispatchFetch({ url: `${ORIGIN}/MAIPHONE/dating-photos/new.jpg`, destination: "image" });
sw.setNetwork(() => new Response("photo-bytes", { headers: { "content-type": "image/jpeg" } }));
const realPhoto = await sw.dispatchFetch({ url: `${ORIGIN}/MAIPHONE/dating-photos/new.jpg`, destination: "image" });
assert.equal(await realPhoto.text(), "photo-bytes", "HTML fallback must not be cached for image requests");
const shellName = [...sw.stores.keys()].find((name) => name.startsWith("maliphone-shell-"));
sw.stores.get(shellName).set(`${ORIGIN}/MAIPHONE/dating-photos/old.jpg`, htmlFallback());
const healedPhoto = await sw.dispatchFetch({ url: `${ORIGIN}/MAIPHONE/dating-photos/old.jpg`, destination: "image" });
assert.equal(await healedPhoto.text(), "photo-bytes", "cached HTML must be ignored and refetched");
console.log("ok: HTML fallbacks are never cached or served for static files");

// Android App：不註冊 SW，註銷舊的並清掉 MaliPhone 快取。
const appSource = await readFile(new URL("../MaliPhone.jsx", import.meta.url), "utf8");
const registerAt = appSource.indexOf("navigator.serviceWorker.register(");
const nativeAt = appSource.indexOf("window.Capacitor?.isNativePlatform?.()", registerAt - 1500);
assert.ok(registerAt > 0 && nativeAt > 0 && nativeAt < registerAt, "native check must run before SW registration");
const nativeBlock = appSource.slice(nativeAt, registerAt);
assert.match(nativeBlock, /getRegistrations\(\)/);
assert.match(nativeBlock, /\.unregister\(\)/);
assert.match(nativeBlock, /startsWith\("maliphone-shell-"\)/);
assert.match(nativeBlock, /return;\s*\n\s*\}/);
console.log("ok: Capacitor native skips SW registration and clears old registrations and caches");
