# HANDOFF — Schulungsplaner v3 Phase 2

Stand: Ende der Session, Branch `feature/kurs-termin-buchung`, HEAD `72177bd`.
Arbeitsbaum sauber, **keine Datei in einem halbfertigen Zustand**.

## Auftrag

Der **Schulungsplaner** ist ein lokales, serverloses Einzelplatz-Werkzeug für die tribeta
GbR zur Planung und Nachweisführung von Schulungen (Datenschutz, Arbeitssicherheit,
Compliance). Eine einzige selbsterklärende `Berichte/index.html`, per Doppelklick
lauffähig, ohne Server und ohne Internetverbindung. Daten im `localStorage`, hochgeladene
Dateien in `IndexedDB`.

Übergeordnetes Ziel: aus einem reinen Planungstool ein **nachweisfähiges** System machen.
Für Datenschutz- und Arbeitssicherheitsschulungen muss auch Jahre später belegbar sein,
dass Schulung X am Datum Y mit Personen Z stattgefunden hat.

Bereits ausgeliefert (frühere Phasen, alle auf diesem Branch):
- **v2**: Datenmodell Kurs → Termine → Buchungen, CRUD, Übersicht als Navigator,
  Schulungsdetail, Buchungsliste, Teilnehmer zwischen Terminen verschieben.
- **v3 Phase 1**: freie Kategorien, Format/Min-/Maxteilnehmerzahl am Kurs,
  „Unterbesetzt"-Kennzeichnung, Trainer-Bereich mit Nachweisdokumenten und
  Vertretungsdozent, Status-Automatik, Hilfeseite, „Alle Daten leeren".

**Diese Session: v3 Phase 2 — Durchführung & Nachweis.** Anwesenheitserfassung mit
80-%-Regel, Teilnahmebescheinigungen nach der Kundenvorlage, formaler Schulungsabschluss
mit Festschreibung und protokollierter Wiederöffnung, Abschlussbericht als Archivdokument.

Maßgebliche Spezifikation: `Design/design-spec-v3.md`
Arbeitsplan mit vollständigem Code je Task: `Design/implementation-plan-v3-phase2.md`

## Stand

### FERTIG (Tasks 1–7 von 10)

Jeder Task wurde einzeln von einem Review-Subagenten geprüft; Findings wurden in
Fix-Runden behoben und per Scoped-Re-Review nachverifiziert. Fortschrittsprotokoll:
`.superpowers/sdd/implementation-plan-v3-phase2/progress.md`

