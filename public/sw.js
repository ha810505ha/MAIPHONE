const CACHE_PREFIX = "maliphone-shell-";
// 改版號會讓 activate 清掉舊快取；1.4.6 起舊版可能存過雲端存檔，必須清掉。
// -2：清掉圖片網址被存成 HTML 的快取（Pages 對不存在的檔案回 200 首頁）。
const CACHE_NAME = `${CACHE_PREFIX}v1.4.6-2`;
const BASE_PATH = new URL(self.registration.scope).pathname;
const APP_SHELL = [BASE_PATH, `${BASE_PATH}manifest.webmanifest`, `${BASE_PATH}pwa/icon-192.png`, `${BASE_PATH}pwa/icon-512.png`];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  // 帶登入身分、雲端資料 API、其他網域的請求一律交給瀏覽器直接連網：
  // 快取只看網址不看帳號，存下來會讓下載拿到舊存檔或別的帳號的資料。
  const url = new URL(request.url);
  if (request.headers.has("Authorization")) return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/v1/")) return;
  // 版本檔要每次連網比對，不能進快取。
  if (url.pathname.endsWith("/version.json")) return;
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(fetch(request).catch(() => caches.match(BASE_PATH)));
    return;
  }
  if (request.url.includes("/api/") || request.url.includes("openai.com") || request.url.includes("anthropic.com") || request.url.includes("googleapis.com") || request.url.includes("openrouter.ai")) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }
  if (["script", "style", "worker"].includes(request.destination)) {
    event.respondWith(
      fetch(request).then((response) => {
        if (!response || !response.ok) return response;
        const resClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone)).catch(() => {});
        return response;
      }).catch(() => caches.match(request))
    );
    return;
  }
  // 圖片等靜態檔：Pages 對不存在的檔案回 200 的首頁 HTML，存起來就會永遠顯示破圖；
  // 這類回應不快取，已存的也不拿來用。
  const isHtml = (response) => (response?.headers?.get("content-type") || "").includes("text/html");
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached && !isHtml(cached)) return cached;
      return fetch(request).then((response) => {
        if (!response || !response.ok || isHtml(response)) return response;
        const resClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone)).catch(() => {});
        return response;
      }).catch(() => caches.match(BASE_PATH));
    })
  );
});

let pendingNotificationClick = null;

// 系統通知點擊：把既有分頁叫回前景並轉發目的地，沒有分頁就開一個。
// 實際的跳轉邏輯留在頁面裡（openNotification），這裡只做傳話。
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const notification = event.notification.data || null;
  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = clientList.find((client) => client.url.startsWith(self.registration.scope));
    if (existing) {
      await existing.focus();
      existing.postMessage({ type: "NOTIFICATION_CLICK", notification });
      return;
    }
    const opened = await self.clients.openWindow(BASE_PATH);
    // 新開的分頁還沒掛上 listener，等它 ready 後由頁面自己來拿。
    if (opened) pendingNotificationClick = notification;
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLAIM_PENDING_NOTIFICATION') {
    event.source?.postMessage({ type: "NOTIFICATION_CLICK", notification: pendingNotificationClick });
    pendingNotificationClick = null;
    return;
  }
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
