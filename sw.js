const CACHE = 'xmax-1782460983367';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('message', e => { if (e.data === 'skip-waiting') self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const isDoc = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
  if (isDoc) {
    // stale-while-revalidate: เปิดทันทีจากแคช + อัปเดตเบื้องหลัง (เวอร์ชันใหม่มารอบถัดไป + reload อัตโนมัติ)
    const netP = fetch(req, { cache: 'no-store' }).then(net => { if (net && net.ok) caches.open(CACHE).then(c => c.put('./index.html', net.clone())); return net; }).catch(() => null);
    e.respondWith((async () => (await caches.match('./index.html')) || (await netP) || (await caches.match(req)) || Response.error())());
    e.waitUntil(netP);
    return;
  }
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try { const net = await fetch(req); if (net && net.status === 200) (await caches.open(CACHE)).put(req, net.clone()); return net; }
    catch (err) { return cached || Response.error(); }
  })());
});