| Task | Inhalt | Verifiziert wodurch |
|---|---|---|
| 1 | `MINDEST_ANWESENHEIT`=80, `anwesenheitsBuchungen`, `erfuelltMindestteilnahme`, `anwesenheitSetzen`, `alleAnwesenheitAufVoll`, `anwesenheitStatistik`, `naechsteZertifikatNummer`, `zertifikatNummerFuer` | Review: Kürzel-mit-Bindestrich-Parsing (`DSGVO-FK`) gezielt geprüft, Idempotenz der Nummernvergabe belegt |
| 2 | `istTerminAbgeschlossen`, `pruefeTerminOffen`, `abschlussVollstaendigkeit`, `terminAbschliessen`, `terminWiedereroeffnen` + Schreibschutz-Guards in 9 bestehenden Mutatoren | Live im Browser: 3-Fälle-Matrix (Legacy-Seed / frisch abgeschlossen / wiedereröffnet), Doppelabschluss-Ablehnung, Historie bleibt erhalten |
| 3 | Druckinfrastruktur: `Design/logo.b64.txt`, `{{LOGO_NORMAL_B64}}`, `#druck-bereich`, `druckeInhalt()`, `@media print` | CSSOM-Analyse: `screen`-Media-Rule Index 185, keine unkonditionale `body`-flex-Regel mehr, kein Stylesheet-Duplikat |
| 4 | Anwesenheitsabschnitt auf der Detailseite (Prozent, Fehlgrund, „Alle auf 100 %") | Live: Summary-String in allen drei Zuständen, 100 % löscht Fehlgrund und graut Auswahl aus |
| 5 | `Design/fragments/druck-vorlagen.js`: `zertifikatPlatzhalterFuellen`, `zertifikatHtml`, `druckeZertifikat` + Knopf je Teilnehmerzeile | Controller-Messung live: `textContent` zeigt `& <i>Praxis</i>` wie getippt, `innerHTML` genau einmal kodiert, 0 `<i>`-Elemente |
| 6 | Abschluss-Dialog, Banner, Wiederöffnen + `detailVersuche()`-Helfer + Orphan-Schutz | Live: Orphan-Test `teilnehmer` 34→34, Buchungen 6→6, Alert erscheint; auf offenem Termin kein Over-Blocking |
| 7 | `abschlussberichtHtml`, `druckeAbschlussbericht` + Bericht-Knopf im Banner | Live: alle Teilnehmer enthalten, drei Zertifikatszustände korrekt, Wiedereröffnungs-Warnung mit Datum, XSS-Payload in 10 Feldern escaped, `abschluss=null` wirft nicht |

Zusätzlich vom Controller unabhängig gegengeprüft (nicht nur Subagent-Berichte geglaubt):
- `python Design/assemble.py` erzeugt eine **byte-identische** `Berichte/index.html` →
  der committete Build stimmt mit den Quellen überein
- `python Design/verify_migration_v3.py` läuft grün
- Keine offenen `{{`-Platzhalter, kein Stylesheet-Duplikat im Build

### IN ARBEIT

**Nichts.** Es liegt keine Datei in einem halbfertigen oder inkonsistenten Zustand.
`git status` ist leer, HEAD `72177bd`, Build reproduzierbar.

### OFFEN (Tasks 8–10 + Abschluss)

- **Task 8** — Filter „Nur abgeschlossene" auf der Schulungen-Seite + „Bericht"-Knopf
  je abgeschlossenem Termin. Vollständiger Code im Plan, Abschnitt `## Task 8`.
- **Task 9** — Hilfeseite um zwei Abschnitte erweitern (Anwesenheit/Bescheinigungen,
  Abschluss/Abschlussbericht). Vollständiges HTML im Plan, Abschnitt `## Task 9`.
- **Task 10** — Zusammenbau + Ende-zu-Ende-Verifikation der kompletten Nachweiskette.
  Ablauf im Plan, Abschnitt `## Task 10`.
- **Danach**: finale Whole-Branch-Review (Phase 2), dann Nutzer-Abnahme, dann
  Merge-Entscheidung nach `master`.

**Der Nutzer hat ausdrücklich gesagt:** erst Phase 2 komplett fertigstellen, dann
schaut er sich die App vollständig an, dann wird über den Merge entschieden.
**Nicht vorher nach `master` mergen.**

## Nächster Schritt

Task 8 ausführen. Konkret:

1. Brief erzeugen:
   ```bash
   bash "C:/Users/User/.claude/plugins/cache/claude-plugins-official/superpowers/6.2.0/skills/subagent-driven-development/scripts/task-brief" "Design/implementation-plan-v3-phase2.md" 8
   ```
   Schreibt nach `.superpowers/sdd/implementation-plan-v3-phase2/task-8-brief.md`.

2. Öffne `Design/fragments/page-schulungen.html` und ergänze in der `filter-bar`,
   **nach** dem Kategorie-Filter (`<select id="schulungen-kategorie-filter" …>`),
   dieses Element:
   ```html
   <select id="schulungen-abschluss-filter" class="filter-select" onchange="renderSchulungen()">
     <option value="">Termine: Alle</option>
     <option value="offen">Nur offene</option>
     <option value="abgeschlossen">Nur abgeschlossene</option>
   </select>
   ```

3. Öffne `Design/fragments/page-schulungen.js`:
   - Ersetze die Funktion `schulungenGefilterteKurse` vollständig durch die Version
     im Plan (Task 8, Step 2) — sie berücksichtigt zusätzlich den Abschluss-Filter.
   - Füge die neue Funktion `schulungenGefilterteTermine(kurs)` hinzu (Code im Plan).
   - Ersetze in `renderSchulungen` den Ausdruck
     `kurs.termine.map(t => schulungenTerminZeile(kurs, t)).join('')` durch
     `schulungenGefilterteTermine(kurs).map(t => schulungenTerminZeile(kurs, t)).join('')`
     und die Bedingung `kurs.termine.length === 0` durch
     `schulungenGefilterteTermine(kurs).length === 0`.
   - Ergänze in `schulungenTerminZeile` in der Aktionsspalte **vor** dem „Öffnen"-Knopf:
     ```javascript
     ${termin.abschluss ? `<button class="btn" onclick="druckeAbschlussbericht('${escJsArg(termin.id)}')">Bericht</button>` : ''}
     ```

4. `python Design/assemble.py`, dann im Browser gegen die Checkliste in Task 8 Step 3
   prüfen, dann committen mit der Nachricht aus Task 8 Step 4 (inklusive
   `Berichte/index.html`).

## Betroffene Dateien

Alle Pfade relativ zu `C:\Users\User\Desktop\Persönlich\Claude Code\Projekt-Systeme\Schulungsplanner\`.

**In dieser Session geändert (Phase 2):**

| Datei | Was und warum |
|---|---|
| `Design/state-engine.js` | +175 Zeilen: Anwesenheitsfunktionen, Zertifikatsnummern, Abschluss/Wiederöffnung, `pruefeTerminOffen`-Guards in 9 bestehenden Mutatoren. Kern der Nachweislogik. |
| `Design/fragments/druck-vorlagen.js` | **NEU**, 168 Zeilen: baut Bescheinigung und Abschlussbericht als HTML. Kein Seiten-Fragment, wird aber wie eines gebündelt. |
| `Design/fragments/page-schulungdetail.js` | +239 Zeilen: Anwesenheitsabschnitt, Abschluss-Dialog/Banner/Wiederöffnen, `detailVersuche()`-Helfer, Orphan-Schutz, Bescheinigungs- und Berichts-Knöpfe. |
| `Design/shell-template.html` | `#druck-bereich`, `window.LOGO_NORMAL`, `druckeInhalt()`; Vorschaurahmen-Regeln in `@media screen` gekapselt. |
| `Design/styles.css` | +95 Zeilen: Anwesenheits-, Abschluss-, Bescheinigungs- und Berichtsklassen inklusive `@media print`. |
| `Design/assemble.py` | Liest `logo.b64.txt` → `{{LOGO_NORMAL_B64}}`; bündelt `druck-vorlagen.js` mit den Seiten-Skripten. |
| `Design/logo.b64.txt` | **NEU**: Base64 des **dunklen** tribeta-Logos (Ink `#0a1028`) für Druck auf weißem Papier. Nicht mit `logo-invers.b64.txt` verwechseln (weiß, für die dunkle Titelleiste). |
| `Design/implementation-plan-v3-phase2.md` | **NEU** zu Sessionbeginn, danach 6× korrigiert (siehe „Entscheidungen"). |
| `Berichte/index.html` | Generiert. **Niemals von Hand bearbeiten** — immer `python Design/assemble.py`. |

**Aus früheren Phasen, hier unverändert:** `Daten/schulungsdaten.json`,
`Design/ui-helpers.js`, `Design/file-store.js`, `Design/fragments/page-uebersicht.*`,
`page-buchungen.*`, `page-trainer.*`, `page-hilfe.html`, `page-schulungen.*`
(letztere werden in Task 8 angefasst), `Design/design-spec*.md`,
`Design/migrate_data*.py`, `Design/verify_migration*.py`.

## Entscheidungen

1. **Druck über einen versteckten Bereich im selben Dokument** (`#druck-bereich` +
   `@media print`), nicht über ein zweites Fenster. Grund: funktioniert offline
   zuverlässig, keine Popup-Blocker-Probleme, keine Zusatzbibliothek.

2. **Zertifikatsnummer wird erst beim tatsächlichen Druck vergeben**, nicht beim
   Anzeigen der Liste. Sonst würden Nummern für nie ausgestellte Bescheinigungen
   verbraucht. Schema `JAHR-KÜRZEL-LAUFNUMMER`, Laufnummer ist das **letzte**
   Bindestrich-Segment (ein Kürzel darf selbst Bindestriche enthalten, z. B. `DSGVO-FK`).
   Start bei `einstellungen.zertifikatStartNummer` = 147, damit der ersten
   Bescheinigung nicht anzusehen ist, dass sie die erste ist.

3. **Bescheinigungen werden ausschließlich einzeln erzeugt**, nie als Sammeldokument.
   Datenschutz: ein Sammel-PDF würde beim Versand an eine Person die Daten aller
   anderen mitliefern. Der Abschlussbericht ist bewusst das Gegenteil — er enthält
   alle Teilnehmer, ist aber ein **internes** Archivdokument.

4. **`istTerminAbgeschlossen` prüft `abschluss` UND `status === 'abgeschlossen'`.**
   Beide Bedingungen sind nötig: `terminWiedereroeffnen` behält das `abschluss`-Objekt
   absichtlich als Nachweisspur, setzt aber `status` zurück — eine Prüfung nur auf
   `abschluss` hätte den Termin nach dem Wiederöffnen **dauerhaft** gesperrt. Eine
   Prüfung nur auf `status` hätte die Seed-Termine `s5`/`s7` fälschlich gesperrt
   (die tragen `status: 'abgeschlossen'` aus der Migration, aber `abschluss: null`).
   **Überall wo der Sperrzustand gebraucht wird, `istTerminAbgeschlossen(id)` benutzen,
   niemals `!!termin.abschluss`.** Einzige Ausnahme: das Abschluss-Banner erscheint
   bei `termin.abschluss`, weil die Historie auch nach dem Wiederöffnen sichtbar
   bleiben soll — der Schreibschutz-Satz darin hängt aber an `istTerminAbgeschlossen`.

5. **`terminAbschliessen` übernimmt eine vorhandene `wiedereroeffnungen`-Historie**,
   statt sie zu überschreiben. Sonst hätte ein erneutes Abschließen die Spur der
   Wiederöffnung gelöscht — genau das, was die Spec sichtbar machen will.

6. **`loescheKurs` bekommt bewusst KEINEN Schreibschutz-Guard.** Einen ganzen Kurs mit
   allen Terminen zu löschen ist eine bewusste, separat bestätigte Aktion auf anderer
   Ebene; ein einzelner abgeschlossener Termin darin soll das nicht dauerhaft blockieren.

7. **Vorschaurahmen-Regeln in `@media screen` gekapselt.** Die Regeln
   `body { display:flex … }` / `.app-window { … }` im `shell-template.html` stehen
   **nach** dem eingefügten Basis-CSS und hätten den `@media print`-Block überstimmt
   (gleiche Spezifität, später gewinnt) — die Bescheinigung wäre zentriert auf grauem
   Grund gedruckt worden.

8. **Erst escapen, dann Platzhalter ersetzen.** In `zertifikatHtml` wird
   `escHtml(z.bestaetigungstext)` **vor** `zertifikatPlatzhalterFuellen` angewandt,
   und die eingesetzten Werte sind ebenfalls bereits escaped. Geschweifte Klammern
   überstehen `escHtml` unverändert, die Ersetzung greift also weiter. Andernfalls
   würde ein `&` oder `<` im frei konfigurierbaren Bescheinigungstext still als
   Markup interpretiert statt gedruckt.

9. **`detailVersuche(aktion)`-Helfer** fängt Schreibschutz-Ausnahmen ab und zeigt sie
   per `alert`. Ohne ihn passierte für die Nutzerin bei abgeschlossenem Termin
   scheinbar nichts, der Grund landete nur in der Konsole.

10. **Orphan-Schutz in `detailSpeichereTeilnehmerHinzufuegen`**: früher
    `istTerminAbgeschlossen`-Riegel **vor** `erstelleTeilnehmer`, plus Ausblenden des
    „+ Teilnehmer"-Knopfs bei abgeschlossenem Termin. Ein Wrap um `erstelleBuchung`
    allein reichte nicht — die Person war da schon angelegt und gespeichert.

## Verworfene Ansätze

- **`istTerminAbgeschlossen` nur über `termin.abschluss`** (so stand es ursprünglich im
  Plan): sperrt den Termin nach dem Wiederöffnen dauerhaft. Vom Implementierer gefunden,
  vom Controller gegen Code und Seed-Daten gegengeprüft.
- **…nur über `termin.status`**: sperrt die Seed-Termine `s5`/`s7` fälschlich, die aus
  der Migration `status: 'abgeschlossen'` bei `abschluss: null` tragen.
- **`@media print` ohne Kapselung der Vorschaurahmen-Regeln**: wirkungslos, siehe
  Entscheidung 7. Per CSSOM belegt (Print-Block Index 182, Vorschauregel Index 185).
- **Platzhalter-Zeichenfolge (doppelte geschweifte Klammern) in einem Kommentar**:
  `assemble.py` ersetzt Platzhalter per naivem `str.replace` über das **ganze** Dokument
  — der Kommentar wurde mitersetzt, das komplette Stylesheet in ihn hineindupliziert,
  der Kommentar schloss nie gültig, alles danach war tot. **Nie wiederholen.**
- **`window.print()` in der Vorschauumgebung aufrufen**: blockiert. Druckvorlagen
  stattdessen per `document.getElementById('druck-bereich').innerHTML = …html…`
  prüfen und das DOM auslesen.

## Blocker & offene Fragen

**Keine Blocker.** Nichts hindert daran, mit Task 8 weiterzumachen.

Zwei Punkte, zu denen der Nutzer irgendwann entscheiden sollte (nicht dringend,
nicht blockierend, gehören in die finale Review):

1. **Dateiname beim Drucken** — `druckeZertifikat` und `druckeAbschlussbericht` bauen
   den vorgeschlagenen Dateinamen aus Teilnehmer- bzw. Kursnamen und ersetzen nur
   Leerzeichen. Ein Kurstitel mit `/ \ : * ? " < > |` ergäbe einen
   dateisystem-unfreundlichen Vorschlag. Der Browser bereinigt das üblicherweise
   selbst. Als Minor im Ledger vermerkt.
2. **Die Nutzer-Abnahme steht noch aus.** Der Nutzer will die App nach Phase 2
   vollständig durchsehen, bevor gemerged wird.

Bereits geklärt, **nicht erneut fragen**:
- Mindestteilnahme ist **80 %**.
- Zertifikatszähler startet bei **147**.
- Bestätigungsfrist der Status-Automatik: **7 Tage**.
- Kein Merge nach `master` vor der Nutzer-Abnahme.

## Nicht anfassen

| Bereich | Warum |
|---|---|
| `Berichte/index.html` von Hand | Generiert. Ausschließlich über `python Design/assemble.py`. Handedits gehen beim nächsten Build verloren. |
| `Daten/schulungsdaten.json` | Bereits auf v3 migriert und per `verify_migration_v3.py` geprüft. Die Migrationsskripte sind Einmal-Skripte und dürfen **nicht** erneut laufen (sie brechen bewusst ab, wenn die Struktur schon migriert ist). |
| `Design/logo-invers.b64.txt` und `{{LOGO_B64}}` | Weißes Logo für die dunkle Titelleiste. Für Druck wird `logo.b64.txt` / `{{LOGO_NORMAL_B64}}` benutzt. Nicht vertauschen. |
| `loescheKurs` in `Design/state-engine.js` | Bewusst ohne Schreibschutz-Guard, siehe Entscheidung 6. |
| Felder `anwesenheitProzent`, `fehlgrund`, `zertifikatNr`, `abschluss` im Datenmodell | Wurden in Phase 1 angelegt, damit das Schema nicht zweimal migriert werden muss. Sind seit Phase 2 in Benutzung. |
| `git stash@{0}` | Enthält einen durch einen Serverfehler abgebrochenen Versuch aus **Phase 1** (`page-schulungen.html/.js`). Diese Arbeit wurde danach sauber neu ausgeführt und ist committet. Der Stash ist obsolet und kann gelöscht werden, wird aber sicherheitshalber nicht angefasst. |
| Alte Phase-1-Pläne und -Specs | `design-spec.md`, `design-spec-v3.md`, `implementation-plan.md`, `implementation-plan-v3-phase1.md` sind Aufzeichnungen des bereits Gebauten. |

## Umgebung

**Branch:** `feature/kurs-termin-buchung` (Basis: `master`, Merge-Base `14b93d4`)
**HEAD:** `72177bd` — `feat: Abschlussbericht als druckbares Archivdokument`
**git status:** sauber, **keine uncommitted changes**
**Stash:** `stash@{0}` — obsoleter Phase-1-Rest, siehe „Nicht anfassen"
**Remote:** keiner konfiguriert (rein lokales Repository)

**Build:**
```bash
python Design/assemble.py
```
Baut `Berichte/index.html` aus Shell + CSS + JS-Modulen + Fragmenten + Daten.
Aktuell **reproduzierbar**: ein erneuter Lauf erzeugt eine byte-identische Datei.

**Datenprüfung:**
```bash
python Design/verify_migration_v3.py
```
Aktuell **grün**: „v3-Migration verifiziert: keine Fehler."

**Automatisierte Tests:** Es gibt **keine**. Kein Node.js auf dieser Maschine, kein
JS-Testrunner, keine CI. Die einzigen ausführbaren Prüfungen sind die beiden
Python-Skripte oben. Alle UI-Verifikation läuft **manuell im Browser** über die
Claude-Browser-Werkzeuge (`mcp__Claude_Browser__*`) gegen
`file:///C:/Users/User/Desktop/Pers%C3%B6nlich/Claude%20Code/Projekt-Systeme/Schulungsplanner/Berichte/index.html`.

**Testlauf-Status:** grün, soweit prüfbar — beide Python-Skripte laufen fehlerfrei,
Build reproduzierbar, Tasks 1–7 jeweils live im Browser verifiziert (Details siehe
Tabelle unter „FERTIG" und `.superpowers/sdd/implementation-plan-v3-phase2/progress.md`).

**Umgebungs-Eigenheiten, die Zeit kosten wenn man sie nicht kennt:**
- Die Vorschau unterdrückt natives `confirm()`/`alert()`. Für Abläufe, die darauf
  warten: `window.confirm = () => true` in der Konsole setzen und im Bericht offenlegen.
- Die Vorschau liefert auf diesem `file://`-Pfad manchmal veralteten In-Memory-Zustand
  nach einem Reload. Bewährter Workaround: `window.STATE` in der Konsole aus
  `window.SEED_DATA` zurücksetzen.
- `window.print()` blockiert — nicht aufrufen. Druckvorlagen über
  `#druck-bereich`-Injektion prüfen.
- Bash zeigt auf dieser Windows-Maschine Umlaute falsch an, auch wenn die Datei korrekt
  ist. Umlaute **immer** am Dateiinhalt prüfen (Python `repr()` / Read-Werkzeug),
  nie an der Terminalausgabe.

**Arbeitsweise dieser Session (empfohlen fortzuführen):**
Subagent-Driven Development — pro Task ein frischer Implementierungs-Subagent mit
Task-Brief, danach ein Review-Subagent, Findings in Fix-Runden, Scoped-Re-Review.
Skripte unter
`C:/Users/User/.claude/plugins/cache/claude-plugins-official/superpowers/6.2.0/skills/subagent-driven-development/scripts/`
(`task-brief`, `review-package`, `sdd-workspace`).
Fortschrittsprotokoll: `.superpowers/sdd/implementation-plan-v3-phase2/progress.md`
— **vor dem Weiterarbeiten lesen**, es überlebt den Kontextverlust.
