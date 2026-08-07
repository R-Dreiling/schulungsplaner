# HANDOFF — Schulungsplaner v3 Phase 2

Stand: Ende der Session, Branch `feature/kurs-termin-buchung`, HEAD `0aa2f54`.
Arbeitsbaum sauber, **keine Datei in einem halbfertigen Zustand**.

Nach Abschluss von Phase 2 kam auf Wunsch der Nutzerin noch eine **Bedienungsanleitung**
auf die Hilfeseite (Commit `0aa2f54`): Überblick, Aufbau des Fensters, acht nummerierte
Schritte vom Trainer bis zum Abschlussbericht, Wiederfinden, Sicherung, Start mit echten
Daten — gedacht für Leser ohne Vorwissen, etwa Geschäftspartner. Alle Aussagen sind gegen
den Code geprüft. Die Seite trägt jetzt zwei Bereiche: „Bedienungsanleitung" und
„Nachschlagen: wie das Programm rechnet".

**Phase 2 ist inhaltlich fertig (Tasks 1–10) und intern reviewt. Offen ist nur die
Abnahme durch die Nutzerin. Nicht vor der Abnahme nach `master` mergen.**

## Auftrag

Der **Schulungsplaner** ist ein lokales, serverloses Einzelplatz-Werkzeug für die tribeta
GmbH zur Planung und Nachweisführung von Schulungen (Datenschutz, Arbeitssicherheit,
Compliance). Eine einzige selbsterklärende `Berichte/index.html`, per Doppelklick
lauffähig, ohne Server und ohne Internetverbindung. Daten im `localStorage`, hochgeladene
Dateien in `IndexedDB`.

Übergeordnetes Ziel: aus einem reinen Planungstool ein **nachweisfähiges** System machen.
Für Datenschutz- und Arbeitssicherheitsschulungen muss auch Jahre später belegbar sein,
dass Schulung X am Datum Y mit Personen Z stattgefunden hat.

Bereits ausgeliefert:
- **v2**: Datenmodell Kurs → Termine → Buchungen, CRUD, Übersicht als Navigator,
  Schulungsdetail, Buchungsliste, Teilnehmer zwischen Terminen verschieben.
- **v3 Phase 1**: freie Kategorien, Format/Min-/Maxteilnehmerzahl am Kurs,
  „Unterbesetzt"-Kennzeichnung, Trainer-Bereich mit Nachweisdokumenten und
  Vertretungsdozent, Status-Automatik, Hilfeseite, „Alle Daten leeren".
- **v3 Phase 2** (diese und die vorige Session): Anwesenheitserfassung mit 80-%-Regel,
  Teilnahmebescheinigungen nach Kundenvorlage, formaler Abschluss mit Festschreibung und
  protokollierter Wiederöffnung, Abschlussbericht als Archivdokument, Filter für
  abgeschlossene Termine, Hilfeseite erweitert.

Maßgebliche Spezifikation: `Design/design-spec-v3.md`
Arbeitsplan mit vollständigem Code je Task: `Design/implementation-plan-v3-phase2.md`

## Stand

### FERTIG — alle 10 Tasks

| Task | Inhalt |
|---|---|
| 1 | `MINDEST_ANWESENHEIT`=80, `anwesenheitsBuchungen`, `erfuelltMindestteilnahme`, `anwesenheitSetzen`, `alleAnwesenheitAufVoll`, `anwesenheitStatistik`, Zertifikatsnummern |
| 2 | `istTerminAbgeschlossen`, `pruefeTerminOffen`, `abschlussVollstaendigkeit`, `terminAbschliessen`, `terminWiedereroeffnen` + Guards in 9 Mutatoren |
| 3 | Druckinfrastruktur: `logo.b64.txt`, `#druck-bereich`, `druckeInhalt()`, `@media print` |
| 4 | Anwesenheitsabschnitt auf der Detailseite |
| 5 | `druck-vorlagen.js`: Bescheinigung + Knopf je Teilnehmerzeile |
| 6 | Abschluss-Dialog, Banner, Wiederöffnen, `detailVersuche()`, Orphan-Schutz |
| 7 | `abschlussberichtHtml`, `druckeAbschlussbericht` + Knopf im Banner |
| 8 | Filter „Termine: Alle / Nur offene / Nur abgeschlossene" + „Bericht"-Knopf je Termin |
| 9 | Hilfeseite um Anwesenheit/Bescheinigungen und Abschluss/Bericht erweitert |
| 10 | Ende-zu-Ende-Verifikation der Nachweiskette + finale Review (4 Funde, alle gefixt) |

