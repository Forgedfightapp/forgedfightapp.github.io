// FORGED app retired 2026-11-18. Kill-switch service worker: clears every cache,
// unregisters itself and sends open windows to forgedfight.com.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.clients.claim();
    await self.registration.unregister();
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(wins.map((c) => c.navigate('https://forgedfight.com/').catch(() => {})));
  })());
});
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') event.respondWith(Response.redirect('https://forgedfight.com/', 302));
});
