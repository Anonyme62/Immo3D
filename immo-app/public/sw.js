const CACHE_NAME = "immo3d-shell-v1";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/apple-touch-icon.png",
  "/pwa-192.png",
  "/pwa-512.png",
  "/favicon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isApiRequest =
    url.pathname.startsWith("/auth") ||
    url.pathname.startsWith("/biens") ||
    url.pathname.startsWith("/notes") ||
    url.pathname.startsWith("/blacklist") ||
    url.pathname.startsWith("/markers");

  if (!isSameOrigin || isApiRequest) {
    return;
  }

  const isNavigation = request.mode === "navigate";
  if (isNavigation) {
    event.respondWith(
      fetch(request).catch(() => caches.match("/")),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        const clonedResponse = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clonedResponse)).catch(() => {});
        return networkResponse;
      });
    }),
  );
});
