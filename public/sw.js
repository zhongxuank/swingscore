// Swingscore service worker: makes the app installable and lets pages already opened reload without a connection.
// Scores never go through here. They queue in the page and send straight to the database.
const CACHE = "swingscore-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/", "/manifest.json", "/icon.svg"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Only this site's own pages and files. Database calls and sign-in go straight to the network.
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/auth/")) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && (request.mode === "navigate" || url.pathname.startsWith("/_next/static/"))) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || Response.error()))
  );
});