Fortschrittsprotokoll mit allen Messwerten: `.superpowers/sdd/implementation-plan-v3-phase2/progress.md`

### Die vier Funde aus Task 10 (alle behoben und gegengeprüft)

1. **`.anw-row` und `.abschluss-banner` wurden nie geschlossen** (Commit `be2d7e0`).
   Beide sind `display:flex`, also rutschte jede Anwesenheitszeile in die vorherige und
   das Banner umschloss den kompletten Rest der Detailseite. Ursache: der Ersatzblock aus
   Task 5 endete auf dem schließenden `</div>` der Zeile und lieferte nur eines zurück.
   Dabei ging auch der sichtbare Hinweis „unter 80 %" verloren — die CSS-Klasse
   `.anw-hinweis` blieb als toter Code stehen, der Grund stand nur noch im Tooltip.
   Wieder eingebaut als „unter 80 % — keine Bescheinigung" unter dem Namen.
2. **Vier Handler außerhalb der Detailseite ohne `detailVersuche`** (Commit `dcaff7a`):
   Termin bearbeiten/löschen (Schulungen), Buchung entfernen/neue Buchung (Buchungen).
   Der Schreibschutz griff datenseitig, für die Nutzerin passierte sichtbar nichts.
   `detailVersuche` liefert jetzt `true`/`false`; Dialoge schließen nur bei Erfolg.
3. **Orphan-Fehler auf der Buchungsseite** (Commit `dcaff7a`): „Neue Buchung" mit „Neue
   Person" legte diese an, bevor `erstelleBuchung` ablehnte. Riegel vor
   `erstelleTeilnehmer`; abgeschlossene Termine sind im Dialog nicht mehr wählbar.
4. **`statusAutomatikAnwenden` prüfte `termin.abschluss`** statt `istTerminAbgeschlossen`
   (Commit `dcaff7a`) — nach dem Wiederöffnen blieb die Automatik dauerhaft aus.

Funde 1–3 sind dieselbe Klasse wie frühere Funde, die an einer Stelle behoben und an
anderen nicht nachgezogen wurden. **Wer hier weiterarbeitet: bei jedem Fix prüfen, ob
dasselbe Muster an weiteren Aufrufstellen steht.**

### IN ARBEIT

**Nichts.** `git status` ist leer, HEAD `dcaff7a`, Build byte-identisch reproduzierbar.

### OFFEN

- **Nutzer-Abnahme.** Die Nutzerin sieht sich die fertige Phase 2 vollständig an und
  entscheidet danach über den Merge nach `master`. Vorher **nicht** mergen.
- Danach: Merge-Entscheidung, ggf. Phase 3.

## Nächster Schritt

Auf die Rückmeldung der Nutzerin warten. Zur Vorbereitung nichts weiter nötig — die
gebaute `Berichte/index.html` ist aktuell, `localStorage` wurde geleert, die App startet
also mit den Beispieldaten.

Kommt Feinabstimmung zurück: Quelle in `Design/` ändern, `python Design/assemble.py`,
im Browser prüfen, committen (immer inklusive `Berichte/index.html`).

## Betroffene Dateien

Alle Pfade relativ zu `C:\Users\User\Desktop\Persönlich\Claude Code\Projekt-Systeme\Schulungsplanner\`.

| Datei | Was und warum |
|---|---|
| `Design/state-engine.js` | Anwesenheits- und Abschlusslogik, Zertifikatsnummern, Schreibschutz-Guards, Status-Automatik. Kern der Nachweislogik. |
| `Design/fragments/druck-vorlagen.js` | Bescheinigung und Abschlussbericht als HTML. Kein Seiten-Fragment, wird aber wie eines gebündelt. |
| `Design/fragments/page-schulungdetail.js` | Anwesenheitsabschnitt, Abschluss-Dialog/Banner/Wiederöffnen, `detailVersuche()`, Orphan-Schutz. |
| `Design/fragments/page-schulungen.*` | Abschluss-Filter, „Bericht"-Knopf, Schreibschutz-Meldungen. |
| `Design/fragments/page-buchungen.js` | Schreibschutz-Meldungen, Orphan-Riegel, abgeschlossene Termine im Dialog gesperrt. |
| `Design/fragments/page-hilfe.html` | Zwei Abschnitte zu Anwesenheit/Bescheinigungen und Abschluss/Bericht. |
| `Design/shell-template.html` | `#druck-bereich`, `window.LOGO_NORMAL`, `druckeInhalt()`; Vorschaurahmen in `@media screen`. |
| `Design/styles.css` | Anwesenheits-, Abschluss-, Bescheinigungs- und Berichtsklassen inklusive `@media print`. |
| `Design/assemble.py` | Liest `logo.b64.txt`; bündelt `druck-vorlagen.js` mit den Seiten-Skripten. |
| `Berichte/index.html` | Generiert. **Niemals von Hand bearbeiten** — immer `python Design/assemble.py`. |

