// Prüft vor jeder neuen Fassung: Cache-Name in sw.js passt zur letzten „Fassung X.Y.Z“ in LIESMICH.md,
// und alle Dateien, die der Service Worker vorab speichert, gibt es wirklich.
// Aufruf: node tests/fassung.test.js
const fs = require('fs'), path = require('path');
const wurzel = path.join(__dirname, '..');
const sw = fs.readFileSync(path.join(wurzel, 'sw.js'), 'utf8');
const liesmich = fs.readFileSync(path.join(wurzel, 'LIESMICH.md'), 'utf8');
let fehler = 0, pruefungen = 0;
const wahr = (ok, text) => { pruefungen++; if (!ok) { fehler++; console.log('FEHLER ' + text); } };

const version = (sw.match(/const VERSION = 'hydro-(\d+\.\d+\.\d+)'/) || [])[1];
const fassungen = [...liesmich.matchAll(/^Fassung (\d+\.\d+\.\d+):/gm)].map(m => m[1]);
const zahl = v => v.split('.').map(Number).reduce((a, x) => a * 1000 + x, 0);
const neueste = fassungen.slice().sort((a, b) => zahl(b) - zahl(a))[0];
wahr(!!version, 'VERSION in sw.js nicht gefunden');
wahr(!!neueste, 'Keine „Fassung X.Y.Z:“ in LIESMICH.md gefunden');
wahr(version === neueste, `sw.js hat hydro-${version}, LIESMICH.md nennt als neueste Fassung ${neueste} (VERSION erhöhen, sonst kommt das Update nicht aufs Handy)`);

const dateien = JSON.parse((sw.match(/const DATEIEN = (\[[^\]]*\])/) || [, '[]'])[1].replace(/'/g, '"'));
wahr(dateien.length > 0, 'DATEIEN in sw.js nicht gefunden');
for (const d of dateien) if (d !== './') wahr(fs.existsSync(path.join(wurzel, d)), `sw.js speichert ${d}, die Datei fehlt`);

console.log(`${pruefungen} Prüfungen, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
