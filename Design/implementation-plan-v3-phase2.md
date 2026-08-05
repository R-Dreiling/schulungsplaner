# Schulungsplaner v3 – Phase 2 (Durchführung & Nachweis) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Nachweiskette schließen: Anwesenheit je Teilnehmer erfassen, daraus Teilnahmebescheinigungen nach der tribeta-Vorlage erzeugen, den Termin formal abschließen (mit Festschreibung und protokollierter Wiederöffnung) und einen Abschlussbericht als Archivdokument drucken.

**Architecture:** Unverändert eine einzelne selbsterklärende `Berichte/index.html`, gebaut aus Shell + gemeinsamem CSS + JS-Modulen + Seiten-Fragmenten über `Design/assemble.py`. Neu für Phase 2: ein Druckbereich (`#druck-bereich`) im Shell, der per `@media print` allein sichtbar wird — damit entstehen Bescheinigung und Abschlussbericht ohne zusätzliche Bibliothek und ohne zweites Fenster, rein über die Druckfunktion des Browsers.

**Tech Stack:** Vanilla HTML/CSS/JS (kein Framework, kein Build-Tool, kein Node.js auf dieser Maschine), Python 3 für den lokalen Zusammenbau (`assemble.py`) und die einmalige Base64-Kodierung des Logos.

## Global Constraints

- Kein Server/Backend, keine Mehrbenutzer-Synchronisation — Daten liegen lokal im Browser (siehe `Design/design-spec-v3.md`)
- Design-Tokens/Farben/Schriften strikt aus `Design/styles.css` bzw. Wurzel-`CLAUDE.md` (Poppins/Mulish, Teal `#2BD5D8`/`#0B8A8D`, Indigo `#6C7BFF`/`#4D5EE6`, Ink `#0A1028`) — keine neuen Akzentfarben erfinden
- Status-Farb-Zuordnung app-weit einheitlich: Grün = bestätigt/aktiv/erfüllt, Amber = angemeldet/geplant/unterbesetzt, Grau = abgeschlossen/neutral, Rot = abgesagt/Fehler/unter Mindestteilnahme, Indigo = ausgebucht/voll
- Jede Funktion muss einem konkreten Planungs- oder Nachweiszweck dienen, keine dekorativen Spielereien
- Kein Node.js/npm — keine JS-Build-Tools, kein JS-Testrunner. Verifikation von JS/UI-Code erfolgt manuell im Browser (Claude Browser Pane, `mcp__Claude_Browser__*`)
- Vor jeder Browser-Verifikation `localStorage.clear()` ausführen und neu laden; nach der Verifikation Testdaten wieder entfernen
- Jeder Task endet mit `python Design/assemble.py`, dann `git add` inklusive `Berichte/index.html` und `git commit`
- Deutsch als UI-Sprache durchgehend, Umlaute korrekt in UTF-8; Verifikation von Umlauten immer am Dateiinhalt (Python `repr()`/Lesen), nie anhand der Terminalausgabe
- Nutzertext als HTML-Textinhalt durch `escHtml()`, als Attributwert durch `escAttr()`, als JS-String-Argument in Inline-Handlern durch `escJsArg()` (alle in `Design/ui-helpers.js`)
- Destruktive und folgenreiche Aktionen bestätigen über natives `confirm()`
- **Mindestteilnahme ist 80 %** (`MINDEST_ANWESENHEIT`), Bescheinigungen nur ab diesem Wert
- **Bescheinigungen werden ausschließlich einzeln erzeugt**, nie als Sammeldokument — Datenschutz: ein Sammel-PDF würde beim Versand an eine Person die Daten aller anderen mitliefern

## Bestehende Bausteine, auf die Phase 2 aufsetzt

Aus Phase 1 vorhanden und unverändert nutzbar:

- `Design/state-engine.js`: `findeKurs`, `findeTerminMitKurs` → `{kurs, termin}`, `terminAuslastung(terminId)` → `{belegt, kapazitaet, minTeilnehmer, frei, prozent, unterbesetzt}`, `buchungenFuerTermin(terminId)`, `speichereState()`, `einstellungen()` → `{zertifikatStartNummer, bestaetigungsfristTage}`, `trainerName(trainerId)`, `alleTrainer()`, sowie sämtliche CRUD-Funktionen
- `Design/ui-helpers.js`: `escAttr`, `escHtml`, `escJsArg`, `formatiereDatum`, `statusBadgeHtml`, `anmeldestatusBadgeHtml`, `oeffneDialog`, `schliesseDialog`, `formularWerte`
- Datenfelder bereits angelegt (in Phase 1 migriert, bisher ungenutzt): `buchung.anwesenheitProzent` (`null` = nicht erfasst), `buchung.fehlgrund`, `buchung.zertifikatNr`, `termin.abschluss` (`null` = nicht abgeschlossen), `kurs.zertifikat{kuerzel, umfangUE, ueberschrift, bestaetigungstext, gueltigkeit}`, `einstellungen.zertifikatStartNummer` (Vorgabe 147)
- `Design/fragments/page-schulungdetail.js` rendert die Abschnitte über `renderSchulungdetail(terminId)`; die Sprungmarken-Navigation liegt in `detail-nav`, die Abschnitte tragen IDs `abschnitt-<name>`

---

## Datei-Übersicht

| Datei | Aktion | Zweck |
|---|---|---|
| `Design/state-engine.js` | erweitert | Anwesenheit, Zertifikatsnummern, Abschluss/Wiederöffnung, Schreibschutz-Guards |
| `Design/logo.b64.txt` | neu | Base64 des normalen (dunklen) tribeta-Logos für Bescheinigung und Bericht |
| `Design/assemble.py` | angepasst | Platzhalter `{{LOGO_NORMAL_B64}}` |
| `Design/shell-template.html` | erweitert | `#druck-bereich` samt Druck-Auslöser |
| `Design/styles.css` | erweitert | Anwesenheits-, Abschluss-, Bescheinigungs- und Berichts-Klassen inklusive `@media print` |
| `Design/fragments/page-schulungdetail.js` | erweitert | Abschnitt „Anwesenheit", Abschluss-Steuerung, Schreibschutz-Anzeige, Druck-Auslöser |
| `Design/fragments/druck-vorlagen.js` | neu | Aufbau von Bescheinigung und Abschlussbericht als HTML |
| `Design/fragments/page-schulungen.html/.js` | erweitert | Filter „Nur abgeschlossene" und Kennzeichnung abgeschlossener Termine |
| `Design/design-spec-v3.md` | ggf. präzisiert | falls sich beim Bauen eine Regel schärfen muss |

---

## Task 1: State-Engine — Anwesenheit und Zertifikatsnummern

**Files:**
- Modify: `Design/state-engine.js` (Ergänzung am Dateiende)

**Interfaces:**
- Consumes: `findeTerminMitKurs`, `buchungenFuerTermin`, `speichereState`, `einstellungen` (Phase 1)
- Produces:
  - `MINDEST_ANWESENHEIT` — Konstante `80`
  - `anwesenheitSetzen(buchungId, prozent, fehlgrund)` — schreibt `anwesenheitProzent` (Zahl 0–100) und `fehlgrund` (`'krank'|'entschuldigt'|'unentschuldigt'|null`); bei 100 % wird `fehlgrund` immer auf `null` gesetzt
  - `alleAnwesenheitAufVoll(terminId)` → `number` (Anzahl gesetzter Buchungen) — setzt alle nicht abgesagten Buchungen des Termins auf 100 %
  - `anwesenheitsBuchungen(terminId)` → `[Buchung]` — alle Buchungen des Termins **außer** `abgesagt`, das ist die für Anwesenheit und Bescheinigung maßgebliche Menge
  - `anwesenheitStatistik(terminId)` → `{gesamt, erfasst, erfuellt, unterMindest, durchschnitt}` — `durchschnitt` ist `null`, solange nichts erfasst ist
  - `erfuelltMindestteilnahme(buchung)` → `boolean` — `anwesenheitProzent !== null && anwesenheitProzent >= MINDEST_ANWESENHEIT`
  - `naechsteZertifikatNummer()` → `string` — Laufnummer als vierstellige Zahl mit führenden Nullen, ermittelt als „höchste bereits vergebene + 1", sonst `einstellungen().zertifikatStartNummer`
  - `zertifikatNummerFuer(buchungId)` → `string` — gibt die bereits vergebene Nummer zurück oder vergibt und persistiert eine neue im Schema `JAHR-KÜRZEL-LAUFNUMMER`

- [ ] **Step 1: Anwesenheitsfunktionen anhängen**

```javascript
// ---- Phase 2: Anwesenheit ----

// Mindestanteil der Anwesenheit, ab dem eine Teilnahmebescheinigung
// ausgestellt wird (siehe design-spec-v3.md, Abschnitt 4).
const MINDEST_ANWESENHEIT = 80;

// Fuer Anwesenheit und Bescheinigung zaehlen nur Buchungen, die nicht
// abgesagt wurden - wer abgesagt hat, war nicht da und bekommt nichts.
function anwesenheitsBuchungen(terminId) {
  return window.STATE.buchungen.filter(
    b => b.terminId === terminId && b.anmeldestatus !== 'abgesagt'
  );
}

function erfuelltMindestteilnahme(buchung) {
  return buchung.anwesenheitProzent !== null
    && buchung.anwesenheitProzent !== undefined
    && buchung.anwesenheitProzent >= MINDEST_ANWESENHEIT;
}

function anwesenheitSetzen(buchungId, prozent, fehlgrund) {
  const buchung = window.STATE.buchungen.find(b => b.id === buchungId);
  if (!buchung) throw new Error(`Buchung ${buchungId} nicht gefunden`);
  pruefeTerminOffen(buchung.terminId, 'Anwesenheit ändern');

  const zahl = Number(prozent);
  if (!Number.isFinite(zahl) || zahl < 0 || zahl > 100) {
    throw new Error('Anwesenheit muss eine Zahl zwischen 0 und 100 sein.');
  }
  buchung.anwesenheitProzent = Math.round(zahl);
  // Bei voller Anwesenheit ist ein Fehlgrund sinnlos - sonst bliebe ein
  // alter Grund stehen, nachdem korrigiert wurde.
  buchung.fehlgrund = buchung.anwesenheitProzent === 100 ? null : (fehlgrund || null);
  speichereState();
}

function alleAnwesenheitAufVoll(terminId) {
  pruefeTerminOffen(terminId, 'Anwesenheit ändern');
  const betroffen = anwesenheitsBuchungen(terminId);
  for (const buchung of betroffen) {
    buchung.anwesenheitProzent = 100;
    buchung.fehlgrund = null;
  }
  speichereState();
  return betroffen.length;
}

function anwesenheitStatistik(terminId) {
  const buchungen = anwesenheitsBuchungen(terminId);
  const erfasste = buchungen.filter(
    b => b.anwesenheitProzent !== null && b.anwesenheitProzent !== undefined
  );
  const summe = erfasste.reduce((s, b) => s + b.anwesenheitProzent, 0);
  return {
    gesamt: buchungen.length,
    erfasst: erfasste.length,
    erfuellt: buchungen.filter(erfuelltMindestteilnahme).length,
    unterMindest: erfasste.filter(b => !erfuelltMindestteilnahme(b)).length,
    durchschnitt: erfasste.length ? Math.round(summe / erfasste.length) : null,
  };
}
```

