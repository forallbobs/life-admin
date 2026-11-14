// Hlídač stránek pro Life Admin – spouští ho GitHub Action (.github/workflows/hlidac.yml).
// Stáhne hlídané stránky, vytáhne z nich podstatný údaj a uloží ho do watch/stav.json.
// Aplikace hlidac.html ten soubor čte a změny ukáže v „Co hoří“.
// Volitelně pošle zprávu do Telegramu (tajemství TG_TOKEN a TG_CHAT v nastavení repa).
import fs from 'node:fs';

const OUT = 'watch/stav.json';
const HEARTBEAT_H = 6;            // i bez změny zapsat aspoň jednou za 6 h (aplikace pozná, že automat běží)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const TEST_DIR = process.env.HLIDAC_TEST_DIR || '';   // pro test: číst HTML ze souborů místo webu

const WATCHES = {
  kaktus: { url: 'https://www.mujkaktus.cz/chces-pridat', parse: parseKaktus },
  amd: { url: 'https://www.amd.com/en/support/downloads/drivers.html/graphics/radeon-rx/radeon-rx-6000-series/amd-radeon-rx-6600-xt.html', parse: parseAmd },
};

async function get(id, url) {
  if (TEST_DIR) return fs.readFileSync(`${TEST_DIR}/${id}.html`, 'utf8');
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`stránka vrátila chybu ${r.status}`);
  return await r.text();
}
const decode = s => s.replace(/&nbsp;|&#160;/g, ' ').replace(/&ndash;|&#8211;/g, '–').replace(/&amp;/g, '&')
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)));
const toText = h => decode(h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
const pad = n => String(n).padStart(2, '0');
const hhmm = s => { const [h, m] = s.replace('.', ':').split(':'); return `${pad(h)}:${m}`; };

// Kaktus: „Dobíječka“ → nadpis s datem „10. 11. 2026 17:00 - 19:00“
function parseKaktus(html) {
  const t = toText(html);
  const i = t.search(/Dob[ií]je[cč]k/i);
  const part = i >= 0 ? t.slice(i, i + 4000) : t;
  const m = part.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s*(?:od\s*)?(\d{1,2}[:.]\d{2})\s*(?:-|–|—|do)\s*(\d{1,2}[:.]\d{2})/)
         || part.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})()()/);
  if (!m) throw new Error('na stránce jsem nenašel datum dobíječky');
  const year = m[3] ? Number(m[3]) : new Date().getFullYear();
  const date = `${year}-${pad(m[2])}-${pad(m[1])}`;
  if (isNaN(new Date(date))) throw new Error('datum dobíječky nejde přečíst');
  return { date, from: m[4] ? hhmm(m[4]) : null, to: m[5] ? hhmm(m[5]) : null, text: m[0].trim(), key: `${date} ${m[4] ? hhmm(m[4]) : ''}`.trim() };
}

// AMD: odkazy na ovladače pro Windows 11 (…-win11-….exe) → verze z názvu souboru
const vcmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };
function parseAmd(html) {
  html = html.replace(/\\\//g, '/');   // odkazy uvnitř JSON bývají jako https:\/\/…
  const urls = [...new Set([...html.matchAll(/https?:\/\/drivers\.amd\.com\/drivers\/[^"'\s<>\\]*?win11[^"'\s<>\\]*?\.exe/gi)].map(m => m[0]))];
  const list = urls.map(u => { const v = u.match(/adrenalin-edition-(\d+\.\d+\.\d+)/i); return v ? { version: v[1], whql: /\/whql-/i.test(u), url: u } : null; }).filter(Boolean);
  if (!list.length) throw new Error('na stránce jsem nenašel ovladače pro Windows 11');
  list.sort((a, b) => vcmp(b.version, a.version) || (b.whql - a.whql));
  const latest = list[0], whql = list.find(x => x.whql) || null;
  return { latest: { version: latest.version, kind: latest.whql ? 'WHQL – doporučený' : 'Optional – volitelný', url: latest.url },
    whql: whql ? { version: whql.version, url: whql.url } : null, key: latest.version };
}

async function telegram(text) {
  const tok = process.env.TG_TOKEN, chat = process.env.TG_CHAT;
  if (!tok || !chat || TEST_DIR) return;
  try { await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }) }); }
  catch (e) { console.log('Telegram:', e.message); }
}
const fmtCz = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d}. ${m}. ${y}`; };

const old = (() => { try { return JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { return {}; } })();
const now = new Date().toISOString();
const out = { v: 1, checkedAt: now, items: {} };
let changed = false;
for (const [id, w] of Object.entries(WATCHES)) {
  const prev = (old.items || {})[id] || {};
  try {
    const val = w.parse(await get(id, w.url));
    const isNew = prev.key !== val.key;
    out.items[id] = { ok: true, url: w.url, ...val, changedAt: isNew ? now : (prev.changedAt || now) };
    if (isNew) {
      changed = true;
      console.log(`${id}: ZMĚNA → ${val.key}`);
      if (prev.key) {   // první běh neposílá
        if (id === 'kaktus') await telegram(`🌵 Kaktus dobíječka: ${fmtCz(val.date)}${val.from ? ` ${val.from}–${val.to || ''}` : ''}\n${w.url}`);
        if (id === 'amd') await telegram(`🖥️ Nový ovladač AMD pro RX 6600 XT (Windows 11): ${val.latest.version} (${val.latest.kind})\n${w.url}`);
      }
    } else console.log(`${id}: beze změny (${val.key})`);
  } catch (e) {
    console.log(`${id}: CHYBA – ${e.message}`);
    out.items[id] = { ...prev, ok: false, url: w.url, error: e.message, errorAt: now };
    if (prev.ok !== false || prev.error !== e.message) changed = true;
  }
}
const lastWrite = old.checkedAt ? (Date.now() - new Date(old.checkedAt)) / 36e5 : 1e9;
if (changed || lastWrite >= HEARTBEAT_H) {
  fs.mkdirSync('watch', { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log('Zapsáno do', OUT);
} else console.log('Bez změny, nic nezapisuji.');
