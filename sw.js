// Keeps the app working with no internet, so a lesson never depends on wifi.
const CACHE = "word-by-word-20261114-113801";
const FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./app.js",
  "./state.js",
  "./ui.js",
  "./word.js",
  "./lesson.js",
  "./engine.js",
  "./platform.js",
  "./content.js",
  "./stories.js",
  "./assets/icon-180.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((hit) => {
      if (hit) return hit;
      return fetch(event.request).then((response) => {
        // Keep the fonts too, so the second opening works offline as well.
        if (response.ok && (response.type === "basic" || response.type === "cors")) {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
        }
        return response;
      });
    }).catch(() => caches.match("./index.html"))
  );
});
