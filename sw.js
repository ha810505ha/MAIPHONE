const CACHE_NAME = "maliphone-shell-v1.1.2";
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

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
