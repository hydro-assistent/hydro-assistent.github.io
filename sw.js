// Hydro-Assistent: macht die App offline nutzbar.
// Bei jeder neuen Fassung die Nummer erhöhen, dann holt sich das Handy die neue Version.
const VERSION = 'hydro-1.4';
const DATEIEN = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(DATEIEN))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== VERSION).map(n => caches.delete(n)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Erst Netz (damit Updates ankommen), ohne Netz aus dem Speicher
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok && (e.request.url.startsWith(self.location.origin) || e.request.url.includes('fonts.g'))) {
      const kopie = r.clone(); caches.open(VERSION).then(c => c.put(e.request, kopie));
    }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
