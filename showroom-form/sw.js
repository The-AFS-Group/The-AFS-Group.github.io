// Keeps the check-in page opening when showroom wifi drops.
// Network first (so edits go live), cache as the fallback.
const CACHE = 'showroom-form-v1';
const PRECACHE = [
  './', 'index.html', 'config.js', 'manifest.webmanifest',
  'assets/afs-group.png', 'assets/gym-and-fitness.png', 'assets/revel-saunas.svg',
  'assets/waterrower-nohrd.png', 'assets/nordictrack.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  const cacheable = req.method === 'GET' &&
    (url.origin === location.origin || url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com'));
  if (!cacheable) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
