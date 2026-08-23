// ══════════════════════════════════════════════════════════════════
// sw.js — AKANS Service Worker
// PWA ke liye offline support aur caching
// ══════════════════════════════════════════════════════════════════

const CACHE_NAME    = 'akans-v1.0';
const OFFLINE_URL   = '/AKANS_Web/offline.html';
const BASE          = '/AKANS_Web/';

// ── Cache karne wali files ────────────────────────────────────────
const STATIC_ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'login.html',
  BASE + 'account.html',
  BASE + 'booking.html',
  BASE + 'orders.html',
  BASE + 'review.html',
  BASE + 'refer.html',
  BASE + 'support.html',
  BASE + 'privacy.html',
  BASE + 'about.html',
  BASE + 'social.html',
  BASE + 'other.html',
  BASE + 'admin/admin-login.html',
  BASE + 'admin/admin-dashboard.html',
  BASE + 'admin/admin-bookings.html',
  BASE + 'admin/admin-templates.html',
  BASE + 'admin/admin-reviews.html',
  BASE + 'admin/admin-coupons.html',
  BASE + 'admin/admin-users.html',
  BASE + 'admin/admin-referrals.html',
  BASE + 'admin/admin-settings.html',
  BASE + 'admin/admin-whatsapp.html',
  BASE + 'firebase-config.js',
  BASE + 'admin/admin-all.js',
  BASE + 'manifest.json',
  BASE + 'offline.html',
  BASE + 'logo.jpg',
  BASE + 'Qr.jpg',
];

// ── INSTALL — pehli baar cache karo ───────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing AKANS Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching static assets');
      // Individual failures ignore karo (koi file missing ho toh bhi chale)
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(err =>
            console.warn('[SW] Could not cache:', url, err)
          )
        )
      );
    }).then(() => {
      console.log('[SW] Install complete');
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE — purana cache saaf karo ─────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => {
      console.log('[SW] Activated — taking control');
      return self.clients.claim();
    })
  );
});

// ── FETCH — requests handle karo ──────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Firebase requests aur external APIs ko bypass karo
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('google') ||
    url.hostname.includes('fonts.') ||
    request.method !== 'GET'
  ) {
    return; // Browser se normally fetch hone do
  }

  // Navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Fresh response cache mein update karo
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          // Offline — cache se do
          return caches.match(request)
            .then(cached => cached || caches.match(OFFLINE_URL));
        })
    );
    return;
  }

  // Static assets (JS, CSS, images)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        // Cache se do, background mein update bhi karo
        fetch(request).then(response => {
          if (response && response.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(request, response));
          }
        }).catch(() => {});
        return cached;
      }
      // Cache mein nahi → network se fetch karo
      return fetch(request)
        .then(response => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(OFFLINE_URL));
    })
  );
});

// ── BACKGROUND SYNC (future use) ──────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-bookings') {
    console.log('[SW] Background sync: bookings');
  }
});

// ── PUSH NOTIFICATIONS (future use) ───────────────────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title   = data.title   || 'AKANS Notification';
  const options = {
    body:    data.body    || 'Aapke liye ek notification hai',
    icon:    BASE + 'logo.jpg',
    badge:   BASE + 'logo.jpg',
    vibrate: [200, 100, 200],
    data:    { url: data.url || BASE },
    actions: [
      { action: 'view',    title: '👁️ Dekho' },
      { action: 'dismiss', title: '✕ Band karo' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── NOTIFICATION CLICK ────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'view' || !event.action) {
    const url = event.notification.data?.url || BASE;
    event.waitUntil(clients.openWindow(url));
  }
});

console.log('[SW] Service Worker loaded — AKANS v1.0');
