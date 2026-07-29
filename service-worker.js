const CACHE_NAME = 'cmk-pwa-v10';

const APP_SHELL = [
  './',
  './index.html',
  './Administraci%C3%B3n%20CMK.html',
  './manifest.json',
  './icon-padded.png',
  './favicon.svg',
  './styles.css',
  './app.js'
];

const CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/@alpinejs/collapse@3.x.x/dist/cdn.min.js',
  'https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_SHELL);
      // CDNs se cachean individualmente para no bloquear la instalación si alguno falla
      for (const url of CDN_ASSETS) {
        try { await cache.add(url); } catch (e) { console.warn('No se pudo cachear CDN:', url); }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isSupabase = url.hostname.includes('supabase.co');

  // Nunca cachear requests de Supabase para evitar datos viejos en telefono.
  if (isSupabase) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Navegaciones: network-first para recibir HTML actualizado.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if ((isSameOrigin || CDN_ASSETS.some(cdn => event.request.url.startsWith(cdn))) && response && response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
