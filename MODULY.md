# Life Admin – jak přidat další aplikaci

Life Admin je „rozcestník“: hlavní stránka (`index.html`) s navigací, společným
přehledem a zálohou, a v ní vložené samostatné aplikace. Každá aplikace je
**jeden soubor HTML v hlavní složce** a funguje i sama o sobě.

Tenhle soubor je návod pro tebe i pro Clauda (nebo jiného vývojáře) – stačí ho
přiložit a říct „přidej do Life Admin aplikaci na …“.

## Soubory v repozitáři (vše v jedné složce)

```
index.html        ← hlavní aplikace (navigace, „Co hoří“, společná záloha, verze)
doklady.html      ← Hlídač dokladů
predplatne.html   ← Předplatné a platby
bilkoviny.html    ← Cena bílkovin
meny.html         ← Měny a směnárna
auto.html         ← Auto (servis, pneu, tankování)
udrzba.html       ← Údržba domácnosti
prevence.html     ← Prevence (prohlídky, očkování)
navody.html       ← Návody (postupy, tabulky, poznámky; Údržba z nich čte)
manifest.json     ← název a ikona pro instalaci
sw.js             ← offline režim
icon-192.png, icon-512.png
MODULY.md         ← tento návod
```

Aktualizace = na GitHubu **Add file → Upload files**, přetáhnout změněné soubory
(klidně všechny najednou) a **Commit changes**.

## Pravidla pro aplikaci (modul)

1. **Soubor:** `<id>.html` v hlavní složce – HTML + CSS + JS v jednom souboru.
   `<id>` je krátký název bez diakritiky a mezer, např. `auto`, `zdravi`.

2. **Verze:** v kódu `const APP_VERSION='RRRR.MM.DD';` – **při každé úpravě změnit**.
   Zobrazit nenápadně (v menu ☰ nebo v patičce) a poslat v souhrnu (`ver`).

3. **Data:** do `localStorage` jen pod klíči začínajícími `<id>.`
   (např. `auto.items.v1`, `auto.settings.v1`, `auto.lastBackup`).
   Společná záloha je pak najde sama. Aplikace bez dat (kalkulačky) nic neukládají.

4. **Souhrn pro přehled:** po každém vykreslení zapsat do `lifeadmin.summary.<id>`:

   ```json
   {
     "v": 1,
     "ver": "2026.11.07",
     "updated": "2026-11-07T09:00:00.000Z",
     "count": 12,
     "desc": "nepovinný krátký popis pod kartou",
     "headline": [ { "label": "Měsíčně", "value": "8 232 Kč" } ],
     "alerts": [
       { "level": "red", "title": "Končí STK: Volvo", "sub": "za 5 dní", "date": "2026-11-12" }
     ]
   }
   ```

   - `headline` – max. 3 hlavní čísla na kartu aplikace (text, už naformátovaný)
   - `alerts` – co hoří; `level` je `red` (naléhavé), `orange` (brzy) nebo `info`;
     `date` ve tvaru RRRR-MM-DD (přehled z něj sám spočítá „za 3 dny“)
   - potom: `parent.postMessage({type:'lifeadmin:summary', id:'<id>'}, location.origin)`

5. **Vložený režim:** zjistit `window.self !== window.top`. Pokud ano:
   přidat `<body>` třídu `embedded` a schovat vlastní velký nadpis,
   neregistrovat service worker a neukazovat „Nainstalovat“.

6. **Funkce `render()`** globální (Life Admin ji volá po společné záloze).

7. **Vzhled:** stejné barevné proměnné, písmo a ovládání (menu ☰ vpravo nahoře,
   na mobilu plovoucí + vpravo dole, karty klepnutím otevřou úpravu, tmavý režim).
   Vzor: `predplatne.html` (aplikace s daty), `meny.html` (kalkulačka).

## Viditelnost aplikací

Každý si na Přehledu v „Aplikace → ⚙️ Upravit“ (nebo na mobilu v „⋯ Další“) zapne
jen aplikace, které používá, a určí jejich pořadí. Uloženo v `lifeadmin.settings.v1`
(`{hidden:[…], order:[…]}`). Skrytá aplikace se nenačítá, nemá upozornění v „Co hoří“,
ale její data zůstávají a jsou i ve společné záloze.
Na mobilu se do spodní lišty vejde Přehled + 3 aplikace, ostatní jsou pod „⋯ Další“.

## Spolupráce mezi aplikacemi

- Aplikace může číst data jiné aplikace (stejná doména) – např. Auto ukazuje STK z Dokladů.
- Když aplikace **změní** data jiné aplikace, pošle
  `parent.postMessage({type:'lifeadmin:reload', id:'<id té druhé>'}, location.origin)`
  a Life Admin tu druhou znovu načte.

## Registrace nové aplikace

1. **`index.html`** – do pole `APPS` přidat řádek a zvýšit `VERSION`:
   ```js
   {id:'auto', name:'Auto', full:'Auto a servis', icon:'🚗', path:'auto.html', prefix:'auto.', backupKey:'auto.lastBackup'},
   ```
   `name` = krátký popisek do navigace (na mobilu max. ~9 znaků).
   Nová aplikace je viditelná automaticky; uživatel ji může skrýt.
2. **`sw.js`** – do `ASSETS` přidat `'./auto.html'` a zvýšit verzi
   (`'lifeadmin-v5'` → `'lifeadmin-v6'`).
3. **Nahrát** nový soubor + upravené `index.html` a `sw.js`.

Data stávajících aplikací se tím nijak nezmění.

## Společná záloha

Soubor `life-admin-zaloha-RRRR-MM-DD.json`:

```json
{ "app": "life-admin", "version": 1, "exportedAt": "…", "apps": ["doklady","predplatne", "…"],
  "data": { "doklady.items.v1": "…", "predplatne.items.v1": "…", "predplatne.settings.v1": "…" } }
```

Obsahuje všechny klíče všech registrovaných aplikací (podle `prefix`).
Při načtení se data dotčených aplikací **nahradí** daty ze zálohy.
Doklady a Platby mají navíc dál vlastní zálohu v menu ☰.
