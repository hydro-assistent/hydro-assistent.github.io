# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekt

Hydro-Assistent (HydroAPP): offlinefähige PWA auf Deutsch – Nährlösungs-Rechner und Tagebuch für Hydroponik-Tanks. Kein Build, keine Abhängigkeiten, kein Server: alle Daten bleiben im Browser. Ausgeliefert wird der Ordner so, wie er ist (laut LIESMICH per Drag-and-drop bei Netlify unter „Deploys“; das Repo heißt `*.github.io`, also ebenfalls GitHub Pages-tauglich).

Sprache: Code-Bezeichner, Kommentare, UI-Texte, Commit-Nachrichten und LIESMICH sind durchgehend Deutsch (z. B. `rezept`, `saeure`, `eimer`, `speichern`). So beibehalten.

## Befehle

```sh
node tests/rezept.test.js      # alle Phasen × Sorte (photo/auto) × Stärke, plus Regressionen
node tests/schwefel.test.js    # Schwefelsäure-Zweig, Erwartungswerte unabhängig nachgerechnet
python3 tests/vergleich_optimum.py   # App gegen unabhängige scipy-Optimierung (braucht numpy, scipy, node)
```

Kein Test-Framework: jede Datei ist ein eigenständiges Skript, gibt „N Fälle/Prüfungen, M Fehler.“ aus und endet bei Fehlern mit Exit-Code 1. Einen einzelnen Fall prüft man, indem man die jeweilige Datei ausführt oder in einem Einzeiler `require('./tests/laden')` nutzt und `K.rezept(D, {...})` direkt aufruft.

Lokal ansehen: irgendein statischer Server im Wurzelverzeichnis (z. B. `python3 -m http.server`). Der Service Worker wird nur unter `https:` registriert, lokal läuft die App also ohne Cache.

## Aufbau

Die ganze App steckt in **`index.html`** (~2900 Zeilen): ein `<style>`-Block und vier aufeinanderfolgende `<script>`-Blöcke ohne Module/Bundler:

1. **Stammdaten** – `const DATEN` (Salze mit Gehalten in % Element, P/K schon aus P₂O₅/K₂O umgerechnet; Phasenprofile, Stärken, Säuren, `kalibrierung`, Beispielwasser nur für Tests/alte Stände). Export als `window.HYDRO_DATEN`.
2. **Rechenkern** – `const KERN = { liter, saeure, wasserglasProMl, ecSchaetzung, zugabe, rezept, vollansatz, topUp, zielEC, runden }`. Reine Funktionen ohne DOM; `rezept()` ist der Solver (Salzmengen + Faktor k auf Ziel-EC, mit Ammonium-Grenze ≤ 15 % und Eisen-Minimum). Export als `window.HydroKern`.
3. **Pflanzendoktor** – `const DOKTOR` (Symptome/Probleme), Export als `window.HydroDoktor`.
4. **UI** – IIFE mit Zustand `Z`, `render()`, allen Ansichten, Einrichtung, Sicherung.

Die ersten drei Blöcke enden jeweils mit `if (typeof module !== 'undefined') module.exports = …; else root.… = …`. **`tests/laden.js` zieht die Skripte per Regex (`<script>…</script>`) aus `index.html` und führt die Blöcke, die `const DATEN` bzw. `const KERN` enthalten, in einer `vm`-Sandbox aus** – die Tests prüfen also genau den ausgelieferten Code. Folgen daraus:
- Diese Blöcke müssen plain `<script>` ohne Attribute bleiben und die Merkmale `const DATEN` / `const KERN` behalten.
- DATEN und KERN dürfen weder DOM noch Browser-APIs nutzen; die Sandbox stellt nur `Math, Object, Array, Number, JSON, Error` bereit.
- `tests/vergleich_optimum.py` spiegelt Gewichte und Zielfunktion von `ziel()` im Solver nach. Wer die Zielfunktion in KERN ändert, muss das Python-Modell mitziehen.

### Zustand und Speicher

- Hauptzustand als JSON in `localStorage` unter `hydro-zustand-v1`; Fotos in IndexedDB `hydro-fotos`. Sicherung = JSON-Export/Import von `Z`.
- `standard()` liefert den Grundzustand, `pruefe(d)` normalisiert jeden geladenen Stand (auch Importe) und enthält die Migrationen alter Fassungen (`version`, `profil`/`pruefen` für den Umstieg auf 3.10). Neue Felder immer in beiden Funktionen ergänzen, damit alte Stände und Sicherungen weiter laden.
- Eigene Salze liegen in `Z.einst.eigeneSalze` und werden zur Laufzeit an `DATEN.salze`/`reihenfolge` angehängt; Calcium-Salze werden getrennt vorgelöst und zuletzt zugegeben (`calcium: true` in `rezept().mengen`).

### Offline / Service Worker

`sw.js`: Netz zuerst mit 3 s Zeitlimit, dann Cache; Updates kommen im Hintergrund an. Cache-Name ist `VERSION = 'hydro-X.Y.Z'`.

## Neue Fassung

Bei jeder Veröffentlichung:
- `VERSION` in `sw.js` erhöhen (sonst holt sich das Handy die neue Version nicht). Kommen Dateien hinzu, auch `DATEIEN` ergänzen.
- In `LIESMICH.md` einen Absatz „Fassung X.Y.Z: …“ in Alltagssprache anhängen (was man in der App merkt, nicht was im Code passiert).
- Commit-Nachrichten folgen dem Muster „Fassung X.Y.Z: kurze Zusammenfassung“.
- Bei Änderungen an Rechnungen: Tests laufen lassen; frühere Umbauten wurden gegen die Vorversion verglichen („Alle Rechnungen unverändert, 198 Vergleichsfälle geprüft“).

## Fachliche Leitplanken

- Die App rechnet nur mit den eigenen Wasserwerten der Nutzenden; Beispielwasser in DATEN ist nur für Tests und alte Stände.
- Säure-Hinweise (Sicherheit/Haftung) mit Pflicht-Bestätigung sind gewollt und erscheinen in Einrichtung, Anleitung und jeder Mischanleitung mit Säure – nicht entfernen.
- Die EC-Schätzung mit Schwefelsäure ist nicht an echten Mischungen geprüft; der Hinweis dazu wird in `rezept().hinweise` getestet.