**Unverändert:** `Daten/schulungsdaten.json` (auf v3 migriert, per `verify_migration_v3.py`
geprüft, keine Testrückstände), `Design/ui-helpers.js`, `Design/file-store.js`,
`page-uebersicht.*`, `page-trainer.*`, `Design/migrate_data*.py`.

## Entscheidungen

1. **Druck über einen versteckten Bereich im selben Dokument** (`#druck-bereich` +
   `@media print`), nicht über ein zweites Fenster: funktioniert offline zuverlässig,
   keine Popup-Blocker, keine Zusatzbibliothek.
2. **Zertifikatsnummer erst beim tatsächlichen Druck.** Schema `JAHR-KÜRZEL-LAUFNUMMER`,
   Laufnummer ist das **letzte** Bindestrich-Segment (Kürzel dürfen Bindestriche
   enthalten, z. B. `DSGVO-FK`). Start bei 147, damit der ersten Bescheinigung nicht
   anzusehen ist, dass sie die erste ist. `zertifikatHtml` wird ausschließlich aus
   `druckeZertifikat` aufgerufen — beim Rendern von Listen entstehen keine Nummern.
3. **Bescheinigungen ausschließlich einzeln.** Ein Sammel-PDF würde beim Versand an eine
   Person die Daten aller anderen mitliefern. Der Abschlussbericht ist bewusst das
   Gegenteil — alle Teilnehmer, aber **internes** Archivdokument.
4. **`istTerminAbgeschlossen` prüft `abschluss` UND `status === 'abgeschlossen'`.**
   Überall wo der Sperrzustand gebraucht wird, diese Funktion benutzen, **nie**
   `!!termin.abschluss`. Einzige Ausnahme: das Abschluss-Banner erscheint bei vorhandenem
   `abschluss`, damit die Historie sichtbar bleibt.
5. **`terminAbschliessen` übernimmt eine vorhandene `wiedereroeffnungen`-Historie**,
   statt sie zu überschreiben.
6. **`loescheKurs` bekommt bewusst KEINEN Schreibschutz-Guard.**
7. **Vorschaurahmen-Regeln in `@media screen` gekapselt**, sonst hätten sie den
   `@media print`-Block überstimmt.
8. **Erst escapen, dann Platzhalter ersetzen.** Geschweifte Klammern überstehen `escHtml`
   unverändert.
9. **Der Abschluss-Filter arbeitet über `istTerminAbgeschlossen`, nicht über
   `t.abschluss`** (Abweichung vom Planentwurf): ein wiedereröffneter Termin ist wieder
   offene Arbeit und gehört unter „Nur offene". Der Berichts-Knopf hängt weiter an
   `termin.abschluss`, damit der Bericht als Nachweisspur erreichbar bleibt.

## Verworfene Ansätze

- **`istTerminAbgeschlossen` nur über `termin.abschluss`**: sperrt nach dem Wiederöffnen
  dauerhaft. **Nur über `termin.status`**: sperrt die Seed-Termine `s5`/`s7` fälschlich.
- **`@media print` ohne Kapselung der Vorschaurahmen-Regeln**: wirkungslos, per CSSOM belegt.
- **Platzhalter-Zeichenfolge (doppelte geschweifte Klammern) in einem Kommentar**:
  `assemble.py` ersetzt per naivem `str.replace` über das **ganze** Dokument — der
  Kommentar wird mitersetzt und der Build zerstört. **Nie wiederholen.**
- **`window.print()` in der Vorschau aufrufen**: blockiert. Druckvorlagen stattdessen per
  `#druck-bereich`-Injektion prüfen.

## Blocker & offene Fragen

**Keine Blocker.**

Für die Abnahme vorgemerkt (nicht blockierend):

