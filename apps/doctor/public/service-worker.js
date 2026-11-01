const CACHE_NAME = 'tawreed-brand-v4';
const APP_SHELL = ['/', '/manifest.webmanifest', '/favicon.ico', '/favicon.svg', '/apple-touch-icon.png', '/app-icon-192.png', '/app-icon-512.png', '/maskable-512.png'];
// Content-hashed build output never changes for a given URL, so it is served cache-first.
const IMMUTABLE_PREFIXES = ['/_expo/static/', '/assets/'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

const store = (request, response) => {
  // Clone synchronously, before the original body is handed to the page.
  if (response.ok && response.type === 'basic') {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Pages: network-first so a new deploy is picked up at once; cached shell only when offline.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => store('/', response)).catch(() => caches.match('/')));
    return;
  }

  if (IMMUTABLE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request).then((response) => store(request, response))));
    return;
  }

  // Everything else: stale-while-revalidate.
  event.respondWith(caches.match(request).then((cached) => {
    const refresh = fetch(request).then((response) => store(request, response));
    if (!cached) return refresh;
    event.waitUntil(refresh.catch(() => undefined));
    return cached;
  }));
});
