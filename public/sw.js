const CACHE = "sj-shell-v3-mascot";
const STATIC = ["/offline.html", "/icon-sj-192.png", "/icon-sj-512.png", "/mascot/sj-history.webp"];
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    await (await caches.open(CACHE)).addAll(STATIC);
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys()).filter(key => key.startsWith("sj-shell-") && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET" || url.pathname.startsWith("/api/") || url.pathname.includes("callback")) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html")));
  } else if (url.pathname.startsWith("/_next/static/") || STATIC.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    }));
  }
});
