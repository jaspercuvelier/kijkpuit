// Load version from same directory to keep GitHub Pages repo paths working
importScripts('./version.js');
const NAME = `paddentrek-${APP_VERSION}`;
const URLS = [
  './',
  './index.html',
  './app.js',
  './manifest.webmanifest',
  './version.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/ui/pair.png',
  './icons/ui/pair_dead.png',
  './icons/ui/male.png',
  './icons/ui/female.png',
  './icons/ui/unk.png',
  './vendor/tailwindcss.cdn.js',
  './vendor/QRCode.js',
  './vendor/html5-qrcode.js'
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

self.addEventListener('message', e => {
  if(e?.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;

  // Navigaties: probeer eerst netwerk zodat nieuwe shell sneller doorbreekt.
  if(req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const net = await fetch(req);
        const cache = await caches.open(NAME);
        cache.put(req, net.clone());
        return net;
      } catch(_) {
        return (await caches.match(req)) || (await caches.match('./index.html')) || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const cached = await caches.match(req);
    if(cached) return cached;
    try {
      const net = await fetch(req);
      if(net && net.status === 200 && (new URL(req.url)).origin === self.location.origin) {
        const cache = await caches.open(NAME);
        cache.put(req, net.clone());
      }
      return net;
    } catch(_) {
      return new Response('Offline', { status: 503 });
    }
  })());
});
