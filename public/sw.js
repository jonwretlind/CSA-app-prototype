const CACHE_NAME = 'csa-app-v4';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/assessment.html',
  '/admin.html',
  '/css/main.css',
  '/js/api.js',
  '/js/auth.js',
  '/js/dashboard.js',
  '/js/assessment.js',
  '/js/admin.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Only handle same-origin requests — let the browser handle external CDN/font requests directly
  if (!event.request.url.startsWith(self.location.origin)) return;
  // Never cache API requests — always go to network
  if (event.request.url.includes('/api/')) return;

  // Cache-first for shell assets, network fallback
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
      .catch(() => caches.match('/index.html'))
  );
});
