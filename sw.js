// Simple service worker for offline caching
const CACHE_NAME = 'snazzy-todo-cache-v1';
const ASSETS_TO_CACHE = [
  '.',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json'
];

// Install: cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
  self.clients.claim();
});

// Fetch: network-first for API-like calls, cache fallback for app shell
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).then(response => {
      // put a copy in cache for next time
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => {
        cache.put(event.request, clone);
      });
      return response;
    }).catch(() => {
      return caches.match(event.request).then(cached => cached || caches.match('./index.html'));
    })
  );
});
