// Load version from same directory to keep GitHub Pages repo paths working
importScripts('./version.js');
const NAME = `paddentrek-${APP_VERSION}`;
const URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './version.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/ui/pair.png',
  './icons/ui/pair_dead.png',
  './icons/ui/male.png',
  './icons/ui/female.png',
  './icons/ui/unk.png',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://unpkg.com/html5-qrcode'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(NAME).then(c => c.addAll(URLS)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== NAME && caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ includeUncontrolled: true })
        .then(clients => clients.forEach(c => c.postMessage({ type: 'NEW_VERSION', version: APP_VERSION }))))
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
