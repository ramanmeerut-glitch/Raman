/* Firebase Cloud Messaging service worker for Raman Dashboard */
'use strict';

importScripts('./js/config.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp(self.RAMAN_APP_CONFIG.firebase);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const notification = payload.notification || {};
  const data = payload.data || {};

  self.registration.showNotification(notification.title || data.title || 'Raman Dashboard', {
    body: notification.body || data.body || '',
    icon: notification.icon || data.icon || '',
    badge: data.badge || '',
    tag: data.tag || 'raman-dashboard',
    data: {
      url: data.url || '/'
    }
  });
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
