/* Service worker — Poste du DG des Maple Leafs.
   Stratégie : réseau d'abord (la page reste fraîche), cache en secours
   (l'application s'ouvre hors ligne avec la dernière version vue). */
const CACHE = 'leafs-dg-v4';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c =>
    c.addAll(['.', 'index.html', 'manifest.webmanifest', 'icon.svg'])));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(rep => {
      const copie = rep.clone();
      caches.open(CACHE).then(c => c.put(e.request, copie));
      return rep;
    }).catch(() =>
      caches.match(e.request, {ignoreSearch: true})
        .then(r => r || caches.match('index.html'))));
});
