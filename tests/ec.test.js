// Gegenprobe der EC-Schätzung: Unser Modell (Kationen in meq/L ÷ 10, mal ecSalzFaktor aus einer gemessenen Testmischung)
// gegen ein Ionen-Modell mit Grenzleitfähigkeit je Ion und Debye-Hückel-Korrektur („LMCv2“, wie in HydroBuddy und im
// DWC-Rechner von hardcor3crash, github.com/hardcor3crash/Dwc-Rechner, calc()). Beide schätzen nur den Salzanteil,
// Wasser und Säure bleiben außen vor. Ändert jemand ecSchaetzung oder die Kalibrierung, schlägt der Test an, sobald
// die beiden Modelle weit auseinanderlaufen. Der Rechenkern wird hier nur gelesen.
// Aufruf: node tests/ec.test.js
const { D, K } = require('./laden');

let n = 0, fehler = 0;
function pruefe(ok, text) { n++; if (!ok) { fehler++; console.log('FEHLER: ' + text); } }

// LMCv2 wie im DWC-Rechner übernommen: λ0 in S·cm²/mol je Ladung, Ionenstärke ohne den Faktor ½ (so steht es dort)
const LAMBDA = { NO3: 71.5, NH4: 73.5, P: 33.0, K: 73.5, Ca: 59.5, Mg: 53.1, S: 80.0, Fe: 54.0, Mn: 53.5 };
const MOL = { NO3: 14.01, NH4: 14.01, P: 30.97, K: 39.10, Ca: 40.08, Mg: 24.31, S: 32.06, Fe: 55.85, Mn: 54.94 };
const ZWEI = ['Ca', 'Mg', 'S', 'Fe', 'Mn']; // zweiwertig (Phosphat als H2PO4⁻ einwertig)
function ecIonen(z) {
  let I = 0, ein = 0, zwei = 0;
  for (const e in LAMBDA) {
    const c = (z[e] || 0) / (MOL[e] * 1000); // mol/L
    if (ZWEI.includes(e)) { I += 4 * c; zwei += 2 * c * LAMBDA[e]; } else { I += c; ein += c * LAMBDA[e]; }
  }
  const w = Math.sqrt(I);
  return ein * Math.exp(-0.7025187 * w) + zwei * Math.exp(-0.7025187 * w * 2 * Math.SQRT2);
}

const liter = K.liter(D.eimer, D.eimer.zielFuell);
function vergleich(name, phase, staerke, auswahl) {
  const r = K.rezept(D, { phase, liter, ecZiel: K.zielEC(D, phase, 'photo', staerke), auswahl });
  const z = {};
  for (const m of r.mengen) {
    const s = D.salze.find(x => x.id === m.id);
    for (const e in LAMBDA) z[e] = (z[e] || 0) + (s[e] || 0) * 10 * m.gProL;
  }
  const app = r.ec.vorSaeure - D.wasser.ecGemessen, ionen = ecIonen(z);
  if (app < 0.2) return null; // fast nur Wasser: Verhältnis nicht aussagekräftig
  pruefe(app / ionen > 0.8 && app / ionen < 1.1, `${name}: Salz-EC ${app.toFixed(2)}, Ionen-Modell ${ionen.toFixed(2)} (Verhältnis ${(app / ionen).toFixed(2)})`);
  pruefe(Math.abs(app - ionen) < 0.12, `${name}: Abstand ${Math.abs(app - ionen).toFixed(2)} mS/cm`);
  return app / ionen;
}

const q = [];
// Standard-Salze: jede Phase und Stärke
for (const phase of Object.keys(D.phasen)) for (const st of Object.keys(D.staerke)) q.push(vergleich(`Standard ${phase}/${st}`, phase, st));
// Jeder Volldünger allein (nur er eingeschaltet, Einzelsalze bleiben wie im Standard) in Wachstum und Blüte
for (const s of D.salze.filter(s => s.gruppe)) for (const phase of ['wachstum', 'bluete']) q.push(vergleich(`${s.id} ${phase}`, phase, 'normal', { [s.id]: true }));
// Ohne Volldünger, nur Einzelsalze
const einzeln = Object.fromEntries(D.salze.filter(s => !s.co3).map(s => [s.id, !s.gruppe]));
for (const phase of ['wachstum', 'bluete']) q.push(vergleich(`Einzelsalze ${phase}`, phase, 'normal', einzeln));

const v = q.filter(x => x !== null).sort((a, b) => a - b);
console.log(`Unser Modell / Ionen-Modell: ${v[0].toFixed(2)} bis ${v[v.length - 1].toFixed(2)}, Median ${v[v.length >> 1].toFixed(2)} (${v.length} Rezepte)`);
console.log(`${n} Prüfungen, ${fehler} Fehler.`);
if (fehler) process.exit(1);