- [ ] **Step 2: Zertifikatsnummern anhängen**

```javascript
// ---- Phase 2: Zertifikatsnummern ----
// Schema JAHR-KUERZEL-LAUFNUMMER, z. B. 2026-DSB-0147. Die Laufnummer ist
// global fortlaufend ueber alle Kurse und startet bei einem einstellbaren
// Wert, damit der ersten Bescheinigung nicht anzusehen ist, dass sie die
// erste ist.

function naechsteZertifikatNummer() {
  let hoechste = 0;
  for (const buchung of window.STATE.buchungen) {
    if (!buchung.zertifikatNr) continue;
    const teile = String(buchung.zertifikatNr).split('-');
    const laufnummer = parseInt(teile[teile.length - 1], 10);
    if (Number.isFinite(laufnummer)) hoechste = Math.max(hoechste, laufnummer);
  }
  const naechste = hoechste > 0 ? hoechste + 1 : einstellungen().zertifikatStartNummer;
  return String(naechste).padStart(4, '0');
}

function zertifikatNummerFuer(buchungId) {
  const buchung = window.STATE.buchungen.find(b => b.id === buchungId);
  if (!buchung) throw new Error(`Buchung ${buchungId} nicht gefunden`);
  // Einmal vergeben, bleibt die Nummer stabil - ein zweiter Ausdruck darf
  // keine neue Nummer erzeugen.
  if (buchung.zertifikatNr) return buchung.zertifikatNr;

  const gefunden = findeTerminMitKurs(buchung.terminId);
  if (!gefunden) throw new Error(`Termin ${buchung.terminId} nicht gefunden`);
  const jahr = gefunden.termin.datum.slice(0, 4);
  const kuerzel = (gefunden.kurs.zertifikat && gefunden.kurs.zertifikat.kuerzel)
    || gefunden.kurs.id.toUpperCase();
  buchung.zertifikatNr = `${jahr}-${kuerzel}-${naechsteZertifikatNummer()}`;
  speichereState();
  return buchung.zertifikatNr;
}
```

**Hinweis:** `anwesenheitSetzen` und `alleAnwesenheitAufVoll` rufen `pruefeTerminOffen(...)` auf — diese Funktion entsteht in Task 2. Bis dahin sind die beiden Funktionen nicht aufrufbar; das ist beabsichtigt, da sie ohnehin erst ab Task 5 von der Oberfläche genutzt werden. Task 2 folgt unmittelbar.

- [ ] **Step 3: Build und Zwischenstand sichern**

Run: `python Design/assemble.py`
Expected: Build ohne Fehler. Eine Browser-Verifikation erfolgt am Ende von Task 2, wenn `pruefeTerminOffen` existiert.

- [ ] **Step 4: Commit**

```bash
git add Design/state-engine.js Berichte/index.html
git commit -m "feat: Anwesenheitserfassung und Zertifikatsnummern in der State-Engine"
```

---

## Task 2: State-Engine — Schulungsabschluss und Schreibschutz

**Files:**
- Modify: `Design/state-engine.js`

**Interfaces:**
- Consumes: `findeTerminMitKurs`, `speichereState`, `anwesenheitStatistik` (Task 1)
- Produces:
  - `istTerminAbgeschlossen(terminId)` → `boolean`
  - `pruefeTerminOffen(terminId, aktion)` — wirft mit klarer Meldung, wenn der Termin abgeschlossen ist; `aktion` ist der Text für die Fehlermeldung (z. B. `'Anwesenheit ändern'`)
  - `abschlussVollstaendigkeit(terminId)` → `{anwesenheitFehlt, checklisteOffen, keinTrainer}` — die drei Punkte, die der Abschlussdialog als Hinweis anzeigt (blockieren nicht)
  - `terminAbschliessen(terminId, vorkommnisse)` — setzt `status` auf `'abgeschlossen'` und `abschluss = {abgeschlossenAm, vorkommnisse, wiedereroeffnungen: []}`
  - `terminWiedereroeffnen(terminId)` — setzt `status` zurück auf `'geplant'`, behält `abschluss` und hängt das heutige Datum an `abschluss.wiedereroeffnungen` an
- Ändert zusätzlich (Schreibschutz-Guards): `aktualisiereTermin`, `loescheTermin`, `erstelleBuchung`, `aktualisiereBuchungStatus`, `verschiebeBuchung`, `loescheBuchung`, `checklistePunktToggeln`, `checklistePunktHinzufuegen`, `checklistePunktEntfernen`

- [ ] **Step 1: Abschluss-Funktionen anhängen**

```javascript
// ---- Phase 2: Schulungsabschluss ----
// Abschluss bedeutet Festschreibung: eine nachtraeglich beliebig aenderbare
// Anwesenheitsliste waere als Nachweis wertlos. Wiedereroeffnen bleibt
// moeglich (Korrekturen passieren), wird aber protokolliert.

function istTerminAbgeschlossen(terminId) {
  const gefunden = findeTerminMitKurs(terminId);
  // Beide Bedingungen zusammen, nicht nur abschluss: manche Beispieltermine
  // tragen status 'abgeschlossen' als reinen Anzeigewert aus der Vorbelegung,
  // ohne je ein foermliches abschluss-Objekt erhalten zu haben - die sollen
  // nicht gesperrt sein. Und status allein reicht nicht, weil
  // terminWiedereroeffnen() das abschluss-Objekt bewusst als Historie behaelt,
  // dabei aber status auf 'geplant' zuruecksetzt - erst dieses Zusammenspiel
  // gibt den Schreibschutz nach dem Wiederoeffnen wieder frei.
  return !!(gefunden && gefunden.termin.abschluss && gefunden.termin.status === 'abgeschlossen');
}

function pruefeTerminOffen(terminId, aktion) {
  if (istTerminAbgeschlossen(terminId)) {
    throw new Error(
      `Dieser Termin ist abgeschlossen und schreibgeschützt – „${aktion}" ist nicht möglich. `
      + 'Über „Wieder öffnen" auf der Detailseite lässt sich der Schutz aufheben; '
      + 'das wird im Abschlussbericht vermerkt.'
    );
  }
}

function abschlussVollstaendigkeit(terminId) {
  const gefunden = findeTerminMitKurs(terminId);
  if (!gefunden) throw new Error(`Termin ${terminId} nicht gefunden`);
  const statistik = anwesenheitStatistik(terminId);
  return {
    anwesenheitFehlt: statistik.gesamt - statistik.erfasst,
    checklisteOffen: gefunden.termin.checkliste.filter(p => !p.erledigt).length,
    keinTrainer: !gefunden.termin.trainerId,
  };
}

function terminAbschliessen(terminId, vorkommnisse) {
  const gefunden = findeTerminMitKurs(terminId);
  if (!gefunden) throw new Error(`Termin ${terminId} nicht gefunden`);
  if (istTerminAbgeschlossen(terminId)) throw new Error('Dieser Termin ist bereits abgeschlossen.');
  // Wurde der Termin schon einmal abgeschlossen und wieder geoeffnet, muss
  // die bisherige Wiedereroeffnungs-Historie erhalten bleiben - sie ist der
  // Kern des Nachweises und darf durch ein erneutes Abschliessen nicht
  // verschwinden.
  const bisherige = (gefunden.termin.abschluss && gefunden.termin.abschluss.wiedereroeffnungen) || [];
  gefunden.termin.abschluss = {
    abgeschlossenAm: new Date().toISOString().slice(0, 10),
    vorkommnisse: vorkommnisse || '',
    wiedereroeffnungen: bisherige,
  };
  gefunden.termin.status = 'abgeschlossen';
  speichereState();
}

function terminWiedereroeffnen(terminId) {
  const gefunden = findeTerminMitKurs(terminId);
  if (!gefunden) throw new Error(`Termin ${terminId} nicht gefunden`);
  // Bewusst istTerminAbgeschlossen und nicht nur abschluss pruefen: nach dem
  // Wiederoeffnen bleibt abschluss als Historie bestehen, der Termin ist aber
  // offen - ein zweites Wiederoeffnen wuerde sonst durchlaufen und einen
  // falschen Eintrag ins Protokoll schreiben.
  if (!istTerminAbgeschlossen(terminId)) throw new Error('Dieser Termin ist nicht abgeschlossen.');
  gefunden.termin.abschluss.wiedereroeffnungen.push(new Date().toISOString().slice(0, 10));
  gefunden.termin.status = 'geplant';
  speichereState();
}
```

- [ ] **Step 2: Schreibschutz in die bestehenden Mutatoren einbauen**

Füge in `Design/state-engine.js` jeweils als **erste Zeile des Funktionsrumpfs** (bzw. direkt nach der bestehenden „nicht gefunden"-Prüfung, wo eine existiert) den passenden Guard ein. Ändere sonst nichts an diesen Funktionen:

| Funktion | einzufügende Zeile |
|---|---|
| `aktualisiereTermin(terminId, felder)` | `pruefeTerminOffen(terminId, 'Termindaten bearbeiten');` |
| `loescheTermin(terminId)` | `pruefeTerminOffen(terminId, 'Termin löschen');` |
| `erstelleBuchung(felder)` | `pruefeTerminOffen(felder.terminId, 'Teilnehmer hinzufügen');` |
| `checklistePunktToggeln(terminId, index)` | `pruefeTerminOffen(terminId, 'Checkliste ändern');` |
| `checklistePunktHinzufuegen(terminId, label)` | `pruefeTerminOffen(terminId, 'Checkliste ändern');` |
| `checklistePunktEntfernen(terminId, index)` | `pruefeTerminOffen(terminId, 'Checkliste ändern');` |

Für die drei buchungsbezogenen Funktionen wird die Termin-ID aus der Buchung gelesen, der Guard kommt daher **nach** dem Auffinden der Buchung:

| Funktion | einzufügende Zeile (nach dem `if (!buchung) throw …`) |
|---|---|
| `aktualisiereBuchungStatus(buchungId, neuerStatus)` | `pruefeTerminOffen(buchung.terminId, 'Anmeldestatus ändern');` |
| `loescheBuchung(buchungId)` | siehe Sonderfall unten |
| `verschiebeBuchung(buchungId, neuerTerminId)` | `pruefeTerminOffen(buchung.terminId, 'Teilnehmer verschieben');` und zusätzlich `pruefeTerminOffen(neuerTerminId, 'Teilnehmer auf diesen Termin verschieben');` |

**Sonderfall `loescheBuchung`:** Die Funktion filtert bisher ohne vorheriges Auffinden. Ersetze sie vollständig durch:

```javascript
function loescheBuchung(buchungId) {
  const buchung = window.STATE.buchungen.find(b => b.id === buchungId);
  if (buchung) pruefeTerminOffen(buchung.terminId, 'Buchung entfernen');
  window.STATE.buchungen = window.STATE.buchungen.filter(b => b.id !== buchungId);
  speichereState();
}
```

**Wichtig:** `loescheKurs` bekommt **keinen** Guard. Einen ganzen Kurs mit allen Terminen zu löschen ist eine bewusste, bestätigte Aktion auf einer anderen Ebene; ein einzelner abgeschlossener Termin darin soll das nicht dauerhaft blockieren. Diese Entscheidung ist beabsichtigt und wird in Task 10 mitgeprüft.

- [ ] **Step 3: Build und Browser-Verifikation**

Run: `python Design/assemble.py`

Im Claude Browser Pane, nach `localStorage.clear()` und Neuladen, in der Konsole:

```javascript
// Anwesenheit erfassen und auswerten
const t = 's1';
alleAnwesenheitAufVoll(t);                       // erwartet: 5
anwesenheitStatistik(t);                         // erwartet: {gesamt:5, erfasst:5, erfuellt:5, unterMindest:0, durchschnitt:100}
const b = anwesenheitsBuchungen(t)[0];
anwesenheitSetzen(b.id, 60, 'krank');
anwesenheitStatistik(t);                         // erwartet: {gesamt:5, erfasst:5, erfuellt:4, unterMindest:1, durchschnitt:92}
erfuelltMindestteilnahme(b);                     // erwartet: false
anwesenheitSetzen(b.id, 100, 'krank');
window.STATE.buchungen.find(x => x.id === b.id).fehlgrund;  // erwartet: null (bei 100% kein Grund)

