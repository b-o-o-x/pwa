self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('push', (e) => {
  const data = e.data.json();
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: 'https://b-o-o-x.github.io/pwa/cloud-chat/cloud-chat-512.png'
  });
});
