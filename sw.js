const CACHE_NAME = 'doggyco-cache-v3';

// Installations-Event
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// Aktivierungs-Event
self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// Fetch-Event (für PWABuilder notwendig)
self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});
