/* Service worker — Poste du DG (USHL Pro).
   Stratégie : réseau d'abord (la page et le relevé restent frais), cache en
   secours (l'application s'ouvre hors ligne avec la dernière version vue).
   Seuls les fichiers de la page sont concernés : les requêtes vers ushl.ca
   et les relais ne passent pas par ici. */
const CACHE = 'poste-dg-v9';
const FICHIERS = [
  '.', 'index.html', 'manifest.webmanifest', 'icon.svg', 'css/style.css',
  'data/s21.js', 'data/releve.js',
  'js/config.js', 'js/reglements.js', 'js/ushl.js', 'js/moteur.js', 'js/etat.js', 'js/sources.js', 'js/ui.js',
  'js/contrats.js', 'js/app.js',
  'js/vues/club.js', 'js/vues/prolongation.js', 'js/vues/production.js', 'js/vues/plafond.js',
  'js/vues/progression.js', 'js/vues/trios.js', 'js/vues/classement.js', 'js/vues/ligue.js',
  'js/vues/recotes.js', 'js/vues/echange.js', 'js/vues/comparateur.js', 'js/vues/ov.js', 'js/vues/reglages.js'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS)));
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
      if (rep.ok){
        const copie = rep.clone();
        caches.open(CACHE).then(c => c.put(e.request, copie));
      }
      return rep;
    }).catch(() =>
      caches.match(e.request, {ignoreSearch: true})
        .then(r => r || caches.match('index.html'))));
});
