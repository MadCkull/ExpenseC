// Push notification handler for ExpenseC PWA
self.addEventListener('push', function(event) {
    const payload = event.data ? event.data.json() : {};
    const title = payload.title || 'ExpenseC';
    
    const options = {
        body: payload.body || '',
        icon: '/ExpenseC-192.png',
        badge: '/ExpenseC-192.png',
        vibrate: [100, 50, 100],
        // Move url into data so it's not visible in the notification UI
        data: payload.data || { url: payload.url || '/' }
    };
    
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            // Focus existing window if available
            for (const client of windowClients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open a new window
            return clients.openWindow(url);
        })
    );
});
