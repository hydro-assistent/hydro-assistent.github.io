// Feste Beispielrezepte mit erwarteten Gramm-Mengen (Golden-Master für den Rechenkern).
// Die anderen Tests prüfen Eigenschaften (EC getroffen, Ammonium-Grenze …); dieser hier merkt jede Verschiebung
// der Mengen, z. B. nach einer Änderung an GEWICHT, UEBERSCHUSS_MILD oder hProCO3.
// Aufruf: node tests/kern.test.js
// Absichtlich geänderte Rechnung: node tests/kern.test.js --neu schreibt tests/kern.erwartet.json neu.
// Danach den Diff der JSON-Datei ansehen und begründen, warum sich die Mengen ändern dürfen.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { D: BASIS, K } = require('./laden');

const DATEI = path.join(__dirname, 'kern.erwartet.json');
const kopie = () => JSON.parse(JSON.stringify(BASIS));
const MAKRO = ['N', 'P', 'K', 'Ca', 'Mg', 'S'];
const r5 = x => Math.round(x * 1e5) / 1e5;

// Hartes Wasser, damit die Säuremenge und der Calcium-Anteil aus dem Wasser ins Gewicht fallen
const HART = { ecGemessen: 0.65, pH: 7.8, alkalitaet: 4.0, NO3: 2, NH4: 0, P: 0, K: 3, Ca: 110, Mg: 18, S: 30, Na: 20, Cl: 30 };

// Jeder Fall liefert ein Ergebnis von rezept()/vollansatz()
const REZEPTE = {
  'Wachstum Photo normal, 25 cm': () => K.vollansatz(kopie(), { phase: 'wachstum', typ: 'photo', staerke: 'normal', fuellhoehe: 25 }),
  'Blüte Photo normal, 25 cm': () => K.vollansatz(kopie(), { phase: 'bluete', typ: 'photo', staerke: 'normal', fuellhoehe: 25 }),
  'Blüte Auto stark, voll': () => K.vollansatz(kopie(), { phase: 'bluete', typ: 'auto', staerke: 'stark', fuellhoehe: 28 }),
  'Blüte Photo normal, Sparmodus': () => K.vollansatz(kopie(), { phase: 'bluete', typ: 'photo', staerke: 'normal', fuellhoehe: 25, spar: true }),
  'Reife Photo sanft, 20 cm': () => K.vollansatz(kopie(), { phase: 'reife', typ: 'photo', staerke: 'sanft', fuellhoehe: 20 }),
  'Anzucht Photo normal, 15 cm': () => K.vollansatz(kopie(), { phase: 'anzucht', typ: 'photo', staerke: 'normal', fuellhoehe: 15 }),
  'Wachstum EC 0,98 (Regression 3.9.1)': () => K.rezept(kopie(), { phase: 'wachstum', liter: 20, ecZiel: 0.98 }),
  'Blüte ohne Calcinit': () => K.rezept(kopie(), { phase: 'bluete', liter: 20, ecZiel: 1.6, vorrat: { calcinit: false } }),
  'Wachstum mit Salpetersäure': () => {
    const D = kopie(); D.saeure = { typ: 'salpeter', konz: 38, zielPH: 5.8 };
    return K.rezept(D, { phase: 'wachstum', liter: 20, ecZiel: 1.4 });
  },
  // Kaliumcarbonat wird nur ohne Kaliumnitrat und Basis 3 verplant; sein N-Gehalt hängt an hProCO3
  'Blüte mit Salpetersäure, Kaliumcarbonat': () => {
    const D = kopie(); D.saeure = { typ: 'salpeter', konz: 38, zielPH: 5.8 };
    return K.rezept(D, { phase: 'bluete', liter: 20, ecZiel: 1.7, vorrat: { kno3: false, basis3: false } });
  },
  'Blüte mit Schwefelsäure': () => {
    const D = kopie(); D.saeure = { typ: 'schwefel', konz: 37, zielPH: 5.8 };
    return K.rezept(D, { phase: 'bluete', liter: 20, ecZiel: 1.7 });
  },
  // Magnesium aus dem Wasser über dem Soll: hier greift UEBERSCHUSS_MILD
  'Wachstum, magnesiumreiches Wasser': () => {
    const D = kopie(); D.wasser.Mg = 40;
    return K.rezept(D, { phase: 'wachstum', liter: 20, ecZiel: 1.7 });
  },
  'Blüte, hartes Wasser, Phosphorsäure': () => {
    const D = kopie(); D.wasser = Object.assign({}, D.wasser, HART);
    return K.rezept(D, { phase: 'bluete', liter: 20, ecZiel: 1.8 });
  },
};

