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

// Eigene Salze (so wie die App sie anhängt): werden verplant, Calcium-Salze sind gekennzeichnet (getrennt vorlösen)
{
  const D2 = JSON.parse(JSON.stringify(D));
  const leer = { NO3: 0, NH4: 0, P: 0, K: 0, Ca: 0, Mg: 0, S: 0, Fe: 0, Mn: 0, Zn: 0, Cu: 0, B: 0, Mo: 0 };
  // Calciumnitrat eines anderen Herstellers statt Calcinit, dazu Kaliumsulfat als eigenes Salz
  D2.salze.push(Object.assign({}, leer, { id: 'eigen_ca', name: 'Calciumnitrat X', aktiv: false, eigen: true, NO3: 15.5, Ca: 19.0 }));
  D2.salze.push(Object.assign({}, leer, { id: 'eigen_k', name: 'Kaliumsulfat X', aktiv: false, eigen: true, K: 41.5, S: 18.0 }));
  D2.reihenfolge.push('eigen_ca'); D2.reihenfolge.splice(D2.reihenfolge.indexOf('calcinit'), 0, 'eigen_k');
  const r = K.rezept(D2, { phase: 'bluete', liter, ecZiel: 1.75, vorrat: { calcinit: false }, auswahl: { eigen_ca: true, eigen_k: true } });
  const ca = r.mengen.find(m => m.id === 'eigen_ca');
  pruefe(ca && ca.gramm > 0, 'Eigenes Calciumsalz wird verplant, wenn Calcinit fehlt');
  pruefe(ca && ca.calcium === true, 'Eigenes Calciumsalz ist als Calcium-Salz gekennzeichnet');
  pruefe(r.mengen.filter(m => m.id !== 'eigen_ca').every(m => m.calcium === false), 'Andere Salze nicht als Calcium-Salz gekennzeichnet');
  pruefe(r.mengen[r.mengen.length - 1].id === 'eigen_ca', 'Calcium-Salz kommt zuletzt');
  pruefe(Math.abs(r.ec.gesamt - 1.75) < 0.02, `EC mit eigenen Salzen ${r.ec.gesamt.toFixed(3)}`);
  const rc = K.rezept(D, { phase: 'bluete', liter, ecZiel: 1.75 });
  pruefe(rc.mengen.find(m => m.id === 'calcinit').calcium === true, 'Calcinit ist als Calcium-Salz gekennzeichnet');
}

// Wasser mit viel Natrium und Chlorid: Warnung; Ammonium und Phosphat im Wasser zählen mit
{
  const D3 = JSON.parse(JSON.stringify(D));
  const ruhig = K.rezept(D3, { phase: 'wachstum', liter, ecZiel: 1.35 });
  pruefe(!ruhig.hinweise.some(h => /Natrium|Chlorid/.test(h)), 'Beispielwasser: keine Natrium-/Chlorid-Warnung');
  Object.assign(D3.wasser, { Na: 80, Cl: 150, NH4: 0.4, P: 1.5 });
  const r = K.rezept(D3, { phase: 'wachstum', liter, ecZiel: 1.35 });
  pruefe(r.hinweise.some(h => /Natrium im Wasser 80/.test(h)), 'Warnung Natrium');
  pruefe(r.hinweise.some(h => /Chlorid im Wasser 150/.test(h)), 'Warnung Chlorid');
  const pSalze = r.mengen.reduce((a, m) => a + (D3.salze.find(x => x.id === m.id).P || 0) * 10 * m.gProL, 0);
  const sa = K.saeure(D3.wasser, D3.saeure, D3.kalibrierung);
  pruefe(Math.abs(r.ist.P - (1.5 + sa.P + pSalze)) < 1e-6, 'Phosphor aus dem Wasser zählt mit');
}

// Ohne jedes Salz mit Stickstoff und ohne Nitrat im Wasser (seit 3.13.17): Ammonium-Anteil 0 statt NaN, keine NaN im Ergebnis
{
  faelle++;
  const d = JSON.parse(JSON.stringify(D));
  d.saeure = { typ: 'phosphor', konz: 85, zielPH: 5.8 };
  d.wasser = Object.assign({}, d.wasser, { NO3: 0, NH4: 0 });
  const ids = ['bittersalz', 'k2so4'], vorrat = {}, auswahl = {};
  for (const s of d.salze) { vorrat[s.id] = ids.includes(s.id); auswahl[s.id] = ids.includes(s.id); }
  const r = K.rezept(d, { phase: 'wachstum', liter: 20, ecZiel: 1.2, vorrat, auswahl });
  pruefe(r.ist.N === 0 && r.ist.NH4anteil === 0, `ohne Stickstoff: N ${r.ist.N}, Ammonium-Anteil ${r.ist.NH4anteil}`);
  pruefe(!/NaN|Infinity/.test(JSON.stringify(r)) && !r.hinweise.some(h => /NaN/.test(h)), 'ohne Stickstoff: NaN im Ergebnis');
}

console.log(`${faelle} Fälle geprüft, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
