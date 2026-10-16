// Service worker : coque de l'app en cache (stale-while-revalidate), livres téléchargés dans "books-v1".
const SHELL = 'shell-v1';
const BOOKS = 'books-v1';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(['./', './index.html', './catalogue.json', './manifest.webmanifest', './icon.svg', './icon-192.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
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
