/* Service worker: cache-first (con aggiornamento in background) per l'app shell. */

const CACHE_NAME = 'jetprogram-cache-v11';

const PRECACHE_URLS = [
  './',
  './index.html',
  './atleta.html',
  './sessione.html',
  './sessioni.html',
  './squadre.html',
  './grafici.html',
  './radar.html',
  './confronto.html',
  './login.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/utils.js',
  './js/auth.js',
  './js/firebase-config.js',
  './js/db.js',
  './js/esercizi-config.js',
  './js/radar-config.js',
  './js/charts.js',
  './js/pdf-export.js',
  './js/page-home.js',
  './js/page-atleta.js',
  './js/page-sessione.js',
  './js/page-elenco-sessioni.js',
  './js/page-squadre.js',
  './js/page-grafici.js',
  './js/page-radar.js',
  './js/page-confronto.js',
  './js/page-login.js',
  './vendor/chart.umd.js',
  './vendor/jspdf.umd.min.js',
  './vendor/firebase/firebase-app-compat.js',
  './vendor/firebase/firebase-auth-compat.js',
  './vendor/firebase/firebase-firestore-compat.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
