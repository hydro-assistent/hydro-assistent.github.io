// Eingebaute Salze (seit 3.13.15): Peters Hydro-Sol 5-11-26 als zusätzlicher Volldünger, Markennamen bei Einzelsalzen.
const { D, K } = require('./laden');

let n = 0, fehler = 0;
function pruefe(ok, text) { n++; if (!ok) { fehler++; console.log('FEHLER: ' + text); } }
const P_AUS_P2O5 = 2 * 30.974 / 141.945, K_AUS_K2O = 2 * 39.098 / 94.196;

// Etikett Peters 5-11-26: P2O5 11 %, K2O 26 % → als Element
const p = D.salze.find(s => s.id === 'peters51126');
pruefe(!!p, 'Peters fehlt');
pruefe(Math.abs(p.P - 11 * P_AUS_P2O5) < 0.01 && Math.abs(p.K - 26 * K_AUS_K2O) < 0.01, `Peters P/K falsch umgerechnet: ${p.P}, ${p.K}`);
pruefe(p.NO3 === 5 && p.NH4 === 0 && p.Ca === 0 && p.Fe === 0.3 && p.B === 0.05, 'Peters Etikettwerte');
pruefe(p.aktiv === false && p.gruppe === 'volldünger', 'Peters: zum Einschalten, Gruppe Volldünger');
pruefe(D.reihenfolge.includes('peters51126') && D.reihenfolge.indexOf('peters51126') < D.reihenfolge.indexOf('calcinit'), 'Peters vor Calcinit in der Mischreihenfolge');

// Etikett Combi Sol 6-18-36 + 3 MgO: P2O5 18 %, K2O 36 %, MgO 3 %, nur Nitrat
const c = D.salze.find(s => s.id === 'combisol');
pruefe(!!c && Math.abs(c.P - 18 * P_AUS_P2O5) < 0.01 && Math.abs(c.K - 36 * K_AUS_K2O) < 0.01 && Math.abs(c.Mg - 3 * 24.305 / 40.304) < 0.01, 'Combi Sol Etikettwerte');
pruefe(c.NO3 === 6 && c.NH4 === 0 && c.aktiv === false && c.gruppe === 'volldünger', 'Combi Sol: nur Nitrat, zum Einschalten');
// Keine harnstoffhaltigen Dünger eingebaut: der Rechenkern kennt nur Nitrat und Ammonium
pruefe(!D.salze.some(s => /Allrounder|Hi-Nitro|Grow-Mix|Foliar|Plant Starter/.test(s.name)), 'keine Harnstoff-Dünger');

// Kein Salz bringt mehr als 100 % Nährstoffe als Element mit
for (const s of D.salze) {
  const summe = ['NO3', 'NH4', 'P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Zn', 'Cu', 'B', 'Mo'].reduce((a, k) => a + (s[k] || 0), 0);
  pruefe(summe > 0 && summe < 100, `${s.name}: Summe ${summe.toFixed(1)} %`);
}

// Typische A/B-Kombination: Peters-Volldünger + Calcinit + Bittersalz + Kaliumnitrat
for (const [phase, typ, vd] of [['wachstum', 'salpeter', 'peters51126'], ['bluete', 'phosphor', 'peters51126'], ['wachstum', 'salpeter', 'combisol'], ['bluete', 'phosphor', 'combisol']]) {
  const d = JSON.parse(JSON.stringify(D));
  d.saeure = typ === 'salpeter' ? { typ, konz: 38, zielPH: 5.8 } : { typ, konz: 85, zielPH: 5.8 };
  const ids = [vd, 'calcinit', 'bittersalz', 'kno3'], vorrat = {}, auswahl = {};
  for (const s of d.salze) { vorrat[s.id] = ids.includes(s.id); auswahl[s.id] = ids.includes(s.id); }
  const ec = K.zielEC(d, phase, 'photo', 'normal');
  const r = K.rezept(d, { phase, liter: 24.7, ecZiel: ec, vorrat, auswahl });
  pruefe(Math.abs(r.ec.gesamt - ec) <= 0.15, `${phase}: EC ${r.ec.gesamt.toFixed(2)} statt ${ec}`);
  pruefe(r.mengen.some(m => m.id === vd) && r.mengen.some(m => m.id === 'calcinit'), `${phase} ${vd}: Volldünger und Calcinit eingeplant`);
  pruefe(r.ist.Fe >= 0.8 && r.ist.Fe <= 3, `${phase}: Eisen ${r.ist.Fe.toFixed(2)}`);
  pruefe(!r.hinweise.some(h => /^Bor nur|reicht das Eisen nicht/.test(h)), `${phase}: Volldünger bringt genug Bor und Eisen`);
  pruefe(r.ist.NH4anteil <= 0.15, `${phase}: Ammonium ${(r.ist.NH4anteil * 100).toFixed(0)} %`);
}

console.log(`${n} Prüfungen, ${fehler} Fehler.`);
if (fehler) process.exit(1);
