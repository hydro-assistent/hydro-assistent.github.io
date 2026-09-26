// Lädt Stammdaten und Rechenkern direkt aus index.html, damit die Tests genau den ausgelieferten Code prüfen.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const skripte = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
function lade(merkmal) {
  const code = skripte.find(s => s.includes(merkmal));
  if (!code) throw new Error('Skript nicht gefunden: ' + merkmal);
  const modul = { exports: {} };
  vm.runInNewContext(code, { module: modul, Math, Object, Array, Number, JSON, Error });
  return modul.exports;
}
module.exports = { D: lade('const DATEN'), K: lade('const KERN') };
