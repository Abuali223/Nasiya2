// Simple offline cache for PWA
const CACHE = 'nasiya-cache-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k!==CACHE).map(k => caches.delete(k))
  )));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  e.respondWith(
    caches.match(req).then(res => res || fetch(req).then(resp => {
      const copy = resp.clone();
      if(req.method==='GET' && resp.status===200 && req.url.startsWith(self.location.origin)){
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return resp;
    }).catch(()=>caches.match('./index.html')))
  );
});