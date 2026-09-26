"""Stellt das Rezept der App gegen eine unabhängige Optimierung (scipy, SLSQP mit Mehrfachstart).

Gleiche Salze, gleiches EC-Modell, gleiche Zielfunktion wie im Solver der App – nur dass hier
Salzmengen und Faktor k gemeinsam optimiert werden, bei fest vorgegebener Ziel-EC.
Aufruf: python3 tests/vergleich_optimum.py   (braucht node, numpy, scipy)
"""
import json, subprocess, sys, pathlib
import numpy as np
from scipy.optimize import minimize

HIER = pathlib.Path(__file__).parent
JS = r"""
const { D, K } = require('./laden');
const liter = K.liter(D.eimer, D.eimer.zielFuell), kal = D.kalibrierung, w = D.wasser;
const sa = K.saeure(w, D.saeure, kal);
const faelle = [];
for (const phase of Object.keys(D.phasen)) for (const typ of ['photo', 'auto']) for (const st of Object.keys(D.staerke)) {
  const ecZiel = K.zielEC(D, phase, typ, st), r = K.rezept(D, { phase, liter, ecZiel });
  faelle.push({ name: `${phase}/${typ}/${st}`, phase, ecZiel, k: r.faktorK, mengen: r.mengen.map(m => [m.id, m.gProL]) });
}
console.log(JSON.stringify({ faelle, salze: D.salze, profile: Object.fromEntries(Object.entries(D.phasen).map(([p, v]) => [p, v.profil])),
  basis: { N: w.NO3 + w.NH4 + sa.N, NH4: w.NH4, P: w.P + sa.P, K: w.K, Ca: w.Ca, Mg: w.Mg, S: w.S },
  ecFix: w.ecGemessen + kal.ecProMmolSaeure * sa.mmol, ecWasser: w.ecGemessen, ecSalzFaktor: kal.ecSalzFaktor }));
"""
m = json.loads(subprocess.run(['node', '-e', JS], cwd=HIER, capture_output=True, text=True, check=True).stdout)
MAKRO = ['N', 'P', 'K', 'Ca', 'Mg', 'S']
GEWICHT = dict(N=3, P=1, K=3, Ca=3, Mg=1.5, S=0.5); MILD = {'P', 'S', 'Ca', 'Mg'}
MOL = dict(K=39.098, Ca=40.078, Mg=24.305, N=14.007)
B = m['basis']

def gehalt(s, e): return s.get('NO3', 0) + s.get('NH4', 0) if e == 'N' else s.get(e, 0)

def modell(ids, profil, ecZiel):
    L = [next(s for s in m['salze'] if s['id'] == i) for i in ids]
    A = np.array([[gehalt(s, e) * 10 for s in L] for e in MAKRO + ['NH4', 'Fe']])
    kat = np.array([gehalt(s, 'K') / MOL['K'] + 2 * gehalt(s, 'Ca') / MOL['Ca'] + 2 * gehalt(s, 'Mg') / MOL['Mg'] + gehalt(s, 'NH4') / MOL['N'] for s in L])
    feMin = min(0.8, max(0.25, 0.5 * (ecZiel - m['ecWasser'])))
    ec = lambda x: m['ecFix'] + m['ecSalzFaktor'] * (kat @ x)
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

def optimum(ids, profil, ecZiel, starts=40):
    L, ec, f = modell(ids, profil, ecZiel); rng = np.random.default_rng(0); best = None
    for _ in range(starts):
        z0 = np.r_[rng.uniform(0, 0.4, len(L)), rng.uniform(0.2, 1.2)]
        r = minimize(lambda z: f(z[:-1], z[-1]), z0, method='SLSQP', bounds=[(0, None)] * len(L) + [(0.05, 3)],
                     constraints=[{'type': 'eq', 'fun': lambda z: ec(z[:-1]) - ecZiel}], options={'maxiter': 2000, 'ftol': 1e-12})
        if r.success and abs(ec(r.x[:-1]) - ecZiel) < 1e-6 and (best is None or r.fun < best.fun): best = r
    return best

fehler = 0
for c in m['faelle']:
    if c['ecZiel'] - m['ecFix'] < 0.1: print(f"{c['name']:22} übersprungen (Ziel-EC kaum über Wasser + Säure)"); continue
    # Die Optimierung darf alle Salze nehmen, die die App für diesen Fall zur Auswahl hatte
    ids = [s['id'] for s in m['salze'] if s.get('aktiv', True) and not s.get('nurMitSalpeter')]
    profil = m['profile'][c['phase']]
    _, _, f = modell([i for i, _ in c['mengen']], profil, c['ecZiel'])
    app = f(np.array([g for _, g in c['mengen']]), c['k'])
    opt = optimum(ids, profil, c['ecZiel']).fun
    # Die App wählt k so, dass die EC stimmt, nicht so, dass die Zielfunktion minimal wird. Das kostet bis
    # etwa Faktor 1,5 (Stand 3.9.1). Die Grenzen fangen grobe Fehler (vor 3.9.1 bis Faktor 57 bei EC 0,98).
    grenze = 10 if c['phase'] == 'anzucht' else 2  # Anzucht: sehr wenig EC für Salze übrig, grob genügt
    ok = app <= opt * grenze + 1e-6
    fehler += not ok
    print(f"{c['name']:22} App {app:8.3f}  Optimum {opt:8.3f}  Verhältnis {app / opt:5.2f}  {'ok' if ok else 'FEHLER'}")
print(f"{fehler} Fehler."); sys.exit(1 if fehler else 0)
