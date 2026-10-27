'use strict';
// Increase VERSION whenever any app-shell file changes.
const VERSION = 'v2.4.0';
const PREFIX = 'hybrid-training:' + self.registration.scope + ':';
const CACHE = PREFIX + VERSION;
const SHELL = ['./', './index.html', './styles.css', './data.js', './db.js', './model.js', './app.js', './manifest.json', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
const ASSETS = new Set(SHELL.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => {
  // Ignore the browser's HTTP cache when a new worker warms its offline shell.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL.map(path => new Request(path, { cache: 'reload' })))));
  // Updates wait until the user explicitly accepts, protecting the current editing session.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  // App-shell only: do not cache exported data, arbitrary URLs, or any requests outside this repository.
  if (event.request.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then(cache => cache.match('./index.html')).then(cached => cached || fetch(event.request)));
  } else if (ASSETS.has(url.href)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request)).then(cached => cached || fetch(event.request)));
  }
});