// Zertifikatsnummer
const nr = zertifikatNummerFuer(anwesenheitsBuchungen(t)[1].id);
nr;                                              // erwartet: "2026-DSB-0147"
zertifikatNummerFuer(anwesenheitsBuchungen(t)[1].id) === nr;  // erwartet: true (stabil)
zertifikatNummerFuer(anwesenheitsBuchungen(t)[2].id);         // erwartet: "2026-DSB-0148"

// Abschluss und Schreibschutz
abschlussVollstaendigkeit(t);                    // erwartet: {anwesenheitFehlt:0, checklisteOffen:5, keinTrainer:false}
terminAbschliessen(t, 'Testvorkommnis');
istTerminAbgeschlossen(t);                       // erwartet: true
try { anwesenheitSetzen(b.id, 50, null); } catch (e) { e.message; }   // erwartet: Meldung mit "schreibgeschützt"
try { checklistePunktToggeln(t, 0); } catch (e) { e.message; }        // erwartet: dieselbe Art Meldung
terminWiedereroeffnen(t);
findeTerminMitKurs(t).termin.abschluss.wiedereroeffnungen.length;     // erwartet: 1
findeTerminMitKurs(t).termin.status;                                  // erwartet: "geplant"
checklistePunktToggeln(t, 0);                    // erwartet: kein Fehler mehr
```

Expected: alle Werte wie angegeben, keine unerwarteten Konsolenfehler. Danach `localStorage.clear()` und neu laden.

- [ ] **Step 4: Commit**

```bash
git add Design/state-engine.js Berichte/index.html
git commit -m "feat: Schulungsabschluss mit Festschreibung, Wiederoeffnung und Schreibschutz"
```

---

## Task 3: Druckinfrastruktur — Logo, Druckbereich, Druck-CSS

**Files:**
- Create: `Design/logo.b64.txt`
- Modify: `Design/assemble.py`
- Modify: `Design/shell-template.html`
- Modify: `Design/styles.css`

**Interfaces:**
- Produces:
  - `{{LOGO_NORMAL_B64}}` — Platzhalter mit dem Base64 des **normalen** (dunklen) tribeta-Logos; das bisherige `{{LOGO_B64}}` (inverses Logo für die dunkle Titelleiste) bleibt unverändert
  - `window.LOGO_NORMAL` — der fertige `data:`-URL-String, den die Druckvorlagen als Bildquelle verwenden
  - `#druck-bereich` — leerer Container im Shell; wird vor dem Druck mit dem fertigen HTML befüllt
  - `druckeInhalt(html, dokumentTitel)` — füllt `#druck-bereich`, setzt `document.title` (bestimmt den vorgeschlagenen Dateinamen beim „Als PDF speichern"), ruft `window.print()` und stellt den Titel danach wieder her
  - CSS-Klassen für den Druck: `.druck-seite`, `.zert-*`, `.bericht-*` sowie ein `@media print`-Block, der ausschließlich `#druck-bereich` sichtbar lässt

- [ ] **Step 1: Normales Logo als Base64 erzeugen**

Run:
```bash
python -c "import base64,pathlib; p=pathlib.Path('Design/tribeta-logo.svg'); pathlib.Path('Design/logo.b64.txt').write_text(base64.b64encode(p.read_bytes()).decode('ascii'), encoding='utf-8'); print('Bytes SVG:', len(p.read_bytes()))"
```
Expected: Ausgabe `Bytes SVG: 11730`, und `Design/logo.b64.txt` existiert.

Gegenprobe, dass das Ergebnis wirklich das dunkle Logo ist (Ink `#0a1028`, nicht Weiß):
```bash
python -c "import base64,pathlib; s=base64.b64decode(pathlib.Path('Design/logo.b64.txt').read_text(encoding='utf-8')).decode('utf-8'); print('enthaelt Ink:', '#0a1028' in s); print('enthaelt Weiss:', '#ffffff' in s)"
```
Expected: `enthaelt Ink: True`, `enthaelt Weiss: False`.

- [ ] **Step 2: `assemble.py` um den neuen Platzhalter erweitern**

Ergänze in `Design/assemble.py` nach der bestehenden Zeile `logo_b64 = read(BASE / "logo-invers.b64.txt").strip()`:

```python
logo_normal_b64 = read(BASE / "logo.b64.txt").strip()
```

Und nach der bestehenden Zeile `html = html.replace("{{LOGO_B64}}", logo_b64)`:

```python
html = html.replace("{{LOGO_NORMAL_B64}}", logo_normal_b64)
```

- [ ] **Step 3: Druckbereich und Druckfunktion ins Shell einbauen**

Ergänze in `Design/shell-template.html` direkt **vor** dem schließenden `</body>` (also nach dem Dialog-Overlay-Block):

```html
<!-- Wird nur beim Drucken sichtbar (siehe @media print in styles.css) und
     vorher per druckeInhalt() befuellt. So entstehen Bescheinigung und
     Abschlussbericht ohne zweites Fenster und ohne Zusatzbibliothek. -->
<div id="druck-bereich"></div>
```

Und ergänze im letzten `<script>`-Block, direkt nach der Funktion `showTrainerDetail`:

```javascript
window.LOGO_NORMAL = 'data:image/svg+xml;base64,{{LOGO_NORMAL_B64}}';

// Fuellt den Druckbereich und loest den Browser-Druckdialog aus. Der
// Dokumenttitel bestimmt den vom Browser vorgeschlagenen Dateinamen beim
// "Als PDF speichern" und wird danach wieder zurueckgesetzt.
function druckeInhalt(html, dokumentTitel) {
  const bereich = document.getElementById('druck-bereich');
  bereich.innerHTML = html;
  const vorherigerTitel = document.title;
  document.title = dokumentTitel;
  window.print();
  document.title = vorherigerTitel;
}
```

- [ ] **Step 4: Druck- und Nachweis-CSS anhängen**

Hänge an `Design/styles.css` an:

```css

/* ========================================================================
   v3 Phase 2: Anwesenheit, Abschluss, Bescheinigung, Abschlussbericht
   ======================================================================== */

/* --- Anwesenheitsabschnitt --- */
.anw-row { display: flex; align-items: center; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--line); font-size: 13px; }
.anw-row:last-child { border-bottom: none; }
.anw-name { flex: 1; min-width: 0; }
.anw-name strong { color: var(--ink); font-weight: 600; }
.anw-firma { font-size: 11.5px; color: var(--muted2); }
.anw-prozent { width: 74px; flex: none; }
.anw-prozent input {
  width: 100%; font-family: var(--font-body); font-size: 13px; padding: 5px 8px;
  border: 1px solid var(--line-strong); border-radius: 6px; text-align: right; color: var(--ink);
}
.anw-grund { width: 150px; flex: none; }
.anw-grund select {
  width: 100%; font-family: var(--font-body); font-size: 12.5px; padding: 5px 8px;
  border: 1px solid var(--line-strong); border-radius: 6px; background: #fff; color: var(--ink);
}
.anw-row.unter-mindest .anw-prozent input { border-color: #E9B4AE; color: var(--status-red-fg); font-weight: 600; }
.anw-hinweis { font-size: 11.5px; color: var(--status-red-fg); font-weight: 600; }
.anw-aktion { width: 132px; flex: none; text-align: right; }

/* --- Abschluss-Kennzeichnung --- */
.abschluss-banner {
  display: flex; align-items: center; justify-content: space-between; gap: 14px;
  background: var(--status-gray-bg); border: 1px solid var(--line-strong);
  border-radius: var(--radius-md); padding: 12px 16px; margin-bottom: 18px;
  font-size: 13px; color: var(--status-gray-fg);
}
.abschluss-banner strong { color: var(--ink); font-family: var(--font-display); }
.abschluss-hinweis { font-size: 11.5px; color: var(--muted2); margin-top: 3px; }

/* --- Gemeinsame Druckseite --- */
#druck-bereich { display: none; }
.druck-seite {
  width: 100%; background: #fff; color: var(--ink);
  font-family: var(--font-body); box-sizing: border-box;
}
.druck-logo { height: 34px; }

/* --- Bescheinigung (Nachbau der tribeta-Vorlage) --- */
.zert-rahmen {
  border: 3px solid var(--teal); padding: 42px 52px; text-align: center;
  display: flex; flex-direction: column; min-height: 176mm;
}
.zert-ueberschrift {
  font-family: var(--font-display); font-size: 11pt; font-weight: 700;
  color: var(--teal-deep); letter-spacing: .4px; text-transform: uppercase;
  margin: 18px 0 6px 0;
}
.zert-titel { font-family: var(--font-display); font-size: 30pt; font-weight: 800; color: var(--ink); margin: 0 0 22px 0; }
.zert-einleitung { font-size: 11pt; color: var(--text); margin-bottom: 10px; }
.zert-name { font-family: var(--font-display); font-size: 20pt; font-weight: 800; color: var(--ink); margin: 0 0 20px 0; }
.zert-text { font-size: 11pt; line-height: 1.7; color: var(--text); max-width: 150mm; margin: 0 auto; }
.zert-unterschriften { display: flex; justify-content: space-between; gap: 24px; margin-top: auto; padding-top: 34px; }
.zert-unterschrift { flex: 1; text-align: center; }
.zert-linie { border-top: 1px solid var(--ink); margin-bottom: 5px; }
.zert-unterschrift span { font-size: 9pt; color: var(--muted); }
.zert-fuss { font-size: 8.5pt; color: var(--muted); margin-top: 16px; }

/* --- Abschlussbericht --- */
.bericht-kopf { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 2px solid var(--teal); padding-bottom: 12px; margin-bottom: 18px; }
.bericht-titel { font-family: var(--font-display); font-size: 17pt; font-weight: 700; color: var(--ink); margin: 0; }
.bericht-untertitel { font-size: 10pt; color: var(--muted); margin-top: 3px; }
.bericht-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 20px; margin-bottom: 18px; }
.bericht-meta div { font-size: 10pt; }
.bericht-meta .l { font-family: var(--font-display); font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: .3px; color: var(--muted); }
.bericht-abschnitt { font-family: var(--font-display); font-size: 11pt; font-weight: 700; color: var(--ink); margin: 18px 0 8px 0; }
table.bericht-tabelle { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
table.bericht-tabelle th {
  text-align: left; font-family: var(--font-display); font-size: 8pt; font-weight: 700;
  text-transform: uppercase; letter-spacing: .3px; color: var(--muted);
  border-bottom: 1px solid var(--ink); padding: 5px 7px;
}
table.bericht-tabelle td { padding: 5px 7px; border-bottom: 1px solid var(--line); color: var(--text); }
table.bericht-tabelle td.negativ { color: var(--status-red-fg); font-weight: 600; }
.bericht-kennzahlen { display: flex; gap: 26px; font-size: 10pt; margin-top: 8px; }
.bericht-vorkommnisse { font-size: 10pt; line-height: 1.6; color: var(--text); white-space: pre-wrap; }
.bericht-warnung { font-size: 9.5pt; color: var(--status-red-fg); font-weight: 600; margin-top: 8px; }
.bericht-unterschrift { margin-top: 34px; width: 62mm; }

/* --- Druckausgabe: nur der Druckbereich, nichts von der App --- */
@media print {
  @page { size: A4; margin: 14mm; }
  body { display: block; padding: 0; background: #fff; min-height: 0; }
  .app-window, #dialog-overlay { display: none !important; }
  #druck-bereich { display: block; }
  .druck-seite { page-break-after: always; }
  .druck-seite:last-child { page-break-after: auto; }
  table.bericht-tabelle { page-break-inside: auto; }
  table.bericht-tabelle tr { page-break-inside: avoid; }
}
```

- [ ] **Step 5: Build und Verifikation**

Run: `python Design/assemble.py`

Im Claude Browser Pane, nach `localStorage.clear()` und Neuladen, in der Konsole:

```javascript
document.getElementById('druck-bereich') !== null;              // erwartet: true
getComputedStyle(document.getElementById('druck-bereich')).display;  // erwartet: "none"
window.LOGO_NORMAL.startsWith('data:image/svg+xml;base64,');    // erwartet: true
window.LOGO_NORMAL.length > 15000;                              // erwartet: true
typeof druckeInhalt;                                            // erwartet: "function"
getComputedStyle(document.querySelector('.sidebar')).width;      // erwartet: "232px" (Stylesheet intakt)
```

Zusätzlich prüfen, dass im gebauten HTML kein Platzhalter offen blieb:
Run: `python -c "c=open('Berichte/index.html',encoding='utf-8').read(); assert '{{' not in c, 'offener Platzhalter'; print('keine offenen Platzhalter, Laenge:', len(c))"`

Expected: alle Werte wie angegeben, keine Konsolenfehler.

- [ ] **Step 6: Commit**

```bash
git add Design/logo.b64.txt Design/assemble.py Design/shell-template.html Design/styles.css Berichte/index.html
git commit -m "feat: Druckinfrastruktur fuer Bescheinigung und Abschlussbericht"
```

---

## Task 4: Anwesenheitsabschnitt auf der Schulungsdetailseite

**Files:**
- Modify: `Design/fragments/page-schulungdetail.js`

**Interfaces:**
- Consumes: `anwesenheitsBuchungen`, `anwesenheitStatistik`, `erfuelltMindestteilnahme`, `anwesenheitSetzen`, `alleAnwesenheitAufVoll`, `MINDEST_ANWESENHEIT`, `istTerminAbgeschlossen` (Tasks 1–2), `escHtml`, `escAttr`, `escJsArg`
- Produces:
  - `detailAbschnittAnwesenheit(termin)` → HTML-String; wird in `renderSchulungdetail` zwischen Checkliste und Teilnehmer eingehängt, und in der Sprungmarken-Navigation als Punkt „Anwesenheit" ergänzt
  - `detailAnwesenheitProzent(buchungId, wert)` — Handler für das Prozentfeld
  - `detailAnwesenheitGrund(buchungId, wert)` — Handler für die Fehlgrund-Auswahl
  - `detailAlleAnwesend(terminId)` — Handler für „Alle auf 100 %"

- [ ] **Step 1: Abschnitt und Handler anhängen**

```javascript
// ---- Phase 2: Anwesenheit ----

function detailAnwesenheitZeile(termin, buchung, gesperrt) {
  const teilnehmer = window.STATE.teilnehmer.find(t => t.id === buchung.teilnehmerId);
  const erfasst = buchung.anwesenheitProzent !== null && buchung.anwesenheitProzent !== undefined;
  const unter = erfasst && !erfuelltMindestteilnahme(buchung);
  const gruende = ['krank', 'entschuldigt', 'unentschuldigt'];
  const grundOptionen = ['<option value="">— kein Grund —</option>']
    .concat(gruende.map(g =>
      `<option value="${g}" ${buchung.fehlgrund === g ? 'selected' : ''}>${g}</option>`))
    .join('');

  return `
    <div class="anw-row ${unter ? 'unter-mindest' : ''}">
      <div class="anw-name">
        <strong>${escHtml(teilnehmer ? teilnehmer.name : '(unbekannt)')}</strong>
        <div class="anw-firma">${escHtml(teilnehmer ? teilnehmer.firma : '')}</div>
      </div>
      <div class="anw-prozent">
        <input type="number" min="0" max="100" step="1"
               value="${erfasst ? buchung.anwesenheitProzent : ''}"
               placeholder="%" ${gesperrt ? 'disabled' : ''}
               onchange="detailAnwesenheitProzent('${escJsArg(buchung.id)}', this.value)" />
      </div>
      <div class="anw-grund">
        <select ${gesperrt || !erfasst || buchung.anwesenheitProzent === 100 ? 'disabled' : ''}
                onchange="detailAnwesenheitGrund('${escJsArg(buchung.id)}', this.value)">
          ${grundOptionen}
        </select>
      </div>
      <div class="anw-aktion">
        ${unter ? '<span class="anw-hinweis">unter ' + MINDEST_ANWESENHEIT + ' %</span>' : ''}
      </div>
    </div>`;
}

function detailAbschnittAnwesenheit(termin) {
  // Nicht !!termin.abschluss verwenden: nach dem Wiederoeffnen bleibt das
  // abschluss-Objekt als Historie erhalten, der Termin ist aber wieder offen.
  const gesperrt = istTerminAbgeschlossen(termin.id);
  const buchungen = anwesenheitsBuchungen(termin.id);
  const s = anwesenheitStatistik(termin.id);

  if (buchungen.length === 0) {
    return `
      <div class="card" id="abschnitt-anwesenheit">
        <div class="section-title">Anwesenheit</div>
        <p class="empty-hint">Noch keine Teilnehmer gebucht — es gibt nichts zu erfassen.</p>
      </div>`;
  }

  const zusammenfassung = s.erfasst === 0
    ? 'noch nichts erfasst'
    : `${s.erfuellt} von ${s.gesamt} erfüllen die Mindestteilnahme`
      + (s.erfasst < s.gesamt ? ` · ${s.gesamt - s.erfasst} offen` : '')
      + (s.durchschnitt !== null ? ` · Ø ${s.durchschnitt} %` : '');

  return `
    <div class="card" id="abschnitt-anwesenheit">
      <div class="section-title">Anwesenheit <small>${escHtml(zusammenfassung)}</small>
        ${gesperrt ? '' : `<button class="btn" onclick="detailAlleAnwesend('${escJsArg(termin.id)}')">Alle auf 100 %</button>`}
      </div>
      <p class="field-hint" style="margin:-4px 0 10px 0;">
        Ab ${MINDEST_ANWESENHEIT} % Anwesenheit wird eine Teilnahmebescheinigung ausgestellt.
      </p>
      ${buchungen.map(b => detailAnwesenheitZeile(termin, b, gesperrt)).join('')}
    </div>`;
}

function detailAnwesenheitProzent(buchungId, wert) {
  if (wert === '') return;
  try {
    const buchung = window.STATE.buchungen.find(b => b.id === buchungId);
    anwesenheitSetzen(buchungId, wert, buchung ? buchung.fehlgrund : null);
  } catch (e) {
    alert(e.message);
    renderAll();
  }
}

function detailAnwesenheitGrund(buchungId, wert) {
  try {
    const buchung = window.STATE.buchungen.find(b => b.id === buchungId);
    if (!buchung) return;
    anwesenheitSetzen(buchungId, buchung.anwesenheitProzent, wert || null);
  } catch (e) {
    alert(e.message);
    renderAll();
  }
}

function detailAlleAnwesend(terminId) {
  try {
    const anzahl = alleAnwesenheitAufVoll(terminId);
    if (anzahl === 0) alert('Keine Teilnehmer vorhanden.');
  } catch (e) {
    alert(e.message);
  }
}
```

- [ ] **Step 2: Abschnitt in die Detailseite und die Sprungmarken einhängen**

In `Design/fragments/page-schulungdetail.js`, in der Funktion `renderSchulungdetail`:

**(a)** Ergänze in der Sprungmarken-Navigation direkt **nach** dem Eintrag für „Checkliste":

```javascript
        <a id="nav-anwesenheit" onclick="detailScrollZu('anwesenheit')">Anwesenheit</a>
```

**(b)** Ergänze im Hauptbereich direkt **nach** `${detailAbschnittCheckliste(termin)}`:

```javascript
        ${detailAbschnittAnwesenheit(termin)}
```

- [ ] **Step 3: Build und Browser-Verifikation**

Run: `python Design/assemble.py`

Im Claude Browser Pane, nach `localStorage.clear()` und Neuladen:
- Über „Schulungen" den Termin am 12.08.2026 („Datenschutzbeauftragter Grundlagenschulung") öffnen
- Die linke Navigation enthält jetzt „Anwesenheit" zwischen „Checkliste" und „Teilnehmer"; Klick springt zum Abschnitt
- Der Abschnitt listet 5 Teilnehmer (die abgesagten Buchungen des Termins tauchen nicht auf), Überschrift zeigt „noch nichts erfasst"
- „Alle auf 100 %" klicken → alle Felder zeigen 100, Überschrift zeigt „5 von 5 erfüllen die Mindestteilnahme · Ø 100 %", Grund-Auswahl ist ausgegraut
- Bei einem Teilnehmer 60 eintragen und das Feld verlassen → Zeile wird rot markiert, „unter 80 %" erscheint, Grund-Auswahl wird aktiv, Überschrift zeigt „4 von 5 … · 1 offen" nicht (alle sind erfasst) sondern „4 von 5 erfüllen die Mindestteilnahme · Ø 92 %"
- Bei diesem Teilnehmer „krank" wählen → bleibt nach dem Neurendern ausgewählt
- Wieder 100 eintragen → Grund wird automatisch geleert und die Auswahl ausgegraut
- Konsole ohne Fehler
- Danach `localStorage.clear()` und neu laden

