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

// Einkaufstipp Phosphor (seit 3.13.8): nur Soft Elite und Salpetersäure, weiches Wasser – P bleibt knapp, die App nennt MKP
{
  const d2 = JSON.parse(JSON.stringify(D));
  d2.saeure = { typ: 'salpeter', konz: 38, zielPH: 5.8 };
  d2.wasser = { ecGemessen: 0.29, pH: 7, alkalitaet: 1.3, NO3: 0, NH4: 0, P: 0, K: 0, Ca: 40, Mg: 6, S: 4.3 };
  const ids2 = ['soft_elite', 'calcinit', 'kno3', 'bittersalz'], v2 = {}, a2 = {};
  for (const s of d2.salze) { v2[s.id] = ids2.includes(s.id); a2[s.id] = ids2.includes(s.id); }
  const r2 = K.rezept(d2, { phase: 'wachstum', liter: 24.7, ecZiel: 1.35, vorrat: v2, auswahl: a2 });
  pruefe(r2.hinweise.some(h => /Monokaliumphosphat/.test(h)), 'Einkaufstipp Phosphor fehlt');
  ids2.push('mkp'); for (const s of d2.salze) { v2[s.id] = ids2.includes(s.id); a2[s.id] = ids2.includes(s.id); }
  const r3 = K.rezept(d2, { phase: 'wachstum', liter: 24.7, ecZiel: 1.35, vorrat: v2, auswahl: a2 });
  pruefe(!r3.hinweise.some(h => /Monokaliumphosphat/.test(h)) && r3.mengen.some(m => m.id === 'mkp'), 'Mit MKP: kein Tipp, MKP eingeplant');
}

// „Sparsam“ mit Soft Elite als einzigem Volldünger (seit 3.13.9): Lockern darf keine Stufe wählen, bei der k einbricht
for (const phase of ['wachstum', 'bluete']) {
  const d3 = JSON.parse(JSON.stringify(D));
  d3.saeure = { typ: 'salpeter', konz: 38, zielPH: 5.8 };
  d3.wasser = { ecGemessen: 0.285, pH: 7, alkalitaet: 1.3, NO3: 0, NH4: 0, P: 0, K: 0, Ca: 40.25, Mg: 6.05, S: 4.27 };
  const ids3 = ['soft_elite', 'calcinit', 'kno3', 'bittersalz'], v3 = {}, a3 = {};
  for (const s of d3.salze) { v3[s.id] = ids3.includes(s.id); a3[s.id] = ids3.includes(s.id); }
  const r = K.rezept(d3, { phase, liter: 24.7, ecZiel: K.zielEC(d3, phase, 'photo', 'normal'), vorrat: v3, auswahl: a3, rezeptSparsam: true });
  pruefe(r.faktorK > 0.6, `Sparsam ${phase}: k ${r.faktorK.toFixed(2)} eingebrochen`);
  pruefe(r.ist.NH4anteil <= 0.16, `Sparsam ${phase}: Ammonium ${(r.ist.NH4anteil * 100).toFixed(0)} %`);
  pruefe(r.mengen.some(m => m.id === 'bittersalz') && r.ist.Mg >= 15, `Sparsam ${phase}: Mg ${r.ist.Mg.toFixed(0)}, Bittersalz fehlt`);
}

// Eisen-Lösung (seit 3.13.16): Chelat als Stammlösung in ml. Wird nicht als „winzige Menge“ gestrichen, hebt Eisen auf 1 mg/L
// und rettet Rezepte mit eisenarmen Volldüngern (k bricht nicht ein, Ammonium bleibt an der Grenze).
{
  const fe = D.salze.find(s => s.id === 'eisen');
  pruefe(!!fe && fe.aktiv === false && fe.eisenLsg && fe.loesungGProL === 10 && fe.Fe === 11, 'Eisen-Lösung: Fe-DTPA 11 %, 10 g/L, zum Einschalten');
  pruefe(D.reihenfolge.indexOf('eisen') >= 0 && D.reihenfolge.indexOf('eisen') < D.reihenfolge.indexOf('calcinit'), 'Eisen-Lösung vor Calcinit');
  for (const vd of ['kristalon_weiss', 'soft_ultra', 'polka', 'basis3'])
    for (const [phase, typ] of [['wachstum', 'salpeter'], ['bluete', 'phosphor']]) {
      const d4 = JSON.parse(JSON.stringify(D));
      d4.saeure = typ === 'salpeter' ? { typ, konz: 38, zielPH: 5.8 } : { typ, konz: 85, zielPH: 5.8 };
      const ids4 = [vd, 'calcinit', 'bittersalz', 'kno3', 'eisen'], v4 = {}, a4 = {};
      for (const s of d4.salze) { v4[s.id] = ids4.includes(s.id); a4[s.id] = ids4.includes(s.id); }
      const ec = K.zielEC(d4, phase, 'photo', 'normal');
      const r = K.rezept(d4, { phase, liter: 25, ecZiel: ec, vorrat: v4, auswahl: a4 });
      const m = r.mengen.find(x => x.id === 'eisen');
      pruefe(r.ist.Fe >= 0.98 && r.ist.Fe <= 3, `${vd} ${phase}: Eisen ${r.ist.Fe.toFixed(2)} mit Eisen-Lösung`);
      pruefe(!m || (m.ml > 0 && Math.abs(m.ml - m.gramm / 10 * 1000) < 2), `${vd} ${phase}: ml aus g/L`);
      pruefe(r.faktorK > 0.55, `${vd} ${phase}: k ${r.faktorK.toFixed(2)} mit Eisen-Lösung`);
      pruefe(r.ist.NH4anteil <= 0.155, `${vd} ${phase}: Ammonium ${(r.ist.NH4anteil * 100).toFixed(0)} %`);
      pruefe(Math.abs(r.ec.gesamt - ec) <= 0.15, `${vd} ${phase}: EC ${r.ec.gesamt.toFixed(2)}`);
      pruefe(!r.hinweise.some(h => /reicht das Eisen nicht|Eisen nur|kleine Menge/.test(h)), `${vd} ${phase}: kein Eisen-Hinweis mehr`);
    }
  // Ohne Eisen-Lösung im Vorrat bleibt das Eisen-Minimum wie bisher (Golden-Master prüft die Gramm)
  const ohne = K.rezept(JSON.parse(JSON.stringify(D)), { phase: 'wachstum', liter: 20, ecZiel: 1.4 });
  pruefe(!ohne.mengen.some(x => x.id === 'eisen'), 'Standard-Satz ohne Eisen-Lösung');
}

console.log(`${n} Prüfungen, ${fehler} Fehler.`);
if (fehler) process.exit(1);
