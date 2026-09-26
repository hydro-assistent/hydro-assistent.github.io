// Prüft den Schwefelsäure-Zweig: Säuremenge, Schwefel-Eintrag und EC-Beitrag.
// Die Erwartungswerte sind hier unabhängig nachgerechnet, nicht aus dem Rechenkern übernommen.
// Aufruf: node tests/schwefel.test.js
const { D: BASIS, K } = require('./laden');
let fehler = 0, pruefungen = 0;
const nah = (ist, soll, tol, text) => { pruefungen++; if (!(Math.abs(ist - soll) <= tol)) { fehler++; console.log(`FEHLER ${text}: ${ist} statt ${soll}`); } };
const wahr = (ok, text) => { pruefungen++; if (!ok) { fehler++; console.log('FEHLER ' + text); } };
const kopie = () => JSON.parse(JSON.stringify(BASIS));
const kal = BASIS.kalibrierung;
const MS = 32.06, M_H2SO4 = 98.079;

// Wasser mit bekannten Werten, unabhängig von den Beispieldaten
const WASSER = { ecGemessen: 0.4, pH: 7.5, alkalitaet: 2.0, NO3: 1, NH4: 0, P: 0, K: 2, Ca: 50, Mg: 8, S: 15 };
const hBedarf = (alk, pH) => alk * (1 - 1 / (1 + 10 ** (6.35 - pH))) * kal.saeureFaktor;

// 1. Dichte und mmol pro ml: Tabellenwerte und lineare Interpolation
for (const [konz, dichte] of [[37, 1.277], [96, 1.835], [38, 1.277 + (1.303 - 1.277) / 3], [10, 1.066], [5, (0.998 + 1.066) / 2]]) {
  const sa = K.saeure(WASSER, { typ: 'schwefel', konz, zielPH: 5.8 }, kal);
  nah(sa.mmolProMl, dichte * konz / 100 / M_H2SO4 * 1000, 1e-9, `mmol/ml bei ${konz} %`);
}

// 2. Menge und Inhalt: beide H+ werden abgegeben, Schwefel statt Phosphor oder Stickstoff
{
  const sa = K.saeure(WASSER, { typ: 'schwefel', konz: 37, zielPH: 5.8 }, kal);
  const mmol = hBedarf(2.0, 5.8) / 2;
  nah(sa.mmol, mmol, 1e-12, 'mmol H2SO4 pro L');
  nah(sa.S, mmol * MS, 1e-9, 'Schwefel aus der Säure');
  wahr(sa.P === 0 && sa.N === 0, 'Schwefelsäure bringt keinen P und kein N');
  nah(sa.ecFaktor * kal.ecProMmolSaeure, kal.ecProMmolSchwefel, 1e-12, 'EC pro mmol Schwefelsäure');
  // Halb so viele Moleküle wie bei einer einwertigen Säure
  const sp = K.saeure(WASSER, { typ: 'salpeter', konz: 3, zielPH: 5.8 }, kal);
  nah(sa.mmol * 2, sp.mmol, 1e-12, 'Schwefelsäure braucht halb so viele Moleküle wie Salpetersäure');
  // Extra-H+ (Wasserglas) wird ebenfalls durch 2 geteilt
  const mitExtra = K.saeure(WASSER, { typ: 'schwefel', konz: 37, zielPH: 5.8 }, kal, 1.0);
  nah(mitExtra.mmol - sa.mmol, 0.5, 1e-12, 'Extra-H+ durch 2');
}

// 3. Rezept mit Schwefelsäure: EC-Beitrag, Schwefel im Ergebnis, Säure in ml
function rezeptMit(saeure, wasser, ecZiel, phase = 'wachstum', extra = {}) {
  const D = kopie(); D.wasser = Object.assign({}, wasser); D.saeure = saeure;
  const liter = 20;
  return { D, liter, r: K.rezept(D, Object.assign({ phase, liter, ecZiel }, extra)) };
}
{
  const saeure = { typ: 'schwefel', konz: 37, zielPH: 5.8 };
  const { D, liter, r } = rezeptMit(saeure, WASSER, 1.4);
  const sa = K.saeure(WASSER, saeure, kal);
  nah(r.ec.gesamt, 1.4, 0.02, 'Ziel-EC wird getroffen');
  nah(r.ec.saeure, kal.ecProMmolSchwefel * sa.mmol, 1e-9, 'EC-Beitrag der Schwefelsäure');
  nah(r.ec.vorSaeure + r.ec.saeure, r.ec.gesamt, 1e-12, 'EC-Summe');
  // Schwefel im Ergebnis = Wasser + Säure + Salze
  const ausSalzen = r.mengen.reduce((a, m) => a + (D.salze.find(x => x.id === m.id).S || 0) * 10 * m.gProL, 0);
  nah(r.ist.S, WASSER.S + sa.S + ausSalzen, 1e-6, 'Schwefel-Bilanz');
  // Phosphor kommt nur aus Wasser und Salzen
  const pSalze = r.mengen.reduce((a, m) => a + (D.salze.find(x => x.id === m.id).P || 0) * 10 * m.gProL, 0);
  nah(r.ist.P, WASSER.P + pSalze, 1e-6, 'Kein Phosphor aus der Säure');
  // Säure in ml: gesamte Menge durch Stärke, gerundet auf 0,1 ml
  nah(r.saeure.ml, Math.round(sa.mmol * liter / sa.mmolProMl * 10) / 10, 1e-9, 'Säure in ml');
  wahr(r.saeure.name === 'Schwefelsäure 37 %', 'Name der Säure');
  wahr(r.hinweise.some(h => /Schwefelsäure.*nicht an echten Mischungen geprüft/.test(h)), 'Hinweis: EC-Schätzung ungeprüft');
}

