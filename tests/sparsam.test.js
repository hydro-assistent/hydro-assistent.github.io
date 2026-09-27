// Rezept „Sparsam“ und Nachfüllen nach Verbrauch (seit 3.13). Beides sind Zusatzwege:
// ohne die neuen Optionen muss alles genau so rechnen wie vorher.
const { D, K } = require('./laden');

let n = 0, fehler = 0;
function pruefe(ok, text) { n++; if (!ok) { fehler++; console.log('FEHLER: ' + text); } }
const kopie = x => JSON.parse(JSON.stringify(x));
const mitSaeure = typ => { const d = kopie(D); d.saeure = { typ, konz: typ === 'salpeter' ? 53 : 85, zielPH: 5.8 }; return d; };

// Säurewahl: mit „wenig P“ nimmt auch die Blüte zuerst Salpetersäure, ohne sie bleibt es bei Phosphorsäure
const beide = { zielPH: 5.8, vorrat: { phosphor: true, salpeter: true }, konzPhosphor: 85, konzSalpeter: 53 };
pruefe(K.saeureWahl(beide, 'bluete').typ === 'phosphor', 'Blüte ohne Sparsam: Phosphorsäure');
pruefe(K.saeureWahl(beide, 'bluete', true).typ === 'salpeter', 'Blüte mit Sparsam: Salpetersäure');
pruefe(K.saeureWahl({ zielPH: 5.8, vorrat: { phosphor: true }, konzPhosphor: 85 }, 'bluete', true).typ === 'phosphor', 'Sparsam ohne Salpetersäure: Phosphorsäure bleibt');

// Rezept: EC getroffen, deutlich weniger P als klassisch, Ammonium-Grenze gehalten
for (const phase of ['anzucht', 'wachstum', 'bluete']) {
  const d = mitSaeure('salpeter'), ec = K.zielEC(d, phase, 'photo', 'normal');
  const kl = K.rezept(d, { phase, liter: 28, ecZiel: ec });
  const sp = K.rezept(d, { phase, liter: 28, ecZiel: ec, rezeptSparsam: true });
  pruefe(Math.abs(sp.ec.gesamt - ec) <= 0.15, `${phase}: EC ${sp.ec.gesamt.toFixed(2)} statt ${ec}`);
  if (phase !== 'anzucht') pruefe(sp.ist.P < kl.ist.P * 0.8, `${phase}: P sparsam ${sp.ist.P.toFixed(0)} nicht unter klassisch ${kl.ist.P.toFixed(0)}`);
  pruefe(sp.ist.P <= 30, `${phase}: P ${sp.ist.P.toFixed(0)} mg/L über 30`);
  pruefe(sp.ist.NH4anteil <= 0.16, `${phase}: Ammonium ${(sp.ist.NH4anteil * 100).toFixed(0)} %`);
  pruefe(!sp.hinweise.some(h => /Rezept „Sparsam“/.test(h)), `${phase}: Säure-Hinweis ohne Phosphorsäure`);
}
// In der Reife wirkt Sparsam nicht
{
  const d = mitSaeure('salpeter'), ec = K.zielEC(d, 'reife', 'photo', 'normal');
  const a = K.rezept(d, { phase: 'reife', liter: 28, ecZiel: ec }), b = K.rezept(d, { phase: 'reife', liter: 28, ecZiel: ec, rezeptSparsam: true });
  pruefe(JSON.stringify(a.mengen) === JSON.stringify(b.mengen), 'Reife: Sparsam darf nichts ändern');
}
// Mit Phosphorsäure: Hinweis, dass die Säure schon mehr P bringt
{
  const d = mitSaeure('phosphor'), ec = K.zielEC(d, 'bluete', 'photo', 'normal');
  const r = K.rezept(d, { phase: 'bluete', liter: 28, ecZiel: ec, rezeptSparsam: true });
  pruefe(r.hinweise.some(h => /Phosphorsäure.*Rezept „Sparsam“/.test(h)), 'Hinweis Phosphorsäure fehlt');
}

// Nachfüllen nach Verbrauch
const d = mitSaeure('salpeter'), basis = { phase: 'wachstum', typ: 'photo', staerke: 'normal', hJetzt: 20 };
const ecZiel = K.zielEC(d, 'wachstum', 'photo', 'normal');
{ // niedrige EC: Nachfülllösung bleibt in Ziel-Stärke (nach EC würde sie stärker) und es gibt den Beruhigungs-Hinweis
  const v = K.topUp(d, Object.assign({ ecJetzt: 0.6, nachfuellen: 'verbrauch' }, basis));
  const e = K.topUp(d, Object.assign({ ecJetzt: 0.6 }, basis));
  pruefe(v.fall === 'B' && v.ecNachfuell === ecZiel, `Verbrauch: Nachfüll-EC ${v.ecNachfuell} statt ${ecZiel}`);
  pruefe(e.ecNachfuell > ecZiel, 'Nach EC: Nachfüll-EC höher als Ziel');
  pruefe(v.hinweise.some(h => /normal/.test(h)), 'Verbrauch: Hinweis niedrige EC fehlt');
  pruefe(Math.abs(v.rezept.ec.gesamt - ecZiel) <= 0.15, 'Verbrauch: Rezept trifft Ziel-EC');
}
{ // EC etwas über Ziel: nach EC schwächere Lösung, nach Verbrauch weiter in Ziel-Stärke
  const v = K.topUp(d, Object.assign({ ecJetzt: ecZiel * 1.2, nachfuellen: 'verbrauch' }, basis));
  const e = K.topUp(d, Object.assign({ ecJetzt: ecZiel * 1.2 }, basis));
  pruefe(v.fall === 'B' && v.ecNachfuell === ecZiel, 'Verbrauch bei EC über Ziel: Nährlösung in Ziel-Stärke');
  pruefe(e.fall === 'A' || e.ecNachfuell < ecZiel, 'Nach EC bei EC über Ziel: schwächer als Ziel');
}
{ // EC deutlich über Ziel: nur Wasser mit Hinweis auf Anreicherung
  const v = K.topUp(d, Object.assign({ ecJetzt: ecZiel * 1.4, nachfuellen: 'verbrauch' }, basis));
  pruefe(v.fall === 'A' && v.hinweise.some(h => /reichern sich Salze an/.test(h)), 'Verbrauch bei hoher EC: nur Wasser mit Hinweis');
}
{ // Tank voll: nichts tun, egal welcher Weg
  const v = K.topUp(d, Object.assign({}, basis, { hJetzt: d.eimer.zielFuell, ecJetzt: 1, nachfuellen: 'verbrauch' }));
  pruefe(v.fall === '–', 'Voller Tank: nichts nachfüllen');
}

console.log(`${n} Prüfungen, ${fehler} Fehler.`);
if (fehler) process.exit(1);
