// Rundgang durch die Oberfläche im echten Browser (seit 3.13.17): Einrichtung, Mischanleitung, Eisen-Lösung in ml,
// Escaping von Namen, Import einer kaputten und einer gültigen Sicherung. Die übrigen Tests prüfen nur DATEN und KERN.
// Braucht Playwright mit Chromium; die App selbst bleibt ohne Abhängigkeiten. Läuft in GitHub Actions als eigener Job.
//   node tests/oberflaeche.ui.js
// Lokal ohne installiertes Playwright-Paket wird das globale genommen; HYDRO_CHROMIUM setzt einen eigenen Browser-Pfad.
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');

function playwright() {
  try { return require('playwright'); } catch (e) {}
  const global = require('child_process').execSync('npm root -g').toString().trim();
  return require(path.join(global, 'playwright'));
}

let n = 0, fehler = 0;
function pruefe(ok, text) { n++; if (!ok) { fehler++; console.log('FEHLER: ' + text); } }

// Kleiner statischer Server für den Projektordner
const WURZEL = path.join(__dirname, '..');
const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const datei = path.join(WURZEL, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!datei.startsWith(WURZEL)) { res.writeHead(403); return res.end(); }
  fs.readFile(datei, (err, inhalt) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream' }); res.end(inhalt);
  });
});

