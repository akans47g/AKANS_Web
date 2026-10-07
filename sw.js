// ── AKANS PWA Service Worker ──────────────────────────────
// Version: bump this string to force cache refresh on update
const CACHE_VERSION = 'akans-v1';
const OFFLINE_URL   = '/AKANS_Web/offline.html';

// Pages & assets to pre-cache on install
const PRECACHE_URLS = [
  '/AKANS_Web/',
  '/AKANS_Web/index.html',
  '/AKANS_Web/booking.html',
  '/AKANS_Web/orders.html',
  '/AKANS_Web/account.html',
  '/AKANS_Web/review.html',
  '/AKANS_Web/refer.html',
  '/AKANS_Web/login.html',
  '/AKANS_Web/offline.html',
  '/AKANS_Web/manifest.json',
  '/AKANS_Web/logo.jpg',
  '/AKANS_Web/firebase-config.js'
];

// ── INSTALL: pre-cache all key pages ─────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      console.log('[SW] Pre-caching pages');
      // Use { cache: 'reload' } so we get fresh copies at install time
      return Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(new Request(url, { cache: 'reload' }))
            .catch(err => console.warn('[SW] Failed to cache:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: delete old cache versions ──────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: Network-first for HTML, Cache-first for assets ─
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin or GitHub Pages requests
  if (!url.hostname.includes('github.io') &&
      url.hostname !== self.location.hostname) return;

  // Skip non-GET requests and Firebase/Google API calls
  if (request.method !== 'GET') return;
  if (url.hostname.includes('googleapis.com') ||
      url.hostname.includes('firebaseapp.com') ||
      url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('identitytoolkit') ||
      url.hostname.includes('gstatic.com')) return;

  // HTML pages → Network first, fallback to cache, then offline page
  if (request.headers.get('Accept')?.includes('text/html') ||
      url.pathname.endsWith('.html') ||
      url.pathname === '/AKANS_Web/' ||
      url.pathname === '/AKANS_Web') {

    event.respondWith(
      fetch(request)
        .then(response => {
          // Clone and store fresh copy in cache
          if (response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(request, cloned));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(cached =>
            cached || caches.match(OFFLINE_URL)
          )
        )
    );
    return;
  }

  // Static assets (images, JS, CSS, fonts) → Cache first, then network
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok) {
          const cloned = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(request, cloned));
        }
        return response;
      }).catch(() => {
        // For images, return a transparent placeholder
        if (request.destination === 'image') {
          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#eef1fb"/><text x="100" y="110" text-anchor="middle" font-size="14" fill="#8890b5">Offline</text></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        }
      });
    })
  );
});

// ── BACKGROUND SYNC: retry failed requests when back online ─
self.addEventListener('sync', event => {
  if (event.tag === 'sync-orders') {
    console.log('[SW] Background sync: orders');
  }
});

// ── PUSH NOTIFICATIONS (future use) ──────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || 'AKANS', {
    body: data.body || 'New update from AKANS!',
    icon: '/AKANS_Web/logo.jpg',
    badge: '/AKANS_Web/logo.jpg',
    tag: 'akans-notification',
    data: { url: data.url || '/AKANS_Web/' }
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/AKANS_Web/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('/AKANS_Web/') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
