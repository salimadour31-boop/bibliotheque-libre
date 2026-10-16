// Service worker : coque de l'app et pages du catalogue en cache (stale-while-revalidate).
// Les livres (servis par les dépôts de données, autre origine) sont mis en cache explicitement par l'app dans "books-v1".
const SHELL = 'shell-v3';
const BOOKS = 'books-v1';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(['./', './index.html', './catalogue/index.json', './manifest.webmanifest', './icon.svg', './icon-192.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('shell-') && k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // modèles HF : gérés par le cache de Transformers.js
  if (url.pathname.includes('/books/')) {
    // livres : cache d'abord (s'ils ont été téléchargés), sinon réseau sans mise en cache automatique
    e.respondWith(caches.open(BOOKS).then((c) => c.match(e.request).then((r) => r || fetch(e.request))));
    return;
  }
  e.respondWith(caches.open(SHELL).then(async (c) => {
    const cached = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => cached || (e.request.mode === 'navigate' ? c.match('./index.html') : Response.error()));
    return cached || net;
  }));
});
