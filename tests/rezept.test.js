// Prüft alle Kombinationen aus Phase, Sorte und Stärke mit den Standard-Stammdaten.
// Aufruf: node tests/rezept.test.js
const { D, K } = require('./laden');
const MAKRO = ['N', 'P', 'K', 'Ca', 'Mg', 'S'];
const liter = K.liter(D.eimer, D.eimer.zielFuell);
let fehler = 0, faelle = 0;
const pruefe = (ok, text) => { if (!ok) { fehler++; console.log('FEHLER ' + text); } };

for (const phase of Object.keys(D.phasen)) for (const typ of ['photo', 'auto']) for (const st of Object.keys(D.staerke)) {
  faelle++;
  const name = `${phase}/${typ}/${st}`;
  const ecZiel = K.zielEC(D, phase, typ, st);
  const r = K.rezept(D, { phase, liter, ecZiel });
  const sa = K.saeure(D.wasser, D.saeure, D.kalibrierung);
  const ecFrei = ecZiel - D.wasser.ecGemessen - D.kalibrierung.ecProMmolSaeure * sa.mmol; // was für Salze übrig bleibt
  const feMin = Math.min(0.8, Math.max(0.25, 0.5 * (ecZiel - D.wasser.ecGemessen)));

  for (const e of MAKRO) pruefe(Number.isFinite(r.ist[e]) && r.ist[e] >= 0, `${name}: ${e} ungültig`);
  pruefe(r.mengen.every(m => m.gramm >= 0), `${name}: negative Menge`);
  if (ecFrei < 0.1) { pruefe(r.hinweise.some(h => /nicht erreichbar|nur .* für Nährstoffe/.test(h)), `${name}: Warnung zur zu kleinen Ziel-EC fehlt`); continue; }
  pruefe(Math.abs(r.ec.gesamt - ecZiel) < 0.02, `${name}: EC ${r.ec.gesamt.toFixed(3)} statt ${ecZiel}`);
  pruefe(r.ist.NH4anteil <= 0.155, `${name}: Ammonium-Anteil ${(r.ist.NH4anteil * 100).toFixed(1)} %`);
  pruefe(r.ist.Fe >= feMin * 0.95, `${name}: Eisen ${r.ist.Fe.toFixed(2)} unter Minimum ${feMin.toFixed(2)}`);
  // Der Faktor k darf nicht an die Untergrenze kippen (Soll würde absurd klein)
  pruefe(r.faktorK > 0.15, `${name}: Faktor k ${r.faktorK.toFixed(3)} zu klein`);
}

// Regression: Bei Ziel-EC 0,98 im Wachstum wurde früher nur Soft Elite gewählt (Ammonium 19 %, Eisen 0,10, Mg 4 mg/L)
{
  const r = K.rezept(D, { phase: 'wachstum', liter, ecZiel: 0.98 });
  pruefe(r.mengen.some(m => m.id === 'basis3'), 'Regression EC 0,98: Basis 3 fehlt');
  pruefe(r.ist.Mg > 10, `Regression EC 0,98: Mg nur ${r.ist.Mg.toFixed(1)} mg/L`);
}

console.log(`${faelle} Fälle geprüft, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