// Das, was die Mischanleitung zeigt: Gramm je Salz, Säure in ml, EC, Nährstoffe
const kurz = r => ({
  mengen: r.mengen.map(m => [m.id, m.gramm, r5(m.gProL)]),
  saeureMl: r.saeure.ml,
  ec: r5(r.ec.gesamt),
  faktorK: r5(r.faktorK),
  ist: Object.fromEntries(MAKRO.map(e => [e, r5(r.ist[e])])),
});

function ergebnisse() {
  const rezepte = Object.fromEntries(Object.entries(REZEPTE).map(([name, f]) => [name, kurz(f())]));
  const D = kopie(), t = { phase: 'bluete', typ: 'photo', staerke: 'normal' };
  const a = K.topUp(D, Object.assign({ hJetzt: 22, ecJetzt: 2.2 }, t));
  const b = K.topUp(D, Object.assign({ hJetzt: 18, ecJetzt: 1.2 }, t));
  const topUp = {
    'Fall A, nur Wasser': { fall: a.fall, liter: r5(a.liter), ecDanach: r5(a.ecDanach), saeureMl: a.saeureMl },
    'Fall B, Nährlösung': { fall: b.fall, liter: r5(b.liter), ecNachfuell: r5(b.ecNachfuell), ecDanach: r5(b.ecDanach), rezept: kurz(b.rezept) },
  };
  const zielEC = {};
  for (const phase of Object.keys(D.phasen)) for (const typ of ['photo', 'auto']) for (const st of Object.keys(D.staerke))
    zielEC[`${phase}/${typ}/${st}`] = K.zielEC(D, phase, typ, st);
  const liter = {
    konisch: r5(K.liter(D.eimer, 25)),
    rund: r5(K.liter({ form: 'rund', durchmesser: 30 }, 20)),
    rechteck: r5(K.liter({ form: 'rechteck', laenge: 40, breite: 30 }, 20)),
    tabelle: r5(K.liter({ form: 'tabelle', tabelle: [[10, 5], [20, 12], [30, 21]] }, 25)),
  };
  return { rezepte, topUp, zielEC, liter };
}

if (process.argv.includes('--neu')) {
  fs.writeFileSync(DATEI, JSON.stringify(ergebnisse(), null, 1) + '\n');
  console.log('tests/kern.erwartet.json neu geschrieben. Diff prüfen, bevor du ihn committest.');
  process.exit(0);
}

const soll = JSON.parse(fs.readFileSync(DATEI, 'utf8'));
const ist = JSON.parse(JSON.stringify(ergebnisse())); // wie in der Datei (und ohne Prototypen aus der vm-Sandbox)

// Zahlen mit kleiner Toleranz vergleichen (Rundung in der letzten Stelle), alles andere exakt
function nah(a, b, pfad) {
  if (typeof a === 'number' && typeof b === 'number') {
    assert.ok(Math.abs(a - b) <= 1e-4 + 1e-4 * Math.abs(b), `${pfad}: ${a} statt ${b}`);
  } else if (Array.isArray(b)) {
    assert.ok(Array.isArray(a) && a.length === b.length, `${pfad}: ${JSON.stringify(a)} statt ${JSON.stringify(b)}`);
    // Mengenliste [[id, gramm, gProL], …]: erst Salze und Reihenfolge, dann die Zahlen
    if (Array.isArray(b[0])) assert.deepEqual(a.map(x => x[0]), b.map(x => x[0]), `${pfad}: andere Salze oder Reihenfolge`);
    b.forEach((x, i) => nah(a[i], x, `${pfad}[${i}]`));
  } else if (b && typeof b === 'object') {
    assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), `${pfad}: andere Felder`);
    for (const k of Object.keys(b)) nah(a[k], b[k], `${pfad}.${k}`);
  } else {
    assert.equal(a, b, pfad);
  }
}

// Ein Test je Fall, damit sich einzelne Fälle filtern lassen: node --test-name-pattern "Blüte" tests/kern.test.js
for (const gruppe of Object.keys(soll)) {
  test(`${gruppe}: gleiche Fälle wie in kern.erwartet.json`, () => assert.deepEqual(Object.keys(ist[gruppe]).sort(), Object.keys(soll[gruppe]).sort()));
  for (const name of Object.keys(soll[gruppe])) test(`${gruppe}: ${name}`, () => nah(ist[gruppe][name], soll[gruppe][name], name));
}