- [ ] **Step 4: Commit**

```bash
git add Design/fragments/page-schulungdetail.js Berichte/index.html
git commit -m "feat: Anwesenheitserfassung auf der Schulungsdetailseite"
```

---

## Task 5: Teilnahmebescheinigung

**Files:**
- Create: `Design/fragments/druck-vorlagen.js`
- Modify: `Design/assemble.py` (neues JS-Modul einbinden)
- Modify: `Design/fragments/page-schulungdetail.js` (Knopf je Teilnehmerzeile)

**Interfaces:**
- Consumes: `findeTerminMitKurs`, `zertifikatNummerFuer`, `erfuelltMindestteilnahme`, `trainerName`, `formatiereDatum`, `escHtml`, `druckeInhalt`, `window.LOGO_NORMAL`
- Produces:
  - `zertifikatPlatzhalterFuellen(vorlage, werte)` → `string` — ersetzt `{teilnehmer}`, `{kurs}`, `{umfang}`, `{datum}`, `{ort}`, `{trainer}`
  - `zertifikatHtml(buchungId)` → `string` — vollständige Bescheinigungsseite als HTML
  - `druckeZertifikat(buchungId)` — vergibt bei Bedarf die Nummer, baut das HTML und löst den Druck aus

Die Vorlage bildet `09_Zertifikat_Vorlage.pdf` nach: Logo, Kleinüberschrift in Teal-Versalien, große Überschrift „Zertifikat", Einleitungszeile, Name in groß, Fließtext, drei Unterschriftslinien (Ort/Datum · Leitung/Referent:in · tribeta), Fußzeile mit Zertifikat-Nr. und Gültigkeit — alles im Teal-Rahmen.

