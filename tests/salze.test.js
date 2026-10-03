// Eingebaute Salze (seit 3.13.15): Peters Hydro-Sol 5-11-26 als zusätzlicher Volldünger, Markennamen bei Einzelsalzen;
// seit 3.13.16 weitere harnstofffreie Volldünger (Hakaphos, Kristalon, Universol, Agrolution, Poly-Feed).
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

// Weitere harnstofffreie Volldünger (seit 3.13.16): Etikett → Element, zum Einschalten, vor Calcinit
const P_ = x => x * P_AUS_P2O5, K_ = x => x * K_AUS_K2O, MG_ = x => x * 24.305 / 40.304;
const etiketten = {
  basis2: [3, 0, 6, 40, 4], soft_novell: [7.6, 3.4, 11, 30, 3], soft_plus: [7.6, 6.4, 6, 24, 3], soft_ultra: [10, 8, 8, 18, 3],
  kristalon_rot: [10.1, 1.9, 12, 36, 1], kristalon_orange: [4.5, 1.5, 12, 36, 3], kristalon_braun: [3, 0, 11, 38, 4], kristalon_weiss: [11.3, 3.7, 5, 30, 3],
  universol_basis: [4, 0, 19, 35, 4.1], phlow114: [11, 0, 10, 40, 0], polka: [9.1, 0, 10, 38, 3], sonate: [11.2, 3.8, 5, 30, 3],
};
for (const [id, [no3, nh4, p2o5, k2o, mgo]] of Object.entries(etiketten)) {
  const s = D.salze.find(x => x.id === id);
  pruefe(!!s, `${id} fehlt`);
  if (!s) continue;
  pruefe(s.NO3 === no3 && s.NH4 === nh4, `${s.name}: Stickstoff-Formen`);
  pruefe(Math.abs(s.P - P_(p2o5)) < 0.01 && Math.abs(s.K - K_(k2o)) < 0.01 && Math.abs(s.Mg - MG_(mgo)) < 0.01, `${s.name}: P/K/Mg falsch umgerechnet`);
  pruefe(s.aktiv === false && s.gruppe === 'volldünger', `${s.name}: zum Einschalten, Gruppe Volldünger`);
  pruefe(D.reihenfolge.indexOf(id) >= 0 && D.reihenfolge.indexOf(id) < D.reihenfolge.indexOf('calcinit'), `${s.name}: vor Calcinit in der Mischreihenfolge`);
}

// Typische A/B-Kombination: Peters-Volldünger + Calcinit + Bittersalz + Kaliumnitrat
const faelle = [], genutzt = new Set();
for (const vd of ['peters51126', 'combisol'].concat(Object.keys(etiketten))) faelle.push(['wachstum', 'salpeter', vd], ['bluete', 'phosphor', vd]);
for (const [phase, typ, vd] of faelle) {
  const d = JSON.parse(JSON.stringify(D));
  d.saeure = typ === 'salpeter' ? { typ, konz: 38, zielPH: 5.8 } : { typ, konz: 85, zielPH: 5.8 };
  const ids = [vd, 'calcinit', 'bittersalz', 'kno3'], vorrat = {}, auswahl = {};
  for (const s of d.salze) { vorrat[s.id] = ids.includes(s.id); auswahl[s.id] = ids.includes(s.id); }
  const ec = K.zielEC(d, phase, 'photo', 'normal');
  const r = K.rezept(d, { phase, liter: 24.7, ecZiel: ec, vorrat, auswahl });
  pruefe(Math.abs(r.ec.gesamt - ec) <= 0.15, `${phase} ${vd}: EC ${r.ec.gesamt.toFixed(2)} statt ${ec}`);
  pruefe(r.mengen.some(m => m.id === 'calcinit'), `${phase} ${vd}: Calcinit eingeplant`);
  if (r.mengen.some(m => m.id === vd)) genutzt.add(vd);
  // Kein Einbruch: das Profil wird nicht von zu viel eisenarmem Volldünger verdrängt (seit 3.13.16)
  pruefe(r.faktorK > 0.35, `${phase} ${vd}: k ${r.faktorK.toFixed(2)} eingebrochen`);
  pruefe(r.ist.Mg >= 15, `${phase} ${vd}: Mg ${r.ist.Mg.toFixed(0)} mg/L`);
  // Peters bringt genug Eisen; die übrigen weniger, dann meldet die App das Eisen als knapp (ein Eisendünger fehlt im Regal)
  if (['peters51126', 'combisol'].includes(vd)) {
    pruefe(r.ist.Fe >= 0.8 && r.ist.Fe <= 3, `${phase} ${vd}: Eisen ${r.ist.Fe.toFixed(2)}`);
    pruefe(!r.hinweise.some(h => /reicht das Eisen nicht/.test(h)), `${phase} ${vd}: Volldünger bringt genug Eisen`);
    // Bor nur bei Hydro-Sol (0,05 % B); Combi Sol hat 0,02 % B und liegt an der Hinweisschwelle – „Bor knapp“ ist dort richtig
    if (vd === 'peters51126') pruefe(!r.hinweise.some(h => /^Bor nur/.test(h)), `${phase}: Hydro-Sol bringt genug Bor`);
  } else if (r.ist.Fe < 0.5) pruefe(r.hinweise.some(h => /Eisen/.test(h)), `${phase} ${vd}: Eisen ${r.ist.Fe.toFixed(2)} ohne Hinweis`);
  // Wie bei Soft Elite allein (eisen.test.js): knapp über der Grenze ist hinnehmbar, dann aber mit Hinweis
  pruefe(r.ist.NH4anteil <= 0.18, `${phase} ${vd}: Ammonium ${(r.ist.NH4anteil * 100).toFixed(0)} %`);
  if (r.ist.NH4anteil > 0.155) pruefe(r.hinweise.some(h => /Ammonium-Anteil/.test(h)), `${phase} ${vd}: Ammonium ohne Hinweis`);
}

for (const [, , vd] of faelle) pruefe(genutzt.has(vd), `${vd}: in keiner Phase eingeplant`);

console.log(`${n} Prüfungen, ${fehler} Fehler.`);
if (fehler) process.exit(1);
