// Service worker Life Admin – uloží hlavní aplikaci i všechny vložené aplikace, aby fungovaly offline.
// Tvoje data se sem NEUKLÁDAJÍ (ta jsou v úložišti prohlížeče), jen soubory aplikací.
// Mezipaměť sdílí celá doména forallbobs.github.io, proto mažeme jen vlastní (předpona PREFIX).
// Při přidání nové aplikace připiš její index.html do ASSETS.
const PREFIX = 'lifeadmin-';
const CACHE = PREFIX + 'v1';
const ASSETS = [
  './', './index.html', './manifest.json', './icon-192.png', './icon-512.png',
  './apps/doklady/index.html',
  './apps/predplatne/index.html'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Klíč do mezipaměti bez ?parametrů a #kotvy – stejná stránka = jeden záznam
const keyOf = url => { const u = new URL(url); u.search = ''; u.hash = ''; return u.href; };

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  // Stránky (hlavní i vložené aplikace): nejdřív internet = vždy nejnovější verze,
  // bez signálu nebo při chybě webu uložená kopie TÉ SAMÉ stránky.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE), key = keyOf(req.url);
      try {
        const net = await Promise.race([
          fetch(req),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
        ]);
        if (net.ok) { cache.put(key, net.clone()); return net; }
        return (await cache.match(key)) || net;
      } catch {
        const hit = await cache.match(key);
        if (hit) return hit;
        // neznámá stránka bez signálu: hlavní okno → přehled; vložená aplikace → chyba (ať se přehled nevnoří sám do sebe)
        if (req.destination === 'document') { const home = await cache.match(keyOf(self.registration.scope)); if (home) return home; }
        return Response.error();
      }
    })());
    return;
  }

  // Ostatní soubory (ikony, manifest): nejdřív z mezipaměti
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