const BOESE = '<img src=x onerror="alert(1)">"\'&';

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const { chromium } = playwright();
  const browser = await chromium.launch(process.env.HYDRO_CHROMIUM ? { executablePath: process.env.HYDRO_CHROMIUM } : {});
  const p = await browser.newPage({ viewport: { width: 390, height: 1400 } });
  const jsFehler = [], dialoge = [];
  p.on('pageerror', e => jsFehler.push(e.message));
  p.on('dialog', d => { dialoge.push(d.message()); d.accept(); });
  const text = async () => p.innerText('body');
  const zustand = () => p.evaluate(() => JSON.parse(localStorage.getItem('hydro-zustand-v1')));

  // ---------- Einrichtung ----------
  async function einrichten(salze) {
    await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
    for (let i = 0; i < 3; i++) {
      if (i === 1) for (const [id, v] of [['sEC', '0,4'], ['sPH', '7,5'], ['sKH', '1,7'], ['sCa', '45'], ['sMg', '5'], ['sSO4', '40']]) await p.fill('#' + id, v);
      if (i === 2) { await p.click('[data-act="saeureAn"][data-t="phosphor"]'); await p.click('[data-act="haftung"]'); }
      await p.click('[data-act="setupWeiter"]'); await p.waitForTimeout(250);
    }
    pruefe((await p.innerText('h1')).includes('Welche Salze'), 'Einrichtung: Schritt 4 nicht erreicht');
    await p.click('[data-act="grundSatz"]'); await p.waitForTimeout(150);
    for (const id of salze || []) {
      const vd = await p.$(`details[data-merk="vdOffen"] [data-id="${id}"]`);
      if (vd && !(await p.$eval('details[data-merk="vdOffen"]', d => d.open))) await p.click('details[data-merk="vdOffen"] > summary');
      await p.click(`[data-id="${id}"]`); await p.waitForTimeout(150);
    }
    await p.click('[data-act="setupWeiter"]'); await p.waitForTimeout(400);
    pruefe((await zustand()).einst.setup === true, 'Einrichtung nicht abgeschlossen');
  }
  async function neuAnsetzen() {
    // Über die Tankseite, dort gibt es „Neu ansetzen“ immer (der Hauptknopf der Karte wechselt je nach Tagebuch)
    await p.click('[data-act="tab"][data-v="start"]'); await p.waitForTimeout(200);
    await p.click('[data-act="oeffne"][data-i="0"]'); await p.waitForTimeout(200);
    await p.click('[data-act="gehe"][data-v="neu"]'); await p.waitForTimeout(200);
    await p.click('[data-act="rechneNeu"]');
    await p.waitForFunction(() => !document.querySelector('[data-act="rechneNeu"][disabled]'), null, { timeout: 30000 });
    await p.waitForTimeout(300);
    return text();
  }

  await einrichten();
  let t = await neuAnsetzen();
  pruefe(/Calcinit/.test(t) && /\d,\d+ g/.test(t), 'Mischanleitung: Gramm-Mengen fehlen');
  pruefe(!/NaN|undefined|Infinity/.test(t), 'Mischanleitung: NaN/undefined sichtbar');
  pruefe(/Säure immer ins Wasser/.test(t), 'Mischanleitung: Säure-Hinweis fehlt');

  // ---------- Eisen-Lösung: Schritt in ml ----------
  await einrichten(['eisen', 'kristalon_weiss']);
  t = await neuAnsetzen();
  pruefe(/[\d,]+ ml\s+Eisen-Lösung \(Fe-DTPA\) zugeben/.test(t), 'Eisen-Lösung: Schritt in ml fehlt');

  // ---------- Fokus nach dem Neuzeichnen ----------
  await p.reload(); await p.waitForTimeout(300);
  await p.click('[data-act="tab"][data-v="einst"]'); await p.waitForTimeout(200);
  await p.click('[data-act="einstGruppe"][data-g="salze"]'); await p.waitForTimeout(250);
  await p.focus('[data-act="vorrat"][data-id="bittersalz"]'); await p.keyboard.press('Space'); await p.waitForTimeout(250);
  pruefe(await p.evaluate(() => document.activeElement && document.activeElement.dataset.id === 'bittersalz' && document.activeElement.getAttribute('aria-checked') === 'false'),
    'Fokus: Schalter nach dem Umschalten nicht mehr fokussiert');
  await p.keyboard.press('Space'); await p.waitForTimeout(250);
  pruefe(await p.evaluate(() => document.activeElement.getAttribute('aria-checked') === 'true'), 'Fokus: zweimal Leertaste schaltet nicht zurück');
  await p.focus('[data-act="tab"][data-v="verlauf"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  pruefe(await p.evaluate(() => document.activeElement && document.activeElement.tagName === 'H1'), 'Fokus: nach Seitenwechsel nicht auf der Überschrift');

  // ---------- Escaping: bösartige Namen überall ----------
  await einrichten();
  await p.evaluate(B => {
    const z = JSON.parse(localStorage.getItem('hydro-zustand-v1'));
    z.eimer[0].name = B;
    z.einst.eigeneSalze.push({ id: 'eigen_x', name: B, werte: { NO3: 10, K: 30 } }); z.einst.auswahl.eigen_x = true;
    z.einst.quellen.push({ id: 'q_x', name: B, werte: { ecGemessen: 0.1, pH: 7, alkalitaet: 0.5, Ca: 10, Mg: 2, S: 1 } });
    z.log.push({ eimer: 0, art: B, zeit: Date.now(), notiz: B, ec: 1.2, ph: 5.8 });
    localStorage.setItem('hydro-zustand-v1', JSON.stringify(z));
  }, BOESE);
  await p.reload(); await p.waitForTimeout(300);
  let eingeschleust = await p.$$eval('img[src="x"]', l => l.length);
  for (const v of ['verlauf', 'einst', 'start']) { await p.click(`[data-act="tab"][data-v="${v}"]`); await p.waitForTimeout(250); eingeschleust += await p.$$eval('img[src="x"]', l => l.length); }
  for (const g of ['tanks', 'wasser', 'salze', 'rezepte']) {
    await p.click('[data-act="tab"][data-v="einst"]'); await p.waitForTimeout(200);
    await p.click(`[data-act="einstGruppe"][data-g="${g}"]`); await p.waitForTimeout(250);
    eingeschleust += await p.$$eval('img[src="x"]', l => l.length);
  }
  await p.click('[data-act="tab"][data-v="start"]'); await p.waitForTimeout(200);
  t = await neuAnsetzen(); eingeschleust += await p.$$eval('img[src="x"]', l => l.length);
  pruefe(eingeschleust === 0, `Escaping: ${eingeschleust} eingeschleuste Elemente`);
  pruefe(!dialoge.some(m => m === '1'), 'Escaping: alert() ausgeführt');
  pruefe(t.includes('<img src=x'), 'Escaping: Name nicht als Text sichtbar');

  // ---------- Import: kaputte Sicherung ----------
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hydro-'));
  await einrichten();
  const gut = await zustand();
  const kaputt = JSON.parse(JSON.stringify(gut));
  Object.assign(kaputt.einst.wasser, { Ca: -50, pH: 'abc', Mg: 1e9 });
  Object.assign(kaputt.einst.saeure, { konzPhosphor: 500, zielPH: null });
  Object.assign(kaputt.einst.behaelter, { hoehe: -3, maxFuell: 'x' });
  kaputt.einst.eigeneSalze = [{ id: 'eigen_a', name: 'Kaputt', werte: { NO3: 250 } }, { id: 'eigen_b', name: 'Gut', werte: { NO3: 15, K: 30 } }, null, 7];
  kaputt.einst.wasserglas = { an: true, mlProL: -1 };
  kaputt.eimer[0].phase = 'quatsch';
  kaputt.log.push(null, 'text');
  fs.writeFileSync(path.join(tmp, 'kaputt.json'), JSON.stringify(kaputt));
  await p.click('[data-act="tab"][data-v="einst"]'); await p.waitForTimeout(200);
  await p.setInputFiles('#datei', path.join(tmp, 'kaputt.json')); await p.waitForTimeout(600);
  let z = await zustand();
  pruefe(!('Ca' in z.einst.wasser) && !('pH' in z.einst.wasser) && !('Mg' in z.einst.wasser), 'Import: ungültige Wasserwerte übernommen');
  pruefe(z.einst.wasser.ecGemessen === 0.4, 'Import: gültige Wasserwerte verloren');
  pruefe(z.einst.saeure.konzPhosphor === undefined && !z.einst.saeure.vorrat.phosphor && z.einst.saeure.zielPH === 5.8, 'Import: Säure nicht bereinigt');
  pruefe(z.einst.behaelter.hoehe > 0 && typeof z.einst.behaelter.maxFuell === 'number', 'Import: Maße nicht bereinigt');
  pruefe(z.einst.eigeneSalze.length === 1 && z.einst.eigeneSalze[0].name === 'Gut', 'Import: eigene Salze nicht bereinigt');
  pruefe(z.einst.wasserglas.mlProL === 0.1 && z.eimer[0].phase === 'wachstum' && z.log.every(x => x && typeof x === 'object'), 'Import: Wasserglas/Phase/Tagebuch nicht bereinigt');
  pruefe(z.einst.setup === false && z.pruefen === 'werte' && /Bitte prüfen/.test(await text()), 'Import: Einrichtung wird nicht erneut verlangt');

  // ---------- Import: gültige Sicherung bleibt gleich ----------
  await einrichten();
  const ok = await zustand();
  ok.einst.eigeneSalze = [{ id: 'eigen_b', name: 'Gut', werte: { NO3: 15, K: 30 } }]; ok.einst.auswahl.eigen_b = true;
  ok.einst.quellen = [{ id: 'q1', name: 'Osmose', werte: { ecGemessen: 0.02, pH: 6.5, alkalitaet: 0.1, Ca: 1, Mg: 0.2, S: 0.3 } }];
  ok.eimer.push({ name: 'Tank 2', phase: 'bluete', typ: 'auto', staerke: 'stark', rezept: 'sparsam', behaelter: Object.assign({}, ok.einst.behaelter, { hoehe: 50, maxFuell: 40 }) });
  ok.log.push({ eimer: 0, art: 'Neuansatz', zeit: 1, ec: 1.3, ph: 5.8 });
  fs.writeFileSync(path.join(tmp, 'gut.json'), JSON.stringify(ok));
  await p.click('[data-act="tab"][data-v="einst"]'); await p.waitForTimeout(200);
  await p.setInputFiles('#datei', path.join(tmp, 'gut.json')); await p.waitForTimeout(600);
  z = await zustand();
  // Reihenfolge der Schlüssel ist egal
  const sortiert = x => Array.isArray(x) ? x.map(sortiert) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, sortiert(x[k])])) : x;
  const ohne = x => { const c = sortiert(x); delete c.geaendert; delete c.pruefen; return JSON.stringify(c); };
  pruefe(ohne(ok) === ohne(z) && z.einst.setup === true, 'Import: gültige Sicherung verändert');

  pruefe(jsFehler.length === 0, 'JS-Fehler: ' + jsFehler.join(' | '));
  await browser.close(); server.close();
  console.log(`${n} Prüfungen, ${fehler} Fehler.`);
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.log('FEHLER: ' + (e && e.stack || e)); server.close(); process.exit(1); });
