# HydroAPP (Hydro-Assistent)

Nährlösungs-Rechner und Tagebuch für Hydroponik-Tanks: Neu ansetzen, Nachfüllen, Mischanleitung, Tagebuch, Pflanzendoktor, Erntekalender.

Alle Daten bleiben auf dem Handy (im Browser gespeichert). Nichts wird an einen Server geschickt.
Sicherung: Einstellungen → App & Sicherung → „Sicherung speichern“ / „Sicherung laden“.

Neue Fassung einspielen: bei Netlify im Projekt unter „Deploys“ den ganzen Ordner hineinziehen. Vorher in der App „Sicherung speichern“.

Fassung 2.7.0: In der Blüte zwei neue Regler pro Tank (Rezept „Neu“, Sparmodus) und ein Hinweis in Blütewoche 6 bis 9.
Fassung 2.7.1: Spülen-Schalter in der Reife. Kaliwasserglas nur bis zur Blüte. Beim Neu ansetzen stehen N, P, K, Ca, Mg in mg/L unter der EC.
Fassung 3.0.0: Neue Ordnung. Vier Reiter: Tanks, Tagebuch, Hilfe, Einstellungen. Einstellungen in fünf Gruppen. Tankmaße lassen sich beim Neu ansetzen und Nachfüllen direkt ändern. Löschen und Werte ändern mit „Rückgängig“ statt Nachfrage. Neue Namen: Tank statt Behälter, Nachfüllen statt TOP-UP, Tagebuch statt Verlauf. Alle Rechnungen unverändert (198 Vergleichsfälle mit 2.7.1 geprüft).
Fassung 3.0.1: Erntekalender für Photos neu. Keimdatum (freiwillig) und Blütedauer eintragen, im Wachstum zählt die App die Tage seit Keimung. Mit „Blüte beginnt heute“ startet die Blüte, die Phase springt auf Blüte. Steht die Phase auf Blüte, obwohl die Blüte laut Kalender noch nicht begonnen hat, schlägt die App vor, zurück auf Wachstum zu stellen.
Fassung 3.1.0: Beim Tank ganz unten „Anbau beenden oder Tank entfernen“. Anbau beenden (geerntet mit Ertrag oder hat nicht geklappt, mit Notiz) macht den Tank frei, die alten Einträge und Fotos bleiben unter „Frühere Anbauten“ lesbar. Tank entfernen blendet ihn aus, das Tagebuch bleibt.
Fassung 3.2.0: „+ Eintragen“ auf jeder Tank-Karte und beim Tank: Messen, pH korrigiert, Zusatz gegeben, Notiz, Foto, dazu Nachfüllen und Neu ansetzen. Jeder Eintrag lässt sich antippen, ändern (auch Datum und Uhrzeit) oder löschen, mit Vermerk „geändert“. Tagebuch: erst Tank wählen, dann Zeitleiste nach Tagen mit Fotos, EC-Kurve und Filtern. Phasenwechsel landen automatisch im Tagebuch.
Fassung 3.3.0: Messrunde durch alle Tanks (Füllstand, EC, pH, Überspringen, Zurück, jederzeit aufhören, am Ende Übersicht, alles auf einmal rückgängig). Auf jeder Tank-Karte „Seit dem letzten Mal“ mit Litern, EC- und pH-Änderung, dazu ein Satz, was zu tun ist, und der passende Knopf (Nachfüllen, pH korrigieren oder Messen). Beim Nachfüllen sind frisch gemessene Werte schon eingetragen.
Fassung 3.4.0: Pflanzendoktor mit zwei Wegen: Symptome auswählen oder alle 20 Probleme zum Nachschlagen, jeweils mit „Woran du es erkennst“, „Warum es passiert“ und „Was du tun kannst“, speicherbar als Eintrag beim Tank. Kleine „?“ an wichtigen Stellen mit kurzen Erklärungen, gesammelt unter Hilfe → Kurz erklärt.
Fassung 3.5.0: Wasserquellen. Neben dem Leitungswasser lassen sich Osmosewasser, Regenwasser oder eigene Quellen anlegen und zwei Wasser mischen (25/50/75 %). Wasser gilt für alle Tanks, kann pro Tank abweichen und beim Neu ansetzen oder Nachfüllen einmalig geändert werden. Mischanleitung und Eintrag nennen das verwendete Wasser. Mehr Analysewerte fürs Leitungswasser (Kalium, Nitrat). Mit nur Leitungswasser rechnet die App exakt wie vorher.
Fassung 3.6.0: Beim Neu ansetzen zeigt die Mischanleitung N, P, K, Ca, Mg als Balken mit dem guten Bereich der Phase (grün im Bereich, gelb etwas daneben), bei Calcium und Co. auch den Anteil aus dem Wasser. Beim Nachfüllen mit Nährlösung steht, wie viel mg/L im ganzen Tank dazukommen. Beim Nachfüllen mit Wasser ein kurzer Satz, dass nur verdünnt wird.
Fassung 3.6.1: Anleitung komplett überarbeitet, passend zur neuen Ordnung (17 Abschnitte, beginnend mit „So läuft der Alltag“).
Fassung 3.7.0: Vier neue Salze zur Auswahl: Magnesiumnitrat, Kaliumsulfat, Ammoniumsulfat, Monoammoniumphosphat. Bei hartem oder weichem Wasser zeigt Einstellungen → Salze & Zusatz, welche Salze besonders gut passen und warum. Bei mittlerem Wasser bleibt es ruhig.
Fassung 3.8.0: Schwefelsäure als dritte Säure (z. B. Batteriesäure 37 %), bringt Schwefel statt Phosphor oder Stickstoff. Bei hartem Wasser mit Phosphorsäure weist die App darauf hin. Die EC-Schätzung mit Schwefelsäure ist noch nicht an echten Mischungen geprüft, die App sagt das in der Anleitung.
Fassung 3.8.1: Bei schwachem Empfang wartet die App höchstens 3 Sekunden aufs Netz und startet dann aus dem Speicher; das Update kommt trotzdem im Hintergrund an.
Fassung 3.9.0: Logo. Neues App-Symbol (Pflanze im Topf, auch als runde Android-Variante), großes Logo mit Begrüßung auf dem ersten Einrichtungsschritt, kleines Logo oben in der Hilfe.
Fassung 3.9.1: Rezept-Rechnung bei niedriger Ziel-EC korrigiert. Bei der Wahl der Volldünger zählen jetzt Ammonium-Grenze und Eisen-Minimum mit (vorher z. B. im Wachstum bei EC 0,98 nur Soft Elite: 19 % Ammonium, zu wenig Eisen und Magnesium). Stammdaten ohne persönliche Angaben, Speichern nur noch auf dem Gerät.

