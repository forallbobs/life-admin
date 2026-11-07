# Life Admin – jak přidat další aplikaci

Life Admin je „rozcestník“: hlavní stránka (`index.html`) s navigací a společným
přehledem a v ní vložené samostatné aplikace ze složky `apps/`.
Každá aplikace je jeden soubor HTML a funguje i sama o sobě.

Tenhle soubor je návod pro tebe i pro Clauda (nebo jiného vývojáře) – stačí ho
přiložit a říct „přidej do Life Admin aplikaci na …“.

## Struktura repozitáře

```
life-admin/
├── index.html          ← hlavní aplikace (navigace, přehled „Co hoří“, společná záloha)
├── manifest.json       ← název a ikona pro instalaci
├── sw.js               ← offline režim
├── icon-192.png, icon-512.png
├── MODULY.md           ← tento návod
└── apps/
    ├── doklady/index.html      ← Hlídač dokladů
    └── predplatne/index.html   ← Předplatné a platby
```

## Pravidla pro aplikaci (modul)

1. **Umístění:** `apps/<id>/index.html` – jeden soubor (HTML + CSS + JS).
   `<id>` je krátký název bez diakritiky a mezer, např. `auto`, `zdravi`, `revize`.

2. **Data:** ukládá do `localStorage` jen pod klíči začínajícími `<id>.`
   (např. `auto.items.v1`, `auto.settings.v1`, `auto.lastBackup`).
   Díky tomu je umí společná záloha najít a zálohovat bez další práce.

3. **Souhrn pro přehled:** po každém vykreslení zapíše do klíče
   `lifeadmin.summary.<id>` tento JSON:

   ```json
   {
     "v": 1,
     "updated": "2026-11-07T09:00:00.000Z",
     "count": 12,
     "headline": [ { "label": "Měsíčně", "value": "8 232 Kč" } ],
     "alerts": [
       { "level": "red", "title": "Končí STK: Volvo", "sub": "za 5 dní", "date": "2026-11-12" }
     ]
   }
   ```

   - `headline` – max. 3 hlavní čísla na kartu aplikace (jako text, už naformátovaná)
   - `alerts` – co hoří; `level` je `red` (naléhavé), `orange` (brzy) nebo `info`
   - `date` – datum ve tvaru RRRR-MM-DD (přehled z něj sám spočítá „za 3 dny“)
   - pak pošle rodiči zprávu, ať se přehled překreslí:
     `parent.postMessage({type:'lifeadmin:summary', id:'<id>'}, location.origin)`

4. **Vložený režim:** zjistí, jestli běží uvnitř Life Admin
   (`window.self !== window.top`). Pokud ano:
   - přidá `<body>` třídu `embedded` a schová vlastní velký nadpis,
   - neregistruje vlastní service worker a neukazuje tlačítko „Nainstalovat“.

5. **Funkce `render()`** má být globální (Life Admin ji zavolá po společné záloze,
   aby se aktualizovala informace o poslední záloze).

6. **Vzhled:** stejné barevné proměnné, písmo a ovládání jako ostatní aplikace
   (menu ☰ vpravo nahoře, na mobilu plovoucí tlačítko + vpravo dole, tmavý režim).
   Jako vzor poslouží `apps/predplatne/index.html`.

## Registrace nové aplikace (3 místa)

1. **`index.html`** – do pole `APPS` přidat řádek:
   ```js
   {id:'auto', name:'Auto', full:'Auto a servis', icon:'🚗', path:'apps/auto/index.html', prefix:'auto.', backupKey:'auto.lastBackup'},
   ```
   `name` je krátký popisek do navigace (na mobilu max. ~8 znaků), `full` celý název.
   Do navigace se vejde zhruba 5 aplikací + Přehled.
2. **`sw.js`** – do `ASSETS` přidat `'./apps/auto/index.html'` a zvýšit verzi
   (`'lifeadmin-v1'` → `'lifeadmin-v2'`).
3. **Nahrát** na GitHub novou složku `apps/auto/` a upravené `index.html` a `sw.js`.

Data stávajících aplikací se tím nijak nezmění.

## Společná záloha

Soubor `life-admin-zaloha-RRRR-MM-DD.json`:

```json
{ "app": "life-admin", "version": 1, "exportedAt": "…", "apps": ["doklady","predplatne"],
  "data": { "doklady.items.v1": "…", "predplatne.items.v1": "…", "predplatne.settings.v1": "…" } }
```

Obsahuje všechny klíče všech registrovaných aplikací (podle `prefix`).
Při načtení se data dotčených aplikací **nahradí** daty ze zálohy.
Každá aplikace má navíc dál vlastní zálohu v menu ☰.
