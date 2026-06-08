/* Service Worker für den Strafenkatalog
   Strategie: erst Netz (immer aktuell), dann Cache als Offline-Fallback. */
const CACHE = 'strafenkatalog-v2';
const DATEIEN = ['./','./index.html','./style.css','./script.js','./manifest.json','./icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  // Netz zuerst: holt immer die neueste Version, aktualisiert den Cache.
  e.respondWith(
    fetch(e.request).then(res => {
      const kopie = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, kopie)).catch(()=>{});
      return res;
    }).catch(() => caches.match(e.request))
  );
});