- [ ] **Step 1: `Design/fragments/druck-vorlagen.js` anlegen**

```javascript
// Design/fragments/druck-vorlagen.js
// Baut Bescheinigung und Abschlussbericht als HTML fuer den Druckbereich.
// Nachbau der tribeta-Vorlage 09_Zertifikat_Vorlage.pdf.

function zertifikatPlatzhalterFuellen(vorlage, werte) {
  return String(vorlage)
    .replace(/\{teilnehmer\}/g, werte.teilnehmer)
    .replace(/\{kurs\}/g, werte.kurs)
    .replace(/\{umfang\}/g, werte.umfang)
    .replace(/\{datum\}/g, werte.datum)
    .replace(/\{ort\}/g, werte.ort)
    .replace(/\{trainer\}/g, werte.trainer);
}

function zertifikatHtml(buchungId) {
  const buchung = window.STATE.buchungen.find(b => b.id === buchungId);
  if (!buchung) throw new Error(`Buchung ${buchungId} nicht gefunden`);
  const teilnehmer = window.STATE.teilnehmer.find(t => t.id === buchung.teilnehmerId);
  const gefunden = findeTerminMitKurs(buchung.terminId);
  if (!teilnehmer || !gefunden) throw new Error('Teilnehmer oder Termin nicht gefunden.');
  const { kurs, termin } = gefunden;
  const z = kurs.zertifikat || {};

  // Erst hier vergeben: eine Nummer soll nur entstehen, wenn wirklich
  // gedruckt wird - nicht schon beim Anzeigen der Liste.
  const nummer = zertifikatNummerFuer(buchungId);

  // Die Platzhalter werden mit bereits escapetem Text gefuellt, damit ein
  // Kurstitel mit Sonderzeichen die Seite nicht zerlegt.
  const text = zertifikatPlatzhalterFuellen(z.bestaetigungstext || '', {
    teilnehmer: escHtml(teilnehmer.name),
    kurs: escHtml(kurs.titel),
    umfang: escHtml(String(z.umfangUE || '')),
    datum: formatiereDatum(termin.datum),
    ort: escHtml(termin.ort || ''),
    trainer: escHtml(trainerName(termin.trainerId) || ''),
  });

  return `
    <div class="druck-seite">
      <div class="zert-rahmen">
        <div><img class="druck-logo" src="${window.LOGO_NORMAL}" alt="tribeta" /></div>
        <div class="zert-ueberschrift">${escHtml(z.ueberschrift || kurs.titel)}</div>
        <h1 class="zert-titel">Zertifikat</h1>
        <div class="zert-einleitung">Hiermit wird bestätigt, dass</div>
        <div class="zert-name">${escHtml(teilnehmer.name)}</div>
        <div class="zert-text">${text}</div>
        <div class="zert-unterschriften">
          <div class="zert-unterschrift"><div class="zert-linie"></div><span>Ort, Datum</span></div>
          <div class="zert-unterschrift"><div class="zert-linie"></div><span>Leitung / Referent:in</span></div>
          <div class="zert-unterschrift"><div class="zert-linie"></div><span>tribeta</span></div>
        </div>
        <div class="zert-fuss">
          Zertifikat-Nr.: ${escHtml(nummer)} &nbsp;·&nbsp; Gültigkeit: ${escHtml(z.gueltigkeit || 'unbefristet')}
        </div>
      </div>
    </div>`;
}

function druckeZertifikat(buchungId) {
  try {
    const buchung = window.STATE.buchungen.find(b => b.id === buchungId);
    const teilnehmer = buchung && window.STATE.teilnehmer.find(t => t.id === buchung.teilnehmerId);
    const html = zertifikatHtml(buchungId);
    const dateiname = `Zertifikat_${buchung.zertifikatNr}_${(teilnehmer.name || '').replace(/\s+/g, '-')}`;
    druckeInhalt(html, dateiname);
  } catch (e) {
    alert('Bescheinigung konnte nicht erzeugt werden: ' + e.message);
  }
}
```

- [ ] **Step 2: Modul in `assemble.py` einbinden**

`druck-vorlagen.js` liegt im `fragments`-Ordner, gehört aber nicht zu einer Seite. Ergänze in `Design/assemble.py` **nach** der Schleife, die `page_js_parts` aufbaut, und **vor** `page_js = "\n\n".join(page_js_parts)`:

```python
# Gemeinsame Druckvorlagen (Bescheinigung/Bericht) - kein Seiten-Fragment,
# wird aber wie eines eingebettet, damit alle Seiten sie nutzen koennen.
druck_js = read(FRAGMENTS / "druck-vorlagen.js")
if druck_js.strip():
    page_js_parts.insert(0, f"// ---- druck-vorlagen.js ----\n{druck_js}")
```

- [ ] **Step 3: Bescheinigungs-Knopf in die Anwesenheitszeile einbauen**

Ersetze in `Design/fragments/page-schulungdetail.js` innerhalb von `detailAnwesenheitZeile` den `anw-aktion`-Block vollständig durch:

```javascript
      <div class="anw-aktion">
        ${(() => {
          if (!erfasst) {
            return '<button class="btn" disabled title="Anwesenheit noch nicht erfasst">Bescheinigung</button>';
          }
          if (unter) {
            return `<button class="btn" disabled title="unter Mindestteilnahme von ${MINDEST_ANWESENHEIT} %">Bescheinigung</button>`;
          }
          return `<button class="btn" onclick="druckeZertifikat('${escJsArg(buchung.id)}')">Bescheinigung</button>`;
        })()}
      </div>`;
```

Und ergänze im selben Abschnitt unter der Zusammenfassung den Datenschutzhinweis — ersetze die bestehende `field-hint`-Zeile in `detailAbschnittAnwesenheit` durch:

```javascript
      <p class="field-hint" style="margin:-4px 0 10px 0;">
        Ab ${MINDEST_ANWESENHEIT} % Anwesenheit wird eine Teilnahmebescheinigung ausgestellt.
        Sie wird bewusst einzeln erzeugt, damit beim Versand keine Daten anderer Teilnehmer mitgehen.
      </p>
```

- [ ] **Step 4: Build und Browser-Verifikation**

Run: `python Design/assemble.py`

Im Claude Browser Pane, nach `localStorage.clear()` und Neuladen, auf der Detailseite des Termins am 12.08.2026:
- Solange nichts erfasst ist, sind alle „Bescheinigung"-Knöpfe ausgegraut mit dem Titel „Anwesenheit noch nicht erfasst"
- „Alle auf 100 %" → alle Knöpfe werden aktiv
- Bei einem Teilnehmer 60 eintragen → dessen Knopf wird ausgegraut mit dem Titel „unter Mindestteilnahme von 80 %"
- Statt den Druckdialog auszulösen (den die Vorschau-Umgebung nicht bedienen kann), die Vorlage direkt prüfen. In der Konsole:

```javascript
const b = anwesenheitsBuchungen('s1').find(x => x.anwesenheitProzent === 100);
const html = zertifikatHtml(b.id);
document.getElementById('druck-bereich').innerHTML = html;
const d = document.getElementById('druck-bereich');
JSON.stringify({
  ueberschrift: d.querySelector('.zert-ueberschrift').textContent,
  titel: d.querySelector('.zert-titel').textContent,
  name: d.querySelector('.zert-name').textContent,
  textAnfang: d.querySelector('.zert-text').textContent.slice(0, 70),
  unterschriften: [...d.querySelectorAll('.zert-unterschrift span')].map(s => s.textContent),
  fuss: d.querySelector('.zert-fuss').textContent.trim(),
  logoGeladen: d.querySelector('.druck-logo').getAttribute('src').startsWith('data:image/svg+xml')
}, null, 2)
```

Expected: `ueberschrift` ist „Zertifizierungslehrgang Datenschutzbeauftragte:r", `titel` ist „Zertifikat", `name` ist der Teilnehmername, `textAnfang` beginnt mit „den Zertifizierungslehrgang „Datenschutzbeauftragter Grundlagenschulung"", die drei Unterschriften lauten „Ort, Datum" / „Leitung / Referent:in" / „tribeta", `fuss` enthält „Zertifikat-Nr.: 2026-DSB-0147 · Gültigkeit: unbefristet", `logoGeladen` ist `true`.

Zusätzlich die Nummernstabilität prüfen:
```javascript
const nr1 = window.STATE.buchungen.find(x => x.id === b.id).zertifikatNr;
zertifikatHtml(b.id);
const nr2 = window.STATE.buchungen.find(x => x.id === b.id).zertifikatNr;
nr1 === nr2;   // erwartet: true
```

Danach `document.getElementById('druck-bereich').innerHTML = ''` und `localStorage.clear()` + neu laden.

- [ ] **Step 5: Commit**

```bash
git add Design/fragments/druck-vorlagen.js Design/assemble.py Design/fragments/page-schulungdetail.js Berichte/index.html
git commit -m "feat: Teilnahmebescheinigung nach tribeta-Vorlage, einzeln druckbar"
```

---

## Task 6: Schulungsabschluss auf der Detailseite

**Files:**
- Modify: `Design/fragments/page-schulungdetail.js`

**Interfaces:**
- Consumes: `istTerminAbgeschlossen`, `abschlussVollstaendigkeit`, `terminAbschliessen`, `terminWiedereroeffnen` (Task 2), `formatiereDatum`, `oeffneDialog`, `schliesseDialog`, `formularWerte`, `escHtml`, `escJsArg`
- Produces:
  - `detailAbschlussBanner(termin)` → HTML-String — Kopfhinweis, wenn der Termin abgeschlossen ist (inkl. Datum, Vorkommnissen, Wiederöffnungen und „Wieder öffnen"-Knopf)
  - `detailOeffneAbschlussDialog(terminId)` — geführter Abschluss mit Vollständigkeitshinweisen und Vorkommnis-Feld
  - `detailSpeichereAbschluss(ev, terminId)`
  - `detailWiedereroeffnen(terminId)`
  - Der Kopfbereich bekommt zusätzlich den Knopf „Schulung abschließen" (bzw. bei abgeschlossenem Termin keinen)

- [ ] **Step 1: Banner, Dialog und Handler anhängen**

```javascript
// ---- Phase 2: Schulungsabschluss ----

