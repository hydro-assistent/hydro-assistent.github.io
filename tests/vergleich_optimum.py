"""Stellt das Rezept der App gegen eine unabhängige Optimierung (scipy, SLSQP mit Mehrfachstart).

Gleiche Salze, gleiches EC-Modell, gleiche Zielfunktion wie im Solver der App – nur dass hier
Salzmengen und Faktor k gemeinsam optimiert werden, bei fest vorgegebener Ziel-EC.
Säure wie in der App je Phase (saeureWahl), einmal mit Phosphor- und Salpetersäure vorrätig, einmal nur
mit Phosphorsäure. Das App-Rezept wird mit dem für es günstigsten k bewertet: So misst der Vergleich die Wahl
der Salze, nicht den Maßstab k (den die App über die EC festlegt).
Aufruf: python3 tests/vergleich_optimum.py   (braucht node, numpy, scipy)
"""
import json, subprocess, sys, pathlib
import numpy as np
from scipy.optimize import minimize, minimize_scalar

HIER = pathlib.Path(__file__).parent
JS = r"""
const { D, K } = require('./laden');
const liter = K.liter(D.eimer, D.eimer.zielFuell), kal = D.kalibrierung, w = D.wasser;
const faelle = [];
const VARIANTEN = { 'je Phase': { phosphor: true, salpeter: true }, 'nur Phosphor': { phosphor: true, salpeter: false } };
for (const [variante, vorrat] of Object.entries(VARIANTEN))
for (const phase of Object.keys(D.phasen)) for (const typ of ['photo', 'auto']) for (const st of Object.keys(D.staerke)) {
  // Säure je Phase wie in der App; Salze so, wie der Solver sie sieht (Kaliumcarbonat nur mit Salpetersäure,
  // sein Stickstoff aus der zusätzlichen Säure über hProCO3)
  const Dp = Object.assign({}, D, { saeure: K.saeureWahl({ zielPH: D.saeure.zielPH, vorrat }, phase) });
  const sa = K.saeure(w, Dp.saeure, kal), salpeter = Dp.saeure.typ === 'salpeter';
  const ecZiel = K.zielEC(Dp, phase, typ, st), r = K.rezept(Dp, { phase, liter, ecZiel });
  const hCO3 = 1 + (1 - 1 / (1 + 10 ** (6.35 - Dp.saeure.zielPH)));
  const salze = D.salze.filter(s => s.aktiv !== false && (!s.nurMitSalpeter || salpeter))
    .map(s => s.co3 ? Object.assign({}, s, { NO3: hCO3 * 14.007 / 138.205 * 100 }) : s);
  faelle.push({ name: `${phase}/${typ}/${st}`, variante, phase, saeure: Dp.saeure.typ, ecZiel, k: r.faktorK, mengen: r.mengen.map(m => [m.id, m.gProL]), salze,
    basis: { N: w.NO3 + w.NH4 + sa.N, NH4: w.NH4, P: w.P + sa.P, K: w.K, Ca: w.Ca, Mg: w.Mg, S: w.S + (sa.S || 0) },
    ecFix: w.ecGemessen + kal.ecProMmolSaeure * sa.mmol * (sa.ecFaktor || 1) });
}
console.log(JSON.stringify({ faelle, profile: Object.fromEntries(Object.entries(D.phasen).map(([p, v]) => [p, v.profil])),
  ecWasser: w.ecGemessen, ecSalzFaktor: kal.ecSalzFaktor }));
"""
m = json.loads(subprocess.run(['node', '-e', JS], cwd=HIER, capture_output=True, text=True, check=True).stdout)
MAKRO = ['N', 'P', 'K', 'Ca', 'Mg', 'S']
GEWICHT = dict(N=3, P=1, K=3, Ca=3, Mg=1.5, S=0.5); MILD = {'P', 'S', 'Ca', 'Mg'}
MOL = dict(K=39.098, Ca=40.078, Mg=24.305, N=14.007)

def gehalt(s, e): return s.get('NO3', 0) + s.get('NH4', 0) if e == 'N' else s.get(e, 0)

