// Prüft die Wahl der Säure je Phase: Wachstum Salpetersäure, Blüte Phosphorsäure, sonst die nächste vorrätige.
// Aufruf: node tests/saeure.test.js
const { D: BASIS, K } = require('./laden');
let fehler = 0, pruefungen = 0;
const gleich = (ist, soll, text) => { pruefungen++; if (ist !== soll) { fehler++; console.log(`FEHLER ${text}: ${ist} statt ${soll}`); } };
const wahr = (ok, text) => { pruefungen++; if (!ok) { fehler++; console.log('FEHLER ' + text); } };
const PHASEN = ['anzucht', 'wachstum', 'bluete', 'reife'];
const wahl = (vorrat, extra) => Object.fromEntries(PHASEN.map(p => [p, K.saeureWahl(Object.assign({ zielPH: 5.8, vorrat }, extra), p)]));

// 1. Vorrang je Phase
const fall = (vorrat, erwartet, text) => { const w = wahl(vorrat); PHASEN.forEach((p, i) => gleich(w[p].typ, erwartet[i], `${text}, ${p}`)); };
fall({ phosphor: true, salpeter: true }, ['salpeter', 'salpeter', 'phosphor', 'phosphor'], 'Phosphor + Salpeter');
fall({ phosphor: true, salpeter: true, schwefel: true }, ['salpeter', 'salpeter', 'phosphor', 'phosphor'], 'alle drei');
fall({ phosphor: true }, ['phosphor', 'phosphor', 'phosphor', 'phosphor'], 'nur Phosphor');
fall({ salpeter: true }, ['salpeter', 'salpeter', 'salpeter', 'salpeter'], 'nur Salpeter');
fall({ schwefel: true }, ['schwefel', 'schwefel', 'schwefel', 'schwefel'], 'nur Schwefel');
fall({ salpeter: true, schwefel: true }, ['salpeter', 'salpeter', 'salpeter', 'salpeter'], 'Salpeter + Schwefel (Blüte ohne Phosphor: Salpeter)');
fall({ phosphor: true, schwefel: true }, ['phosphor', 'phosphor', 'phosphor', 'phosphor'], 'Phosphor + Schwefel (Wachstum ohne Salpeter: Phosphor)');
fall({}, ['keine', 'keine', 'keine', 'keine'], 'keine Säure');

// 2. Konzentration je Säure, mit Standardwerten
{
  const w = wahl({ phosphor: true, salpeter: true }, { konzPhosphor: 75, konzSalpeter: 3 });
  gleich(w.wachstum.konz, 3, 'Konzentration Salpetersäure'); gleich(w.bluete.konz, 75, 'Konzentration Phosphorsäure');
  const std = wahl({ phosphor: true, salpeter: true, schwefel: true });
  gleich(std.bluete.konz, 85, 'Standard Phosphorsäure'); gleich(std.wachstum.konz, 3, 'Standard Salpetersäure');
  gleich(K.saeureKonz({ vorrat: { schwefel: true } }, 'schwefel'), 37, 'Standard Schwefelsäure');
  gleich(wahl({ phosphor: true }).bluete.zielPH, 5.8, 'Ziel-pH wird übernommen');
}

// 3. Alter Stand ohne Vorrat: die eine gespeicherte Säure gilt für alle Phasen
{
  const alt = { typ: 'salpeter', konz: 5, zielPH: 5.8 };
  PHASEN.forEach(p => { const w = K.saeureWahl(alt, p); gleich(w.typ + ' ' + w.konz, 'salpeter 5', `alter Stand, ${p}`); });
}

// 4. Rezepte: Säure bringt je Phase N bzw. P, ohne Säure rechnet die App ohne
{
  const s = { zielPH: 5.8, vorrat: { phosphor: true, salpeter: true }, konzPhosphor: 85, konzSalpeter: 3 };
  const rez = (phase, ec) => { const D = JSON.parse(JSON.stringify(BASIS)); D.saeure = K.saeureWahl(s, phase); return { D, r: K.rezept(D, { phase, liter: 20, ecZiel: ec }) }; };
  const wa = rez('wachstum', 1.35), bl = rez('bluete', 1.75);
  const saW = K.saeure(wa.D.wasser, wa.D.saeure, wa.D.kalibrierung), saB = K.saeure(bl.D.wasser, bl.D.saeure, bl.D.kalibrierung);
  gleich(wa.r.saeure.name, 'Salpetersäure 3 %', 'Wachstum: Name der Säure');
  gleich(bl.r.saeure.name, 'Phosphorsäure 85 %', 'Blüte: Name der Säure');
  wahr(saW.N > 0 && saW.P === 0, 'Wachstum: Säure bringt Stickstoff, keinen Phosphor');
  wahr(saB.P > 0 && saB.N === 0, 'Blüte: Säure bringt Phosphor, keinen Stickstoff');
  wahr(Math.abs(wa.r.ec.gesamt - 1.35) < 0.02 && Math.abs(bl.r.ec.gesamt - 1.75) < 0.02, 'Ziel-EC in beiden Phasen');
  const D0 = JSON.parse(JSON.stringify(BASIS)); D0.saeure = K.saeureWahl({ zielPH: 5.8, vorrat: {} }, 'wachstum');
  const r0 = K.rezept(D0, { phase: 'wachstum', liter: 20, ecZiel: 1.35 });
  wahr(r0.saeure.ml === 0 && r0.ec.saeure === 0, 'Ohne Säure: 0 ml, kein EC-Beitrag');
}

console.log(`${pruefungen} Prüfungen, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
