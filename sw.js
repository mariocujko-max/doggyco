const CACHE_NAME = 'doggyco-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/music.mp3',
  '/hintergrund.png'
  // Füge hier auch deine mp4-Videos hinzu, falls sie gecacht werden sollen
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