1. **Dateiname beim Drucken** — `druckeZertifikat` und `druckeAbschlussbericht` ersetzen
   im Dateinamensvorschlag nur Leerzeichen. Ein Kurstitel mit `/ \ : * ? " < > |` ergäbe
   einen dateisystem-unfreundlichen Vorschlag; der Browser bereinigt das üblicherweise
   selbst. Als Minor im Ledger vermerkt.
2. **Legacy-Seed-Termine `s5`/`s7`** tragen `status: 'abgeschlossen'` ohne
   `abschluss`-Objekt. Sie erscheinen deshalb unter „Nur offene" — inhaltlich richtig
   (formell nie abgeschlossen), ihr Status-Badge sagt aber etwas anderes. Nur ein
   Beispieldaten-Artefakt; falls es stört, lässt es sich in den Seed-Daten glattziehen.

Bereits geklärt, **nicht erneut fragen**:
- Mindestteilnahme **80 %** · Zertifikatszähler startet bei **147** ·
  Bestätigungsfrist **7 Tage** · kein Merge nach `master` vor der Abnahme.

## Nicht anfassen

| Bereich | Warum |
|---|---|
| `Berichte/index.html` von Hand | Generiert. Ausschließlich über `python Design/assemble.py`. |
| `Daten/schulungsdaten.json` | Auf v3 migriert und geprüft. Die Migrationsskripte sind Einmal-Skripte und dürfen **nicht** erneut laufen. |
| `Design/logo-invers.b64.txt` | Weißes Logo für die dunkle Titelleiste. Für Druck wird `logo.b64.txt` benutzt. Nicht vertauschen. |
| `loescheKurs` in `state-engine.js` | Bewusst ohne Schreibschutz-Guard, siehe Entscheidung 6. |
| `git stash@{0}` | Obsoleter Rest aus Phase 1; die Arbeit wurde sauber neu ausgeführt und ist committet. |

## Umgebung

**Branch:** `feature/kurs-termin-buchung` (Basis: `master`, Merge-Base `14b93d4`)
**HEAD:** `0aa2f54` — `docs: Bedienungsanleitung auf der Hilfeseite`
**git status:** sauber · **Remote:** keiner (rein lokales Repository)

**Build:** `python Design/assemble.py` — aktuell reproduzierbar (byte-identisch).
**Datenprüfung:** `python Design/verify_migration_v3.py` — grün.

**Automatisierte Tests:** Es gibt **keine**. Kein Node.js, kein JS-Testrunner, keine CI.
Die einzigen ausführbaren Prüfungen sind die beiden Python-Skripte. Alle UI-Verifikation
läuft manuell im Browser über die Claude-Browser-Werkzeuge gegen
`file:///C:/Users/User/Desktop/Pers%C3%B6nlich/Claude%20Code/Projekt-Systeme/Schulungsplanner/Berichte/index.html`.

**Zwei Prüftechniken aus dieser Session, die sich bewährt haben:**
- **Tagbalance statisch**: je Funktion die öffnenden und schließenden Tags zählen
  (Achtung Falsch-Positiv bei `<td${…}>` — Regex braucht `(?=[\s>$])`).
- **Tagbalance dynamisch**: das erzeugte HTML vom Browser parsen lassen und die
  schließenden Tags vorher/nachher vergleichen. Ergänzt der Parser welche, fehlten sie.
  Nicht über die String-Länge vergleichen — Attribut-Normalisierung (`disabled` →
  `disabled=""`) erzeugt sonst Rauschen.

**Umgebungs-Eigenheiten, die Zeit kosten wenn man sie nicht kennt:**
- Die Vorschau unterdrückt natives `confirm()`/`alert()`. Für Abläufe, die darauf warten:
  `window.confirm = () => true` in der Konsole setzen und das offenlegen.
- Die Vorschau liefert auf diesem `file://`-Pfad **nachweislich** veralteten
  In-Memory-Zustand nach einem Reload — in dieser Session mit 2 Zertifikatsnummern
  aufgefallen, die längst zurückgesetzt waren. Workaround und Gegenprobe:
  `window.STATE = JSON.parse(JSON.stringify(window.SEED_DATA))`.
- `window.print()` blockiert — nicht aufrufen.
- Bash zeigt Umlaute falsch an, auch wenn die Datei korrekt ist. Immer am Dateiinhalt
  prüfen (Python `repr()` / Read-Werkzeug), nie an der Terminalausgabe.
