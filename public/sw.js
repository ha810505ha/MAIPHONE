const CACHE_NAME = "maliphone-shell-v1.2.13";
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
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
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
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || !response.ok) return response;
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