// Das Banner erscheint, sobald der Termin jemals foermlich abgeschlossen
// wurde - auch nach dem Wiederoeffnen, denn die Abschlusshistorie soll
// sichtbar bleiben. Ob aktuell schreibgeschuetzt wird, ist eine andere
// Frage und haengt an istTerminAbgeschlossen().
function detailAbschlussBanner(termin) {
  if (!termin.abschluss) return '';
  const a = termin.abschluss;
  const wieder = (a.wiedereroeffnungen || []).length;
  const gesperrt = istTerminAbgeschlossen(termin.id);
  return `
    <div class="abschluss-banner">
      <div>
        <strong>${gesperrt ? 'Abgeschlossen' : 'Wieder geöffnet · abgeschlossen war'} am ${formatiereDatum(a.abgeschlossenAm)}</strong>
        <div class="abschluss-hinweis">
          ${gesperrt
            ? 'Anwesenheit, Teilnehmerliste und Checkliste sind schreibgeschützt. Bescheinigungen und Abschlussbericht bleiben druckbar.'
            : 'Der Schreibschutz ist derzeit aufgehoben. Nach den Korrekturen bitte erneut abschließen.'}
          ${wieder > 0 ? `<br/>Nachträglich geöffnet: ${wieder}× (zuletzt ${formatiereDatum(a.wiedereroeffnungen[wieder - 1])})` : ''}
        </div>
        ${a.vorkommnisse ? `<div class="abschluss-hinweis">Vorkommnisse: ${escHtml(a.vorkommnisse)}</div>` : ''}
      </div>
      <button class="btn" onclick="detailWiedereroeffnen('${escJsArg(termin.id)}')">Wieder öffnen</button>
    </div>`;
}

function detailOeffneAbschlussDialog(terminId) {
  const v = abschlussVollstaendigkeit(terminId);
  const hinweise = [];
  if (v.anwesenheitFehlt > 0) hinweise.push(`Bei ${v.anwesenheitFehlt} Teilnehmer(n) ist die Anwesenheit noch nicht erfasst.`);
  if (v.checklisteOffen > 0) hinweise.push(`${v.checklisteOffen} Checklistenpunkt(e) sind noch offen.`);
  if (v.keinTrainer) hinweise.push('Diesem Termin ist kein Trainer zugeordnet.');

  const hinweisHtml = hinweise.length
    ? `<div class="field-hint" style="color:var(--status-amber-fg); font-size:12px;">
         <strong>Noch offen:</strong><ul style="margin:6px 0 0 0; padding-left:18px;">
           ${hinweise.map(h => `<li>${escHtml(h)}</li>`).join('')}
         </ul>
         <div style="margin-top:6px;">Du kannst trotzdem abschließen — die Punkte werden nur nachrichtlich angezeigt.</div>
       </div>`
    : '<div class="field-hint" style="color:var(--status-green-fg); font-size:12px;">Alles vollständig erfasst.</div>';

  oeffneDialog(`
    <div class="dialog-head"><h3>Schulung abschließen</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form onsubmit="return detailSpeichereAbschluss(event, '${escJsArg(terminId)}')">
      <div class="dialog-body">
        ${hinweisHtml}
        <div class="field">
          <label>Besondere Vorkommnisse (optional)</label>
          <textarea name="vorkommnisse" rows="3" placeholder="z. B. Teilnehmer Müller musste wegen Notfall früher gehen"></textarea>
        </div>
        <div class="field-hint">
          Nach dem Abschluss sind Anwesenheit, Teilnehmerliste und Checkliste dieses Termins
          schreibgeschützt. Ein späteres Wiederöffnen ist möglich, wird aber protokolliert
          und im Abschlussbericht ausgewiesen.
        </div>
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Jetzt abschließen</button>
      </div>
    </form>`);
}

function detailSpeichereAbschluss(ev, terminId) {
  ev.preventDefault();
  const felder = formularWerte(ev.target);
  try {
    terminAbschliessen(terminId, felder.vorkommnisse);
    schliesseDialog();
  } catch (e) {
    alert(e.message);
  }
  return false;
}

function detailWiedereroeffnen(terminId) {
  if (!confirm(
    'Diesen abgeschlossenen Termin wieder öffnen?\n\n'
    + 'Der Schreibschutz wird aufgehoben. Die Wiederöffnung wird mit Datum '
    + 'festgehalten und im Abschlussbericht ausgewiesen.'
  )) return;
  try {
    terminWiedereroeffnen(terminId);
  } catch (e) {
    alert(e.message);
  }
}
```

- [ ] **Step 2: Banner und Abschluss-Knopf in den Kopfbereich einhängen**

In `Design/fragments/page-schulungdetail.js`, in der Funktion `renderSchulungdetail`:

**(a)** Ergänze direkt **nach** der `crumb`-Zeile (dem „← Zurück zu Schulungen"-Knopf) und **vor** der Kopfkarte:

```javascript
    ${detailAbschlussBanner(termin)}
```

**(b)** Ergänze in der Knopfleiste der Kopfkarte, direkt **vor** dem Knopf „+ Teilnehmer", den Abschluss-Knopf — er erscheint nur, solange der Termin offen ist:

```javascript
          ${istTerminAbgeschlossen(termin.id) ? '' : `<button class="btn" onclick="detailOeffneAbschlussDialog('${escJsArg(termin.id)}')">Schulung abschließen</button>`}
```

- [ ] **Step 3: Build und Browser-Verifikation**

Run: `python Design/assemble.py`

Im Claude Browser Pane, nach `localStorage.clear()` und Neuladen, auf der Detailseite des Termins am 12.08.2026:
- Kopfleiste zeigt „Schulung abschließen", kein Banner
- Klick darauf → Dialog listet die offenen Punkte auf (Anwesenheit bei 5 Teilnehmern nicht erfasst, 5 Checklistenpunkte offen), Hinweis dass trotzdem abgeschlossen werden kann
- Abbrechen, dann „Alle auf 100 %" klicken, Checkliste komplett abhaken, Dialog erneut öffnen → jetzt steht „Alles vollständig erfasst."
- Vorkommnis eintragen und abschließen → Banner erscheint mit dem heutigen Datum und dem Vorkommnistext; der Knopf „Schulung abschließen" ist weg; Status-Badge im Kopf zeigt „abgeschlossen"
- Prüfen dass der Schreibschutz greift: Anwesenheitsfelder und Checklisten-Kästchen sind ausgegraut bzw. lösen bei Klick die Schreibschutz-Meldung aus; „+ Teilnehmer" führt zu derselben Meldung
- „Bescheinigung" bei einem Teilnehmer ist weiterhin aktiv (Bescheinigungen bleiben druckbar)
- „Wieder öffnen" klicken und bestätigen → Banner zeigt jetzt zusätzlich „Nachträglich geöffnet: 1×", Schreibschutz ist aufgehoben, „Schulung abschließen" ist wieder da
- Konsole ohne Fehler; danach `localStorage.clear()` und neu laden

**Hinweis zur Umgebung:** Die Vorschau unterdrückt natives `confirm()`. Für den Wiederöffnen-Schritt `window.confirm` in der Konsole vorübergehend auf `() => true` setzen und das im Bericht offenlegen.

- [ ] **Step 4: Commit**

```bash
git add Design/fragments/page-schulungdetail.js Berichte/index.html
git commit -m "feat: Schulungsabschluss mit Vollstaendigkeitspruefung und Wiederoeffnung"
```

---

## Task 7: Abschlussbericht

**Files:**
- Modify: `Design/fragments/druck-vorlagen.js`
- Modify: `Design/fragments/page-schulungdetail.js` (Knopf im Banner)

**Interfaces:**
- Consumes: `findeTerminMitKurs`, `anwesenheitsBuchungen`, `anwesenheitStatistik`, `erfuelltMindestteilnahme`, `terminAuslastung`, `trainerName`, `formatiereDatum`, `escHtml`, `druckeInhalt`, `window.LOGO_NORMAL`
- Produces:
  - `abschlussberichtHtml(terminId)` → `string`
  - `druckeAbschlussbericht(terminId)`

Der Bericht ist das interne Archivdokument und enthält deshalb bewusst **alle** Teilnehmer — anders als die Bescheinigung, die nur eine Person betrifft.

- [ ] **Step 1: Berichtsvorlage an `druck-vorlagen.js` anhängen**

```javascript
// ---- Abschlussbericht ----
// Internes Archivdokument: enthaelt bewusst ALLE Teilnehmer mit ihren
// Anwesenheiten, anders als die personenbezogene Bescheinigung.