def modell(c, ids, profil, ecZiel):
    B = c['basis']
    L = [next(s for s in c['salze'] if s['id'] == i) for i in ids]
    A = np.array([[gehalt(s, e) * 10 for s in L] for e in MAKRO + ['NH4', 'Fe']])
    kat = np.array([gehalt(s, 'K') / MOL['K'] + 2 * gehalt(s, 'Ca') / MOL['Ca'] + 2 * gehalt(s, 'Mg') / MOL['Mg'] + gehalt(s, 'NH4') / MOL['N'] for s in L])
    feMin = min(0.8, max(0.25, 0.5 * (ecZiel - m['ecWasser'])))
    ec = lambda x: c['ecFix'] + m['ecSalzFaktor'] * (kat @ x)
    def f(x, k):  # wie ziel() im Solver der App
        v = A @ x; ist = {e: B[e] + v[i] for i, e in enumerate(MAKRO)}; wert = 0
        for e in MAKRO:
            d = (ist[e] - profil[e] * k) / (profil[e] * k)
            if d > 0 and e in MILD: d *= 0.5
            wert += GEWICHT[e] * d * d
        wert += 1e-3 * float(x @ x)
        wert += 1000 * (max(0, B['NH4'] + v[6] - 0.15 * ist['N']) / max(profil['N'] * k, 1)) ** 2
        wert += 1000 * (max(0, feMin - v[7]) / feMin) ** 2 + 100 * (max(0, v[7] - 3) / 3) ** 2
        return wert
    return L, ec, f

def optimum(c, ids, profil, ecZiel, starts=40):
    L, ec, f = modell(c, ids, profil, ecZiel); rng = np.random.default_rng(0); best = None
    for _ in range(starts):
        z0 = np.r_[rng.uniform(0, 0.4, len(L)), rng.uniform(0.2, 1.2)]
        r = minimize(lambda z: f(z[:-1], z[-1]), z0, method='SLSQP', bounds=[(0, None)] * len(L) + [(0.05, 3)],
                     constraints=[{'type': 'eq', 'fun': lambda z: ec(z[:-1]) - ecZiel}], options={'maxiter': 2000, 'ftol': 1e-12})
        if r.success and abs(ec(r.x[:-1]) - ecZiel) < 1e-6 and (best is None or r.fun < best.fun): best = r
    return best

fehler = 0
for c in m['faelle']:
    if c['ecZiel'] - c['ecFix'] < 0.1: print(f"{c['name']:22} übersprungen (Ziel-EC kaum über Wasser + Säure)"); continue
    # Die Optimierung darf alle Salze nehmen, die die App für diesen Fall zur Auswahl hatte
    ids = [s['id'] for s in c['salze']]
    profil = m['profile'][c['phase']]
    _, _, f = modell(c, [i for i, _ in c['mengen']], profil, c['ecZiel'])
    x = np.array([g for _, g in c['mengen']])
    # Bewertet mit dem besten k für genau diese Salzmengen. Mit dem k der App (aus der EC) wirkt fester Überschuss
    # aus Wasser und Säure bei kleinem k riesig: in der Anzucht mit nur Phosphorsäure bis Faktor 7, obwohl die
    # Salzmengen fast gleich sind wie im Optimum.
    app = minimize_scalar(lambda k: f(x, k), bounds=(0.05, 3), method='bounded', options={'xatol': 1e-6}).fun
    opt = optimum(c, ids, profil, c['ecZiel']).fun
    # Grobe Fehler fangen (vor 3.9.1 bis Faktor 57 bei EC 0,98); Stand 3.12 liegen alle Fälle bei höchstens 1,19.
    ok = app <= opt * 1.3 + 1e-6
    fehler += not ok
    print(f"{c['name']:22} {c['variante']:12} {c['saeure']:9} App {app:8.3f}  Optimum {opt:8.3f}  Verhältnis {app / opt:5.2f}  {'ok' if ok else 'FEHLER'}")
print(f"{fehler} Fehler."); sys.exit(1 if fehler else 0)