Fassung 3.10.0: Eigene Werte sind Pflicht. Die Einrichtung (jetzt fünf Schritte) verlangt die eigene Wasseranalyse (EC, pH, Karbonathärte, Calcium, Magnesium, Sulfat; Kalium und Nitrat freiwillig), startet ohne vorausgewählte Salze und lässt die Gehalte jedes Salzes in Etikett-Einheiten (P₂O₅, K₂O, CaO, MgO, SO₃) prüfen. Gehalte lassen sich auch später unter Einstellungen → Salze & Zusatz ändern. Sicherheits- und Haftungshinweise zu Säuren mit Pflicht-Bestätigung, in der Anleitung und in jeder Mischanleitung mit Säure. Nitrat und Sulfat werden wie im Wasserbericht eingetragen (vorher wurde Nitrat versehentlich als Stickstoff gerechnet). Bestehende Stände behalten ihre Werte und gehen die Einrichtung einmal durch.

Tests: `node tests/rezept.test.js` prüft alle Phasen und Stärken, `node tests/schwefel.test.js` den Schwefelsäure-Zweig. `python3 tests/vergleich_optimum.py` stellt die App gegen eine unabhängige Optimierung (braucht numpy und scipy).

## Sicherheit und Haftung

Säuren sind ätzend: Schutzbrille und Handschuhe, Säure immer ins Wasser, nie mit anderen Säuren oder Chlorreinigern mischen. Die App ist eine Rechenhilfe ohne Gewähr. Soweit gesetzlich zulässig, wird keine Haftung für Schäden an Gesundheit, Pflanzen oder Sachen übernommen, die aus der Anwendung der Ergebnisse entstehen. Maßgeblich sind die Etiketten und Sicherheitsdatenblätter der verwendeten Produkte.
