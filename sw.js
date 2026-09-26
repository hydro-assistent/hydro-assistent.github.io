// Hydro-Assistent: macht die App offline nutzbar.
// Bei jeder neuen Fassung die Nummer erhöhen, dann holt sich das Handy die neue Version.
const VERSION = 'hydro-3.9.1';
const DATEIEN = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
const WARTEN_MS = 3000; // so lange aufs Netz warten, dann aus dem Speicher (bei schwachem Empfang)
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(DATEIEN))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== VERSION).map(n => caches.delete(n)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const ausSpeicher = () => caches.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : undefined));
  // Erst Netz (damit Updates ankommen). Dauert es zu lange oder fehlt es, aus dem Speicher.
  const netz = fetch(e.request).then(r => {
    if (r.ok && (e.request.url.startsWith(self.location.origin) || e.request.url.includes('fonts.g'))) {
      const kopie = r.clone(); caches.open(VERSION).then(c => c.put(e.request, kopie));
    }
    return r;
  });
  e.waitUntil(netz.catch(() => {})); // auch wenn der Speicher schneller war, kommt das Update noch an
  e.respondWith(new Promise(fertig => {
    let erledigt = false;
    const nimm = r => { if (!erledigt && r) { erledigt = true; fertig(r); } };
    const t = setTimeout(() => ausSpeicher().then(nimm), WARTEN_MS);
    netz.then(r => { clearTimeout(t); nimm(r); })
      .catch(() => { clearTimeout(t); ausSpeicher().then(r => r ? nimm(r) : nimm(Response.error())); });
    // Nach Ablauf der Wartezeit ohne Speichertreffer: weiter aufs Netz warten
    netz.then(nimm, () => {});
  }));
});
