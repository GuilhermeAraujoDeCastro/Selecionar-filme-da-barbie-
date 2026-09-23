// Service worker do PWA: cache-first so' do "app shell" (HTML/CSS/JS/
// manifest/icones deste mesmo site), pra abrir offline/instalado. NUNCA
// intercepta a API da TMDB nem do Firebase - senao a lista de filmes ou o
// login ficariam presos em cache velho. Fica de fora da minificacao
// (scripts/minify.js) de proposito, pra ficar facil de depurar problema de
// cache direto no F12.

const CACHE_NAME = "barbie-movies-tracker-shell-v1";

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
      // cache.add() individual (nao cache.addAll) pra um arquivo faltando
      // (ex.: js/config.js no modo visitante) nao derrubar a instalacao inteira.
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

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});

// Notificacao de filme novo (item 13): a function da Vercel
// (api/notify-new-movies.js) manda um push com {title, body, url}.
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
