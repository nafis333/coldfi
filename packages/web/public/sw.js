self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {}
  const title = data.title ?? 'ColdFi';
  const options = {
    body: data.body ?? '',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: data.data ?? {},
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data;
  let url = '/';
  if (data.groupId) url = `/groups/${data.groupId}`;
  else if (data.settlementId && data.groupId) url = `/groups/${data.groupId}?tab=settlements`;
  event.waitUntil(clients.openWindow(url));
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
