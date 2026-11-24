/* DAWAH X — service worker
   Offline support for the static reader. No analytics, no external origins.
   Bump CACHE when any core asset changes (index.html also carries ?v=13).
   file:// has no service workers; the site still works there via script tags.
*/
const CACHE = 'dawahx-v13';
const SCOPE = self.registration.scope;
const u = (p) => new URL(p, SCOPE).toString();

const SHELL = [
  './', './index.html', './manifest.json', './CREDITS.md', './favicon.svg',
  './assets/style.css?v=13', './assets/app.js?v=13', './assets/surahs.js?v=13',
  './assets/quran-data.js?v=13', './assets/bn-index.js?v=13',
  './assets/quran-meta.js?v=13', './assets/hadith-index.js?v=13',
  './assets/tafsir-ibn-kathir-index.js?v=13', './assets/Hafs_20.woff2',
  './assets/NotoSansBengali.woff2', './assets/icons/icon-192.png',
  './assets/icons/icon-512.png', './assets/icons/og-image.png',
  './assets/bn/1.js?v=13', './assets/tafsir/1.js?v=13',
  './assets/tafsir-ibn-kathir/1.js?v=13',
  './assets/hadith/bukhari/1.js?v=13', './assets/hadith/muslim/0.js?v=13'
].map(u);

/* Everything else can be fetched on demand. This list is used only by the
   optional "সম্পূর্ণ অফলাইন ডাউনলোড" button in the app. */
function allLazyUrls() {
  const out = [u('./assets/bn-translation.js?v=13')];
  for (let s = 1; s <= 114; s++) {
    out.push(u('./assets/bn/' + s + '.js?v=13'));
    out.push(u('./assets/tafsir/' + s + '.js?v=13'));
    out.push(u('./assets/tafsir-ibn-kathir/' + s + '.js?v=13'));
  }
  // 9 books; ranges come from tools/build-hadith.py (428 shards).
  const HADITH_SHARDS = {
    bukhari: [1, 97], muslim: [0, 56], abudawud: [1, 43], tirmidhi: [1, 49],
    nasai: [1, 51], ibnmajah: [0, 37], mishkat: [1, 31],
    malik: [1, 61], nawawi: [1, 1]
  };
  for (const [book, range] of Object.entries(HADITH_SHARDS)) {
    for (let s = range[0]; s <= range[1]; s++) {
      out.push(u('./assets/hadith/' + book + '/' + s + '.js?v=13'));
    }
  }
  return out;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(SHELL.map((url) => c.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never proxy third parties

  if (req.mode === 'navigate') {
    // Network first so a deploy is seen, cache fallback when offline.
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(u('./index.html'), copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(u('./index.html')).then((r) => r || Response.error()))
    );
    return;
  }

  // Cache-first for local assets (filenames are versioned with ?v=13).
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});

/* Optional full offline download, triggered by the UI. */
self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'PRECACHE_ALL') return;
  const urls = allLazyUrls();
  const port = event.ports && event.ports[0];
  let done = 0, failed = 0;
  caches.open(CACHE).then(async (c) => {
    for (let i = 0; i < urls.length; i += 8) {
      const batch = urls.slice(i, i + 8);
      const results = await Promise.allSettled(batch.map(async (url) => {
        const hit = await c.match(url, { ignoreSearch: true });
        if (hit) return;
        const res = await fetch(url, { cache: 'reload' });
        if (!res.ok) throw new Error(String(res.status));
        await c.put(url, res);
      }));
      done += batch.length;
      failed += results.filter((r) => r.status === 'rejected').length;
      if (port) port.postMessage({ done, total: urls.length, failed });
    }
    if (port) port.postMessage({ done, total: urls.length, failed, complete: true });
  }).catch((e) => {
    if (port) port.postMessage({ done, total: urls.length, failed: -1, error: String(e), complete: true });
  });
});
