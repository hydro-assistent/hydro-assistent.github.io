# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekt

Hydro-Assistent (HydroAPP): offlinefähige PWA auf Deutsch – Nährlösungs-Rechner und Tagebuch für Hydroponik-Tanks. Kein Build, keine Abhängigkeiten, kein Server: alle Daten bleiben im Browser. Ausgeliefert wird der Ordner so, wie er ist, über GitHub Pages aus `main` (https://hydro-assistent.github.io/). Netlify wird nicht mehr genutzt.

Sprache: Code-Bezeichner, Kommentare, UI-Texte, Commit-Nachrichten und LIESMICH sind durchgehend Deutsch (z. B. `rezept`, `saeure`, `eimer`, `speichern`). So beibehalten.

## Befehle

```sh
node tests/rezept.test.js      # alle Phasen × Sorte (photo/auto) × Stärke, plus Regressionen
node tests/schwefel.test.js    # Schwefelsäure-Zweig, Erwartungswerte unabhängig nachgerechnet
node tests/saeure.test.js      # Wahl der Säure je Phase (saeureWahl)
node tests/sparsam.test.js     # Rezept „Sparsam“ (DATEN.sparsam) und topUp mit nachfuellen: 'verbrauch'
node tests/eisen.test.js       # Eisen-Minimum nicht erreichbar: Vorgabe wird gelockert (FE_LOCKERN), Rezept kippt nicht
node tests/salze.test.js       # eingebaute Salze: Etikett-Umrechnung, jeder Volldünger im A/B-Rezept mit Calcinit
node tests/fassung.test.js     # VERSION in sw.js = neueste „Fassung“ in LIESMICH.md, DATEIEN vorhanden
node tests/kern.test.js        # Golden-Master: 13 feste Rezepte, topUp, zielEC, liter gegen tests/kern.erwartet.json
node tests/kern.test.js --neu  # erwartete Werte neu schreiben – nur bei gewollter Rechenänderung, Diff prüfen
python3 tests/vergleich_optimum.py   # App gegen unabhängige scipy-Optimierung (braucht numpy, scipy, node)
HYDRO_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tests/oberflaeche.ui.js   # Rundgang im Browser (Playwright): Einrichtung, Mischanleitung, Eisen-Lösung, Escaping, Import
```

Kein Test-Framework und keine Abhängigkeiten: jede Datei ist ein eigenständiges Skript, gibt „N Fälle/Prüfungen, M Fehler.“ aus und endet bei Fehlern mit Exit-Code 1. Ausnahme `kern.test.js`, das das eingebaute `node:test` nutzt (`node --test-name-pattern "Blüte" tests/kern.test.js` für einzelne Fälle). Die übrigen Tests prüfen Eigenschaften (EC getroffen, Ammonium-Grenze …) und merken verschobene Gramm-Mengen nicht; das tut nur `kern.test.js`. Ändert sich eine Rechnung gewollt, `--neu` laufen lassen und die Änderung in `kern.erwartet.json` im Commit begründen. Einen einzelnen Fall prüft man, indem man die jeweilige Datei ausführt oder in einem Einzeiler `require('./tests/laden')` nutzt und `K.rezept(D, {...})` direkt aufruft.

GitHub Actions (`.github/workflows/tests.yml`) läuft bei jedem Pull Request und Push auf `main`: Job `tests` führt jede Datei `tests/*.test.js` aus (neue Tests laufen automatisch mit), Job `vergleich` den Python-Vergleich, Job `oberflaeche` den Browser-Rundgang `tests/oberflaeche.ui.js` (Playwright nur in CI installiert; die Datei heißt bewusst nicht `*.test.js`, damit der Node-Job sie nicht ohne Browser startet). Ohne lokales Playwright-Paket nimmt der Rundgang das globale; `HYDRO_CHROMIUM` setzt den Browser-Pfad.

Lokal ansehen: irgendein statischer Server im Wurzelverzeichnis (z. B. `python3 -m http.server`). Der Service Worker wird nur unter `https:` registriert, lokal läuft die App also ohne Cache.

## Aufbau

Die ganze App steckt in **`index.html`** (~2930 Zeilen): ein `<style>`-Block und vier aufeinanderfolgende `<script>`-Blöcke ohne Module/Bundler:

1. **Stammdaten** – `const DATEN` (Salze mit Gehalten in % Element, P/K schon aus P₂O₅/K₂O umgerechnet; Phasenprofile, Stärken, Säuren, `kalibrierung`, Beispielwasser nur für Tests/alte Stände). Export als `window.HYDRO_DATEN`.
2. **Rechenkern** – `const KERN = { saeureWahl, saeurenDa, saeureKonz, liter, saeure, wasserglasProMl, ecSchaetzung, zugabe, rezept, vollansatz, topUp, zielEC, runden }`. Reine Funktionen ohne DOM; `rezept()` ist der Solver (Salzmengen + Faktor k auf Ziel-EC, mit Ammonium-Grenze ≤ 15 % und Eisen-Minimum). Ist das Eisen-Minimum mit den vorrätigen Salzen nicht erreichbar (Fe < 0,8 × Minimum), rechnet `rezept()` mit gelockerter Vorgabe (`FE_LOCKERN` = 1, ½, ¼, 0) neu und nimmt das Ergebnis mit der besten Form + Ammonium- + Eisenbewertung (seit 3.13.6); Stufen mit k unter der Hälfte des besten k scheiden vorher aus (seit 3.13.9). Seit 3.13.16 wird auch gelockert, wenn Eisen knapp erreicht ist, die Ammonium-Grenze reißt und k unter `FE_TEUER` (75 %) des k ohne Eisen-Vorgabe liegt (schnelle Vergleichsrechnung `loese(salze, true, 0)`); dann gilt dieselbe 75-%-Schwelle bei der Auswahl. Ist ein Salz mit `eisenLsg` vorrätig (Eisen-Lösung, seit 3.13.16), gilt `feMin` mindestens `FE_MIT_LOESUNG` (1 mg/L). Der Solver rechnet je Koordinate inkrementell (Rest-Summe einmal, dann nur das eine Salz; seit 3.13.17), die Zielfunktion ist unverändert. Die Paar-Suche bei der Volldünger-Wahl bleibt vollständig: Ein Ranking nach Einzelwerten verfehlt gute Partner (Soft Elite allein schwach, mit Peters die beste Wahl). Ammonium-Anteil immer über `nh4Anteil()` (0 statt NaN ohne Stickstoff). Phosphorsäure-Dichte aus `DICHTE_H3PO4` (freie Konzentration). Export als `window.HydroKern`.
   - Säure je Phase (seit 3.12): `saeureWahl(s, phase)` nimmt nach `SAEURE_VORRANG` die erste vorrätige Säure (Anzucht/Wachstum Salpeter, Blüte/Reife Phosphor, Schwefel zuletzt). Neues Format `s.vorrat` + `konzPhosphor`/`konzSalpeter`/`konzSchwefel`; alte Stände mit nur `typ`/`konz` gelten als eine vorrätige Säure. Salze mit `nurMitSalpeter` (Kaliumcarbonat) werden nur mit Salpetersäure verplant. Dritter Parameter `wenigP` (Rezept „Sparsam“): Vorrang wie im Wachstum, also Salpetersäure vor Phosphorsäure.
   - Zusatzwege seit 3.13, die bisherige Rechnung bleibt unberührt: `rezept(…, { rezeptSparsam })` nimmt das Verhältnis `DATEN.sparsam` = Cannabis-Lösung aus „Utah Hydroponic Solutions“, in der Blüte stattdessen `phasen.bluete.profilSparsam` = Versuchslösung EC 2 / P 15 (Hershkowitz et al. 2025, Supplementary Table 1) (nicht in der Reife); `rezept().hinweise` meldet knappes Bor/Zink gegen dieselbe Lösung (`SPUREN_REF`), ohne die Mengen zu ändern; `topUp(…, { nachfuellen: 'verbrauch' })` füllt immer mit Ziel-EC nach und gibt erst über 1,25 × Ziel-EC reines Wasser. In der UI: `e.rezept === 'sparsam'` je Tank, `Z.einst.nachfuellen` (`'ec'`/`'verbrauch'`).
   - In der Oberfläche stehen keine Forschernamen; Quellen nur als Kommentar im Code.
3. **Pflanzendoktor** – `const DOKTOR` (Symptome/Probleme), Export als `window.HydroDoktor`.
4. **UI** – IIFE mit Zustand `Z`, `render()`, allen Ansichten, Einrichtung, Sicherung.

Die ersten drei Blöcke enden jeweils mit `if (typeof module !== 'undefined') module.exports = …; else root.… = …`. **`tests/laden.js` zieht die Skripte per Regex (`<script>…</script>`) aus `index.html` und führt die Blöcke, die `const DATEN` bzw. `const KERN` enthalten, in einer `vm`-Sandbox aus** – die Tests prüfen also genau den ausgelieferten Code. Folgen daraus:
- Diese Blöcke müssen plain `<script>` ohne Attribute bleiben und die Merkmale `const DATEN` / `const KERN` behalten.
- DATEN und KERN dürfen weder DOM noch Browser-APIs nutzen; die Sandbox stellt nur `Math, Object, Array, Number, JSON, Error` bereit.
- `tests/vergleich_optimum.py` spiegelt Gewichte und Zielfunktion von `ziel()` im Solver nach. Wer die Zielfunktion in KERN ändert, muss das Python-Modell mitziehen. Es rechnet mit der festen `DATEN.saeure` (Phosphorsäure), nicht mit der Säure je Phase.

### Zustand und Speicher

- Hauptzustand als JSON in `localStorage` unter `hydro-zustand-v1`; Fotos in IndexedDB `hydro-fotos`. Sicherung = JSON-Export/Import von `Z`.
- `standard()` liefert den Grundzustand, `pruefe(d)` normalisiert jeden geladenen Stand (auch Importe) und prüft seit 3.13.17 alle Zahlen gegen dieselben Grenzen wie die Eingabe (`wasserSauber`, `saeureSauber`, `behSauber`, `salzSauber`, `wgSauber`, Phase/Sorte/Stärke). Fehlen danach Pflicht-Wasserwerte oder eine Säure, gilt `setup: false` und `pruefen: 'werte'` (Hinweis in der Einrichtung) und enthält die Migrationen alter Fassungen (`version`, `profil`/`pruefen` für den Umstieg auf 3.10). Neue Felder immer in beiden Funktionen ergänzen, damit alte Stände und Sicherungen weiter laden.
- Wasserwerte werden wie im Wasserbericht eingetragen (Nitrat, Sulfat, Ammonium als NH₄, Phosphat als PO₄) und beim Speichern in N, S bzw. P umgerechnet; im Rechenkern stehen `NO3`/`NH4` als N, `P`, `S`. `Na`/`Cl` werden nur für Warnungen genutzt (> 50 bzw. > 100 mg/L).
- Tankmaße: `Z.einst.behaelter` gilt für alle Tanks, ein Tank mit `e.behaelter` hat eigene Maße (seit 3.13.10). Immer über `beh(e)` bzw. `daten(e)` lesen, nie direkt `Z.einst.behaelter`; Eingabefelder eines Tanks tragen `data-feld="b<i>:<feld>"`.
- Eingebaute Salze tragen optional `marken` (Markenprodukte desselben Stoffs, nur in den Salzlisten angezeigt). Neue Markenprodukte nur mit belegten Etikettwerten aufnehmen. Volldünger (`gruppe: 'volldünger'`) nur ohne Harnstoff (die HydroBuddy-Datenbank zählt Harnstoff zum NH4, deshalb Stickstoff-Formen beim Hersteller prüfen) und mit den Werten der deutschen Packung (Kristalon, Poly-Feed gibt es je Land verschieden). Zuschaltbare Volldünger (`aktiv: false`) stehen in der UI unter „Weitere Volldünger“ (`weitererVD`).
- Eisen-Lösung `eisen` (`eisenLsg`, `loesungGProL`): Eisenchelat als Stammlösung, `rezept().mengen` trägt dafür `ml`; Salze mit `loesungGProL` fallen nicht unter „winzige Mengen“. Chelat, % Fe und g/L stehen in `Z.einst.eisen` (`eisenSauber`), `daten()` überträgt sie auf das Salz.
- Eigene Salze liegen in `Z.einst.eigeneSalze` und werden zur Laufzeit an `DATEN.salze`/`reihenfolge` angehängt; Calcium-Salze werden getrennt vorgelöst und zuletzt zugegeben (`calcium: true` in `rezept().mengen`).

- Angefangene Mischanleitung: `anlParken()` legt `UI.anl` samt Haken unter `hydro-anleitung-v1` ab (bei jedem Haken und beim Verlassen), `anlVergessen()` beim Speichern oder Start einer neuen; kein `confirm()` beim Verlassen (seit 3.13.12).
- Mess-Erinnerung je Phase: `MESS_TAKT` in Stunden (nie unter 24).

### Offline / Service Worker

`sw.js`: Netz zuerst mit 3 s Zeitlimit, dann Cache; Updates kommen im Hintergrund an. Cache-Name ist `VERSION = 'hydro-X.Y.Z'`.

## Neue Fassung

Bei jeder Veröffentlichung:
- `VERSION` in `sw.js` erhöhen (sonst holt sich das Handy die neue Version nicht). Kommen Dateien hinzu, auch `DATEIEN` ergänzen. `tests/fassung.test.js` prüft beides gegen `LIESMICH.md`.
- In `LIESMICH.md` einen Absatz „Fassung X.Y.Z: …“ in Alltagssprache anhängen (was man in der App merkt, nicht was im Code passiert).
- Commit-Nachrichten folgen dem Muster „Fassung X.Y.Z: kurze Zusammenfassung“.
- Bei Änderungen an Rechnungen: Tests laufen lassen; frühere Umbauten wurden gegen die Vorversion verglichen („Alle Rechnungen unverändert, 198 Vergleichsfälle geprüft“).

## Fachliche Leitplanken

- Die App rechnet nur mit den eigenen Wasserwerten der Nutzenden; Beispielwasser in DATEN ist nur für Tests und alte Stände.
- Säure-Hinweise (Sicherheit/Haftung) mit Pflicht-Bestätigung sind gewollt und erscheinen in Einrichtung, Anleitung und jeder Mischanleitung mit Säure – nicht entfernen.
- Die EC-Schätzung mit Schwefelsäure ist nicht an echten Mischungen geprüft; der Hinweis dazu wird in `rezept().hinweise` getestet.

## Vorgemerkt

- Spurenelement-Mischungen (Fetrilon Combi 1, Micromax Premium/WS, Microfol Combi, Excello Basis; Werte in der HydroBuddy-Datenbank `substances_win.dbf`) als Salze, die der Rechenkern gezielt für Fe/B/Zn einplant. Heute gibt es nur das Eisen-Minimum als Strafterm und Hinweise für B/Zn (`SPUREN_REF`); nötig wären Spurenziele im Solver und ein Spiegel in `tests/vergleich_optimum.py`.
- Peters No Phosphate Special 14-0-14+11CaO+3MgO: Werte nicht belegt, wartet auf ein Foto der Deklaration.
