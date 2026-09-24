// Service worker do PWA: guarda o app pra abrir offline. Nunca mexe na TMDB nem no Firebase.

// O build (scripts/minify.js) troca __BUILD_ID__ por um id novo a cada deploy.
const CACHE_NAME = "barbie-movies-tracker-__BUILD_ID__";

const APP_SHELL_FILES = [
  "index.html",
  "css/styles.css",
  "manifest.json",
  "js/main.js",
  "js/progress.js",
  "js/filters.js",
  "js/ratings.js",
  "js/reviews.js",
  "js/stats.js",
  "js/backup.js",
  "js/debounce.js",
  "js/tmdb.js",
  "js/storage-local.js",
  "js/firebase-app.js",
  "js/config.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Um por um: arquivo faltando (ex.: js/config.js) nao derruba a instalacao.
      await Promise.all(APP_SHELL_FILES.map((url) => cache.add(url).catch(() => {})));
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

// Rede primeiro (deploy novo aparece na hora); o cache so entra quando estiver offline.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request, { ignoreSearch: true }).then((cached) => cached || caches.match("index.html")),
      ),
  );
});

// Push de filme novo mandado por api/notify-new-movies.js ({title, body, url}).
self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "Barbie Movies Tracker", {
      body: payload.body || "",
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      data: { url: payload.url || "." },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : ".";
  event.waitUntil(clients.openWindow(targetUrl));
});