function abschlussberichtHtml(terminId) {
  const gefunden = findeTerminMitKurs(terminId);
  if (!gefunden) throw new Error(`Termin ${terminId} nicht gefunden`);
  const { kurs, termin } = gefunden;
  const a = termin.abschluss;
  const buchungen = anwesenheitsBuchungen(terminId);
  const s = anwesenheitStatistik(terminId);
  const z = kurs.zertifikat || {};

  const zeilen = buchungen.map(b => {
    const t = window.STATE.teilnehmer.find(p => p.id === b.teilnehmerId);
    const erfasst = b.anwesenheitProzent !== null && b.anwesenheitProzent !== undefined;
    const erfuellt = erfuelltMindestteilnahme(b);
    return `
      <tr>
        <td>${escHtml(t ? t.name : '(unbekannt)')}</td>
        <td>${escHtml(t ? t.firma : '')}</td>
        <td${erfasst && !erfuellt ? ' class="negativ"' : ''}>${erfasst ? b.anwesenheitProzent + ' %' : 'nicht erfasst'}</td>
        <td>${escHtml(b.fehlgrund || '—')}</td>
        <td${erfuellt ? '' : ' class="negativ"'}>${b.zertifikatNr ? escHtml(b.zertifikatNr) : (erfuellt ? 'noch nicht ausgestellt' : 'nein')}</td>
      </tr>`;
  }).join('') || '<tr><td colspan="5">Keine Teilnehmer.</td></tr>';

  const agenda = (kurs.agenda || []).length
    ? `<table class="bericht-tabelle">
         <thead><tr><th style="width:26%">Zeit</th><th>Programmpunkt</th></tr></thead>
         <tbody>${kurs.agenda.map(p => `<tr><td>${escHtml(p.zeit)}</td><td>${escHtml(p.titel)}</td></tr>`).join('')}</tbody>
       </table>`
    : '<div style="font-size:10pt; color:#697187;">Keine Agenda hinterlegt.</div>';

  const wieder = a && (a.wiedereroeffnungen || []).length;
  const ausgestellt = buchungen.filter(b => b.zertifikatNr).length;

  return `
    <div class="druck-seite">
      <div class="bericht-kopf">
        <div>
          <h1 class="bericht-titel">Abschlussbericht</h1>
          <div class="bericht-untertitel">${escHtml(kurs.titel)} · ${formatiereDatum(termin.datum)}</div>
        </div>
        <img class="druck-logo" src="${window.LOGO_NORMAL}" alt="tribeta" />
      </div>

      <div class="bericht-meta">
        <div><div class="l">Kategorie</div>${escHtml(kurs.kategorie)}</div>
        <div><div class="l">Format / Ort</div>${escHtml(kurs.format)} · ${escHtml(termin.ort || '—')}</div>
        <div><div class="l">Umfang</div>${escHtml(String(z.umfangUE || '—'))} Unterrichtseinheiten</div>
        <div><div class="l">Trainer</div>${escHtml(trainerName(termin.trainerId) || 'kein Trainer zugeordnet')}</div>
        <div><div class="l">Vertretung</div>${escHtml(trainerName(termin.vertretungTrainerId) || '—')}</div>
        <div><div class="l">Abgeschlossen am</div>${a ? formatiereDatum(a.abgeschlossenAm) : 'nicht abgeschlossen'}</div>
      </div>

      <div class="bericht-abschnitt">Durchgeführte Agenda</div>
      ${agenda}

      <div class="bericht-abschnitt">Teilnehmer und Anwesenheit</div>
      <table class="bericht-tabelle">
        <thead><tr><th>Name</th><th>Firma</th><th>Anwesenheit</th><th>Fehlgrund</th><th>Bescheinigung</th></tr></thead>
        <tbody>${zeilen}</tbody>
      </table>
      <div class="bericht-kennzahlen">
        <div><strong>${s.gesamt}</strong> Teilnehmer</div>
        <div><strong>${s.erfuellt}</strong> erfüllen die Mindestteilnahme (${MINDEST_ANWESENHEIT} %)</div>
        <div><strong>${ausgestellt}</strong> Bescheinigung(en) ausgestellt</div>
        <div>Ø Anwesenheit: <strong>${s.durchschnitt !== null ? s.durchschnitt + ' %' : '—'}</strong></div>
      </div>

      <div class="bericht-abschnitt">Besondere Vorkommnisse</div>
      <div class="bericht-vorkommnisse">${a && a.vorkommnisse ? escHtml(a.vorkommnisse) : 'Keine.'}</div>
      ${wieder ? `<div class="bericht-warnung">Hinweis: Dieser Termin wurde nach dem Abschluss ${wieder}× wieder geöffnet (${a.wiedereroeffnungen.map(formatiereDatum).join(', ')}). Nachträgliche Änderungen sind daher möglich gewesen.</div>` : ''}

      <div class="bericht-unterschrift">
        <div class="zert-linie"></div>
        <span style="font-size:9pt; color:#697187;">Unterschrift Trainer</span>
      </div>
    </div>`;
}

function druckeAbschlussbericht(terminId) {
  try {
    const gefunden = findeTerminMitKurs(terminId);
    const html = abschlussberichtHtml(terminId);
    const dateiname = `Abschlussbericht_${gefunden.termin.datum}_${(gefunden.kurs.titel || '').replace(/\s+/g, '-')}`;
    druckeInhalt(html, dateiname);
  } catch (e) {
    alert('Abschlussbericht konnte nicht erzeugt werden: ' + e.message);
  }
}
```

- [ ] **Step 2: Knopf in das Abschluss-Banner einbauen**

Ersetze in `Design/fragments/page-schulungdetail.js` in `detailAbschlussBanner` den einzelnen „Wieder öffnen"-Knopf durch beide Knöpfe:

```javascript
      <div style="display:flex; gap:8px; flex:none;">
        <button class="btn btn-primary" onclick="druckeAbschlussbericht('${escJsArg(termin.id)}')">Abschlussbericht</button>
        <button class="btn" onclick="detailWiedereroeffnen('${escJsArg(termin.id)}')">Wieder öffnen</button>
      </div>`;
```

- [ ] **Step 3: Build und Browser-Verifikation**

Run: `python Design/assemble.py`

Im Claude Browser Pane, nach `localStorage.clear()` und Neuladen: Termin 12.08.2026 öffnen, „Alle auf 100 %", bei einem Teilnehmer 60 eintragen, bei einem anderen eine Bescheinigung erzeugen (über die Konsole, siehe Task 5), dann abschließen. Anschließend in der Konsole:

```javascript
document.getElementById('druck-bereich').innerHTML = abschlussberichtHtml('s1');
const d = document.getElementById('druck-bereich');
JSON.stringify({
  titel: d.querySelector('.bericht-titel').textContent,
  untertitel: d.querySelector('.bericht-untertitel').textContent,
  metaFelder: [...d.querySelectorAll('.bericht-meta .l')].map(e => e.textContent),
  teilnehmerZeilen: d.querySelectorAll('.bericht-tabelle tbody tr').length,
  negativZellen: d.querySelectorAll('td.negativ').length,
  kennzahlen: d.querySelector('.bericht-kennzahlen').textContent.replace(/\s+/g, ' ').trim(),
  vorkommnisse: d.querySelector('.bericht-vorkommnisse').textContent,
  hatWarnung: !!d.querySelector('.bericht-warnung')
}, null, 2)
```

Expected: `titel` „Abschlussbericht", `untertitel` mit Kurstitel und Datum, sechs Meta-Felder (Kategorie, Format/Ort, Umfang, Trainer, Vertretung, Abgeschlossen am), Teilnehmerzeilen entsprechend der Buchungen (Agenda-Tabelle nicht mitgezählt — falls die Auswahl beide Tabellen trifft, im Bericht vermerken und gezielt auf die zweite Tabelle einschränken), mindestens eine `negativ`-Zelle für den Teilnehmer mit 60 %, Kennzahlen mit Teilnehmerzahl/Mindestteilnahme/Bescheinigungen/Ø, Vorkommnistext, `hatWarnung` `false`.

Dann „Wieder öffnen" (mit `window.confirm = () => true`) und den Bericht erneut erzeugen → `hatWarnung` ist jetzt `true` und der Hinweistext nennt „1×".

Danach `document.getElementById('druck-bereich').innerHTML = ''`, `localStorage.clear()`, neu laden.

- [ ] **Step 4: Commit**

```bash
git add Design/fragments/druck-vorlagen.js Design/fragments/page-schulungdetail.js Berichte/index.html
git commit -m "feat: Abschlussbericht als druckbares Archivdokument"
```

---

## Task 8: Filter „Nur abgeschlossene" und Kennzeichnung auf der Schulungen-Seite

**Files:**
- Modify: `Design/fragments/page-schulungen.html`
- Modify: `Design/fragments/page-schulungen.js`

**Interfaces:**
- Consumes: `istTerminAbgeschlossen`, `druckeAbschlussbericht`, `escJsArg`
- Produces: keine neuen globalen Funktionen; erweitert `schulungenGefilterteKurse` und `schulungenTerminZeile`

- [ ] **Step 1: Filter in die Seite aufnehmen**

Ergänze in `Design/fragments/page-schulungen.html` in der `filter-bar`, nach dem Kategorie-Filter:

```html
  <select id="schulungen-abschluss-filter" class="filter-select" onchange="renderSchulungen()">
    <option value="">Termine: Alle</option>
    <option value="offen">Nur offene</option>
    <option value="abgeschlossen">Nur abgeschlossene</option>
  </select>
```

- [ ] **Step 2: Filterlogik und Kennzeichnung ergänzen**

Ersetze in `Design/fragments/page-schulungen.js` die Funktion `schulungenGefilterteKurse` vollständig durch:

```javascript
// Liefert die anzuzeigenden Kurse. Der Abschluss-Filter wirkt auf Termin-
// ebene: ein Kurs erscheint nur, wenn mindestens ein Termin zum Filter passt.
function schulungenGefilterteKurse() {
  const suche = (document.getElementById('schulungen-suche')?.value || '').toLowerCase();
  const kategorie = document.getElementById('schulungen-kategorie-filter')?.value || '';
  const abschluss = document.getElementById('schulungen-abschluss-filter')?.value || '';

  return window.STATE.kurse.filter(k => {
    if (suche && !k.titel.toLowerCase().includes(suche)) return false;
    if (kategorie && k.kategorie !== kategorie) return false;
    if (abschluss === 'abgeschlossen') return k.termine.some(t => t.abschluss);
    if (abschluss === 'offen') return k.termine.some(t => !t.abschluss);
    return true;
  });
}

// Welche Termine eines Kurses in der aufgeklappten Tabelle erscheinen -
// derselbe Filter wie oben, damit die Liste zur Auswahl passt.
function schulungenGefilterteTermine(kurs) {
  const abschluss = document.getElementById('schulungen-abschluss-filter')?.value || '';
  if (abschluss === 'abgeschlossen') return kurs.termine.filter(t => t.abschluss);
  if (abschluss === 'offen') return kurs.termine.filter(t => !t.abschluss);
  return kurs.termine;
}
```

Ersetze in `renderSchulungen` den Ausdruck `kurs.termine.map(t => schulungenTerminZeile(kurs, t)).join('')` durch:

```javascript
${schulungenGefilterteTermine(kurs).map(t => schulungenTerminZeile(kurs, t)).join('')}
```

und die vorangehende Bedingung `kurs.termine.length === 0` durch `schulungenGefilterteTermine(kurs).length === 0`.

Ergänze in `schulungenTerminZeile` in der Aktionsspalte, direkt **vor** dem „Öffnen"-Knopf, den Berichts-Knopf für abgeschlossene Termine:

```javascript
        ${termin.abschluss ? `<button class="btn" onclick="druckeAbschlussbericht('${escJsArg(termin.id)}')">Bericht</button>` : ''}
```

- [ ] **Step 3: Build und Browser-Verifikation**

Run: `python Design/assemble.py`

Im Claude Browser Pane, nach `localStorage.clear()` und Neuladen:
- Die Filterleiste zeigt drei Auswahlfelder; „Termine: Alle" ist vorausgewählt
- Einen Termin abschließen (Detailseite, Anwesenheit setzen, abschließen), zurück zu „Schulungen"
- Filter „Nur abgeschlossene" → nur der Kurs mit diesem Termin erscheint, und beim Aufklappen nur der abgeschlossene Termin; dessen Zeile zeigt den Status „abgeschlossen" und einen zusätzlichen Knopf „Bericht"
- Filter „Nur offene" → dieser Termin verschwindet, die übrigen bleiben
- Filter zurück auf „Alle" → alles wieder da
- Kombination mit dem Kategorie-Filter funktioniert (beide gleichzeitig eingrenzen)
- Konsole ohne Fehler; danach `localStorage.clear()` und neu laden

- [ ] **Step 4: Commit**

```bash
git add Design/fragments/page-schulungen.html Design/fragments/page-schulungen.js Berichte/index.html
git commit -m "feat: Filter fuer abgeschlossene Termine und direkter Berichtszugriff"
```

---

## Task 9: Hilfeseite um Phase 2 ergänzen

