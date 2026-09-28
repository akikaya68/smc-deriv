// Service Worker pour SMC Trader Pro
const CACHE_NAME = 'smc-trader-v1';
const ONE_SIGNAL_SDK = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js';

// Installation
self.addEventListener('install', (event) => {
    console.log('[SW] Installation');
    self.skipWaiting();
});

// Activation
self.addEventListener('activate', (event) => {
    console.log('[SW] Activation');
    event.waitUntil(self.clients.claim());
});

// Interception fetch (cache offline)
self.addEventListener('fetch', (event) => {
    // Ne pas interférer avec OneSignal et API externes
    const url = new URL(event.request.url);
    if (url.hostname.includes('onesignal') ||
        url.hostname.includes('twelvedata') ||
        url.hostname.includes('api.telegram')) {
        return;
    }
    // Sinon cache simple
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request).then((fetchResponse) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    if (event.request.method === 'GET') {
                        cache.put(event.request, fetchResponse.clone());
                    }
                    return fetchResponse;
                });
            });
        }).catch(() => fetch(event.request))
    );
});

// Import du SDK OneSignal Service Worker
try {
    importScripts(ONE_SIGNAL_SDK);
} catch (e) {
    console.warn('[SW] OneSignal SDK non chargé');
}

// Notifications push
self.addEventListener('push', (event) => {
    console.log('[SW] Push reçu');
    let data = { title: 'SMC Trader', body: 'Nouvelle notification' };
    try {
        if (event.data) data = event.data.json();
    } catch (e) {}

    event.waitUntil(
        self.registration.showNotification(data.title || 'SMC Trader', {
            body: data.body || '',
            icon: 'https://ui-avatars.com/api/?name=SMC&background=16a34a&color=fff&size=192&bold=true',
            badge: 'https://ui-avatars.com/api/?name=SMC&background=16a34a&color=fff&size=72&bold=true',
            vibrate: [200, 100, 200],
            data: data.url || '/smc-deriv/',
            tag: data.tag || 'smc-' + Date.now()
        })
    );
});

// Clic sur notification
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes('smc-deriv') && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/smc-deriv/');
            }
        })
    );
});