// 4. Die Salzmengen hängen am EC-Beitrag der Säure: stärkerer Beitrag -> weniger Salz
{
  const saeure = { typ: 'schwefel', konz: 37, zielPH: 5.8 };
  const a = rezeptMit(saeure, WASSER, 1.4).r;
  const D2 = kopie(); D2.wasser = Object.assign({}, WASSER); D2.saeure = saeure; D2.kalibrierung.ecProMmolSchwefel = 0.1;
  const b = K.rezept(D2, { phase: 'wachstum', liter: 20, ecZiel: 1.4 });
  wahr(b.ec.vorSaeure > a.ec.vorSaeure, 'Kleinerer Säure-EC-Beitrag lässt mehr Platz für Salze');
  nah(b.ec.saeure, 0.1 * K.saeure(WASSER, saeure, kal).mmol, 1e-9, 'Kalibrierwert wird verwendet');
}

// 5. Ziel-EC 0,95 zu niedrig: mit Schwefelsäure früher erreicht als mit Phosphorsäure (größerer EC-Beitrag je mmol H+)
{
  const hart = Object.assign({}, WASSER, { alkalitaet: 6, ecGemessen: 0.5 });
  const sch = rezeptMit({ typ: 'schwefel', konz: 37, zielPH: 5.8 }, hart, 0.95).r;
  const pho = rezeptMit({ typ: 'phosphor', konz: 85, zielPH: 5.8 }, hart, 0.95).r;
  const ecOhneSalz = 0.5 + kal.ecProMmolSchwefel * hBedarf(6, 5.8) / 2;
  wahr(ecOhneSalz >= 0.95, 'Testaufbau: Wasser und Schwefelsäure liegen über 0,95');
  wahr(sch.hinweise.some(h => /nicht erreichbar/.test(h)), 'Schwefelsäure: Hinweis "nicht erreichbar"');
  wahr(!pho.hinweise.some(h => /nicht erreichbar/.test(h)), 'Phosphorsäure: kein Hinweis "nicht erreichbar"');
}

// 6. Kaliwasserglas: zusätzliche Säure für das Kalium, EC nur einmal gezählt
{
  const saeure = { typ: 'schwefel', konz: 37, zielPH: 5.8 };
  const D = kopie(); D.wasser = Object.assign({}, WASSER); D.saeure = saeure;
  const ohne = K.rezept(D, { phase: 'wachstum', liter: 20, ecZiel: 1.4 });
  const mit = K.rezept(D, { phase: 'wachstum', liter: 20, ecZiel: 1.4, wasserglas: 0.1 });
  const wg = K.wasserglasProMl(D.wasserglas);
  const mehrMl = (wg.hBedarf * 0.1 / 2) * 20 / K.saeure(WASSER, saeure, kal).mmolProMl;
  nah(mit.saeure.ml - ohne.saeure.ml, mehrMl, 0.11, 'Mehr Säure für Wasserglas (2 H+ je Molekül)');
  nah(mit.ec.saeure, ohne.ec.saeure, 1e-9, 'Säure-EC nur für das Wasser, Wasserglas-K zählt als Salz');
  nah(mit.ec.gesamt, 1.4, 0.02, 'Ziel-EC mit Wasserglas');
}

// 7. Nachfüllen nur mit Wasser: Säuremenge für das Nachfüllwasser
{
  const D = kopie(); D.wasser = Object.assign({}, WASSER); D.saeure = { typ: 'schwefel', konz: 37, zielPH: 5.8 };
  const t = K.topUp(D, { phase: 'wachstum', typ: 'photo', staerke: 'normal', hJetzt: 20, ecJetzt: 2.5 });
  const sa = K.saeure(WASSER, D.saeure, kal);
  wahr(t.fall === 'A', 'Hohe EC -> nur Wasser');
  nah(t.saeureMl, Math.round(sa.mmol * t.liter / sa.mmolProMl * 10) / 10, 1e-9, 'Säure für Nachfüllwasser');
}

console.log(`${pruefungen} Prüfungen, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