**Files:**
- Modify: `Design/fragments/page-hilfe.html`

**Interfaces:** keine (statische Seite)

- [ ] **Step 1: Zwei Abschnitte ergänzen**

Füge in `Design/fragments/page-hilfe.html` **vor** dem Block „Wo die Daten liegen" ein:

```html
  <div class="hilfe-block">
    <h3>Anwesenheit und Bescheinigungen</h3>
    <p>Nach der Schulung trägst du auf der Detailseite des Termins im Abschnitt <strong>Anwesenheit</strong> je Teilnehmer ein, zu wie viel Prozent er anwesend war. Über <strong>„Alle auf 100 %"</strong> setzt du zuerst alle auf volle Anwesenheit und korrigierst danach nur die Ausnahmen.</p>
    <p>Liegt jemand unter 100 %, kannst du zusätzlich einen Grund hinterlegen (krank, entschuldigt, unentschuldigt). Bei voller Anwesenheit wird ein zuvor gesetzter Grund automatisch entfernt.</p>
    <p>Ab <strong>80 % Anwesenheit</strong> lässt sich für eine Person eine <strong>Teilnahmebescheinigung</strong> drucken. Darunter bleibt der Knopf gesperrt und nennt den Grund. Die Bescheinigung wird bewusst <strong>immer nur einzeln</strong> erzeugt — ein Sammeldokument würde beim Versand an eine Person die Daten aller anderen mitliefern.</p>
    <p>Jede Bescheinigung bekommt eine fortlaufende <strong>Zertifikatsnummer</strong> (Schema Jahr-Kürzel-Nummer, z.&nbsp;B. 2026-DSB-0147). Sie wird beim ersten Druck vergeben und bleibt danach unverändert — ein zweiter Ausdruck trägt dieselbe Nummer.</p>
    <p>Gedruckt wird über die Druckfunktion deines Browsers; dort wählst du „Als PDF speichern". Der vorgeschlagene Dateiname enthält Nummer und Namen.</p>
  </div>

  <div class="hilfe-block">
    <h3>Schulung abschließen und Abschlussbericht</h3>
    <p>Ist eine Schulung gelaufen und die Anwesenheit erfasst, schließt du sie über <strong>„Schulung abschließen"</strong> ab. Das System zeigt vorher, was noch offen ist (fehlende Anwesenheit, offene Checklistenpunkte, fehlender Trainer) — du kannst trotzdem abschließen, die Hinweise sind nachrichtlich.</p>
    <p><strong>Abschluss bedeutet Festschreibung:</strong> Anwesenheit, Teilnehmerliste und Checkliste dieses Termins sind danach schreibgeschützt. Genau das macht die Dokumentation als Nachweis belastbar — eine jederzeit änderbare Anwesenheitsliste wäre wertlos.</p>
    <p>Bescheinigungen und der Abschlussbericht bleiben jederzeit druckbar. Die kursweiten Inhalte (Beschreibung, Agenda, Materialien) bleiben ebenfalls pflegbar, da sie zu künftigen Terminen desselben Kurses gehören.</p>
    <p>Korrekturen sind trotzdem möglich: <strong>„Wieder öffnen"</strong> hebt den Schutz auf. Das wird mit Datum festgehalten und im Abschlussbericht ausgewiesen — nicht verhindern, aber sichtbar machen.</p>
    <p>Der <strong>Abschlussbericht</strong> ist das interne Archivdokument: Kurs- und Termindaten, durchgeführte Agenda, alle Teilnehmer mit Anwesenheit und ausgestellter Bescheinigung, Kennzahlen, besondere Vorkommnisse und eine Unterschriftszeile. Anders als die Bescheinigung enthält er bewusst alle Teilnehmer. Du erreichst ihn über das Banner auf der Detailseite oder über den Knopf „Bericht" in der Terminliste.</p>
    <p>Auf der Seite <strong>Schulungen</strong> kannst du über den Filter „Termine" gezielt nur offene oder nur abgeschlossene Termine anzeigen.</p>
  </div>
```

- [ ] **Step 2: Build und Verifikation**

Run: `python Design/assemble.py`

Im Claude Browser Pane die Hilfeseite öffnen: die beiden neuen Abschnitte erscheinen zwischen „Kategorien" und „Wo die Daten liegen", Umlaute korrekt.

Run: `python -c "c=open('Berichte/index.html',encoding='utf-8').read(); assert 'Zertifikatsnummer' in c and 'Festschreibung' in c and 'ä' in c and 'Ã¤' not in c; print('ok, Laenge:', len(c))"`

- [ ] **Step 3: Commit**

```bash
git add Design/fragments/page-hilfe.html Berichte/index.html
git commit -m "docs: Hilfeseite um Anwesenheit, Bescheinigungen und Abschluss ergaenzen"
```

---

## Task 10: Zusammenbau und Ende-zu-Ende-Verifikation

**Files:**
- Modify: `Berichte/index.html` (nur über `assemble.py`)

**Interfaces:** Consumes alle vorherigen Tasks

- [ ] **Step 1: Sauberer Build und Datenprüfung**

Run: `python Design/verify_migration_v3.py && python Design/assemble.py`
Expected: „v3-Migration verifiziert: keine Fehler." und eine fehlerfreie Build-Meldung.

- [ ] **Step 2: Grundzustand**

`localStorage.clear()`, neu laden, dann `read_console_messages` mit `onlyErrors: true`.
Expected: keine Fehler; `window.STATE.kurse.length` → 8, `window.STATE.trainer.length` → 5, `document.querySelectorAll('.sidebar-nav-item').length` → 5.

- [ ] **Step 3: Vollständige Nachweiskette an einem Termin durchspielen**

Am Termin 12.08.2026 („Datenschutzbeauftragter Grundlagenschulung", 5 Teilnehmer):
1. Anwesenheit: „Alle auf 100 %", dann bei einem Teilnehmer 60 % mit Grund „krank"
2. Prüfen: Zeile rot, „unter 80 %", dessen Bescheinigungs-Knopf gesperrt, die anderen vier aktiv
3. Bei zwei Teilnehmern nacheinander die Bescheinigung erzeugen (Vorlage über die Konsole prüfen wie in Task 5) → Nummern `2026-DSB-0147` und `2026-DSB-0148`, beide bleiben bei erneutem Aufruf stabil
4. Checkliste vollständig abhaken
5. „Schulung abschließen" → Dialog meldet „Alles vollständig erfasst.", Vorkommnis eintragen, abschließen
6. Prüfen: Banner mit Datum und Vorkommnis, Status „abgeschlossen", Schreibschutz greift (Anwesenheit, Checkliste, „+ Teilnehmer" jeweils gesperrt bzw. mit Schreibschutz-Meldung), Bescheinigungen weiterhin druckbar
7. Abschlussbericht erzeugen → enthält alle 5 Teilnehmer, die 60-%-Zeile ist als negativ markiert, Kennzahlen stimmen (5 Teilnehmer, 4 erfüllen, 2 Bescheinigungen, Ø 92 %), keine Wiederöffnungs-Warnung
8. „Wieder öffnen" → Bericht erneut erzeugen, jetzt mit Warnung „1×"; Schreibschutz aufgehoben

Expected: jeder Schritt wie beschrieben, keine Konsolenfehler.

- [ ] **Step 4: Filter und Übergreifendes**

- „Schulungen" → Filter „Nur abgeschlossene" bzw. „Nur offene" grenzen korrekt ein, „Bericht"-Knopf nur bei abgeschlossenen Terminen
- Übersicht: der bearbeitete Termin verhält sich weiterhin korrekt (Auslastung, keine „Unterbesetzt"-Anzeige bei abgeschlossenem Termin)
- Buchungen: Liste weiterhin fehlerfrei, Uhr-Marker unverändert korrekt

- [ ] **Step 5: Persistenz und Export**

Seite neu laden → Anwesenheiten, Zertifikatsnummern und der Abschlusszustand sind erhalten. „Exportieren" löst einen Download aus; die exportierte Datei enthält `anwesenheitProzent`, `zertifikatNr` und `abschluss` (im Download-Verzeichnis prüfen oder über `JSON.stringify(window.STATE)` gegenprüfen).

- [ ] **Step 6: Umlaute im ausgelieferten Build (CLAUDE.md-Pflicht)**

Run: `python -c "c=open('Berichte/index.html',encoding='utf-8').read(); assert 'Mindestteilnahme' in c and 'schreibgeschützt' in c and 'Gültigkeit' in c and '�' not in c and 'Ã¤' not in c, 'Umlaute defekt'; print('Umlaute ok, Laenge:', len(c))"`

- [ ] **Step 7: Abschließender Zustand und Commit**

Im Browser „Zurücksetzen" klicken, damit der lokale Stand wieder den Beispieldaten entspricht.

```bash
git add Berichte/index.html
git commit -m "chore: finaler Build nach Ende-zu-Ende-Verifikation Phase 2"
```

Zeigt `git status` keine Änderung an `Berichte/index.html` (weil der Build bereits in Task 9 committet wurde), ist das der erwartete Normalfall — diesen Schritt dann überspringen und im Bericht vermerken.

---

## Selbst-Review-Notizen (bereits eingearbeitet)

- **Spec-Abdeckung** gegen `Design/design-spec-v3.md`, Phase 2: Anwesenheit mit Prozent, Fehlgrund, 80-%-Regel, Zusammenfassung und „Alle auf 100 %" (Task 1, 4) · Bescheinigung als Nachbau der Vorlage, ausschließlich einzeln, mit stabiler Nummer und deaktiviertem Knopf samt Begründung (Task 3, 5) · Abschluss mit Vollständigkeitsprüfung, Festschreibung und protokollierter Wiederöffnung (Task 2, 6) · Abschlussbericht mit allen geforderten Bestandteilen (Task 7) · Filter „Nur abgeschlossene" (Task 8) · Hilfeseite (Task 9).
- **Platzhalter-Scan:** keine TBD/TODO; jeder Code-Schritt enthält vollständigen, lauffähigen Code.
- **Typ-Konsistenz geprüft:** `anwesenheitStatistik` liefert durchgängig `{gesamt, erfasst, erfuellt, unterMindest, durchschnitt}` und wird in Task 4 und 7 so gelesen; `abschlussVollstaendigkeit` liefert `{anwesenheitFehlt, checklisteOffen, keinTrainer}` und wird in Task 6 so gelesen; `anwesenheitsBuchungen` ist in Task 4, 5 und 7 dieselbe maßgebliche Menge (ohne abgesagte); `zertifikatNummerFuer` ist idempotent und wird in Task 5 und 7 so genutzt.
- **Bewusste Entscheidungen:** `loescheKurs` erhält keinen Schreibschutz-Guard (Begründung in Task 2, Step 2) — Löschen eines ganzen Kurses ist eine bewusste Aktion auf anderer Ebene. Der Druck läuft über einen versteckten Bereich im selben Dokument statt über ein zweites Fenster, weil das offline zuverlässig funktioniert und keine Popup-Blocker-Probleme erzeugt. Die Zertifikatsnummer wird erst beim tatsächlichen Druck vergeben, nicht beim Anzeigen der Liste.

