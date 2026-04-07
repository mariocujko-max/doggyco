const CACHE_NAME = 'doggyco-cache-v1';

// Einfacher Installations-Event (macht momentan noch nichts Besonderes, reicht aber für PWABuilder)
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Einfache Netzwerk-Anfrage
    event.respondWith(fetch(event.request));
});
