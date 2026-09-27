// Eisen-Minimum nicht erreichbar (seit 3.13.6): Kommt Eisen nur aus einem Volldünger mit viel Ammonium, darf die
// Eisen-Vorgabe das Rezept nicht kippen (Faktor k bricht ein, Bittersalz fällt weg, Ammonium über der Grenze).
const { D, K } = require('./laden');

let n = 0, fehler = 0;
function pruefe(ok, text) { n++; if (!ok) { fehler++; console.log('FEHLER: ' + text); } }

// Nachgestellt aus einem Probedurchgang: hartes Wasser, Phosphorsäure, Soft Elite ohne Basis 3
const d = JSON.parse(JSON.stringify(D));
d.wasser = { ecGemessen: 0.55, pH: 7.6, alkalitaet: 2.5, NO3: 0, NH4: 0, P: 0, K: 0, Ca: 80, Mg: 12, S: 25 * 32.06 / 96.06, Na: 0, Cl: 0 };
d.saeure = { typ: 'phosphor', konz: 85, zielPH: 5.8 };
const ids = ['soft_elite', 'calcinit', 'kno3', 'mkp', 'bittersalz'];
const vorrat = {}, auswahl = {};
for (const s of d.salze) { vorrat[s.id] = ids.includes(s.id); auswahl[s.id] = ids.includes(s.id); }
const r = K.rezept(d, { phase: 'wachstum', liter: 24.7, ecZiel: 1.35, vorrat, auswahl });

pruefe(r.faktorK > 0.3, `Faktor k ${r.faktorK.toFixed(2)} eingebrochen`);
pruefe(r.mengen.some(m => m.id === 'bittersalz'), 'Bittersalz fehlt, obwohl vorrätig');
pruefe(r.ist.Mg >= 18, `Mg nur ${r.ist.Mg.toFixed(0)} mg/L`);
pruefe(r.ist.NH4anteil <= 0.18, `Ammonium ${(r.ist.NH4anteil * 100).toFixed(0)} %`);
pruefe(Math.abs(r.ec.gesamt - 1.35) <= 0.15, `EC ${r.ec.gesamt.toFixed(2)} statt 1,35`);
pruefe(r.hinweise.some(h => /reicht das Eisen nicht/.test(h)), 'Hinweis zum Eisen fehlt');

// Mit Basis 3 ist das Eisen erreichbar: dann bleibt alles beim Alten (kein Lockern, kein Hinweis)
const mitB3 = K.rezept(JSON.parse(JSON.stringify(D)), { phase: 'wachstum', liter: 20, ecZiel: 1.4 });
pruefe(!mitB3.hinweise.some(h => /reicht das Eisen nicht/.test(h)), 'Standard-Satz: kein Eisen-Hinweis');

console.log(`${n} Prüfungen, ${fehler} Fehler.`);
if (fehler) process.exit(1);
