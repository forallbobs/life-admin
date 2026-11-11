// Service worker Life Admin – uloží hlavní aplikaci i všechny vložené aplikace, aby fungovaly offline.
// Tvoje data se sem NEUKLÁDAJÍ (ta jsou v úložišti prohlížeče), jen soubory aplikací.
// Mezipaměť sdílí celá doména forallbobs.github.io, proto mažeme jen vlastní (předpona PREFIX).
// Při přidání nové aplikace připiš její soubor do ASSETS a zvyš číslo v CACHE.
const PREFIX = 'lifeadmin-';
const CACHE = PREFIX + 'v9';
const ASSETS = [
  './', './index.html', './manifest.json', './icon-192.png', './icon-512.png',
  './doklady.html', './predplatne.html', './bilkoviny.html', './meny.html', './auto.html', './udrzba.html', './prevence.html', './navody.html', './vareni.html'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))   // při instalaci vždy čerstvé soubory
    .then(() => self.skipWaiting()));
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

  // Stránky (hlavní i vložené aplikace): nejdřív internet = vždy nejnovější verze.
  // cache:'no-cache' = zeptat se GitHubu, i když má prohlížeč soubor ještě „čerstvý“
  // (GitHub Pages jinak dovolí prohlížeči držet starou verzi až 10 minut).
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE), key = keyOf(req.url);
      try {
        const net = await Promise.race([
          fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))
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
