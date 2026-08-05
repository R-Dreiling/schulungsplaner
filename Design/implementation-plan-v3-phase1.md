# Schulungsplaner v3 – Phase 1 (Stammdaten & Planung) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den Schulungsplaner von festverdrahteten Stammdaten auf frei pflegbare umstellen: Kategorien als Freitext, Format/Min-/Maxteilnehmerzahl und Zertifikatsfelder am Kurs, ein neuer Trainer-Bereich mit Nachweisdokumenten und Vertretungsregelung, Status-Automatik, Hilfebereich und eine „Alle Daten leeren"-Funktion für den Produktivstart.

**Architecture:** Unverändert eine einzelne selbsterklärende `Berichte/index.html`, gebaut aus Shell + gemeinsamem CSS + JS-Modulen + Seiten-Fragmenten über `Design/assemble.py`. State im `localStorage`, hochgeladene Dateien in `IndexedDB`. Phase 1 erweitert das bestehende Datenmodell (Kurs/Termin/Buchung) um Trainer und Einstellungen und verschiebt Format/Kapazität vom Termin auf den Kurs.

**Tech Stack:** Vanilla HTML/CSS/JS (kein Framework, kein Build-Tool, kein Node.js auf dieser Maschine), Python 3 für den lokalen Zusammenbau (`assemble.py`) und die einmalige Datenmigration.

## Global Constraints

- Kein Server/Backend, keine Mehrbenutzer-Synchronisation — Daten liegen lokal im Browser (siehe `Design/design-spec-v3.md`, Abschnitt „Aus dem Scope ausgeschlossen")
- Design-Tokens/Farben/Schriften strikt aus `Design/styles.css` bzw. Wurzel-`CLAUDE.md` (Poppins/Mulish, Teal `#2BD5D8`/`#0B8A8D`, Indigo `#6C7BFF`/`#4D5EE6`, Lime `#BFF247`/`#7FAE13`, Ink `#0A1028`) — keine neuen Akzentfarben erfinden
- Status-Farb-Zuordnung app-weit einheitlich: Grün = bestätigt/aktiv/laufend, Amber = angemeldet/geplant/unterbesetzt, Grau = abgeschlossen/neutral, Rot = abgesagt/Fehler, Indigo = ausgebucht/voll
- Jede Funktion muss einem konkreten Planungs- oder Nachweiszweck dienen, keine dekorativen Spielereien
- Kein Node.js/npm verfügbar — keine JS-Build-Tools, kein JS-Testrunner. Verifikation von JS/UI-Code erfolgt manuell im Browser (Claude Browser Pane, `mcp__Claude_Browser__*`-Werkzeuge)
- Vor jeder Browser-Verifikation `localStorage.clear()` ausführen und neu laden, damit Teststände früherer Durchläufe die Prüfung nicht verfälschen
- Jeder Task endet mit `git add` + `git commit`; jeder Task, der Quelldateien ändert, baut vorher mit `python Design/assemble.py` neu und committet `Berichte/index.html` mit
- Deutsch als UI-Sprache durchgehend, Umlaute korrekt in UTF-8; Verifikation von Umlauten immer am Dateiinhalt (Python `repr()`/Lesen), nie anhand der Terminalausgabe
- Nutzertext, der in ein HTML-Attribut interpoliert wird, muss durch `escAttr()`; Nutzertext als JS-String-Argument in einem Inline-Handler durch `escJsArg()` (beide in `Design/ui-helpers.js`)
- Destruktive Aktionen bestätigen über natives `confirm()`

---

## Datei-Übersicht

| Datei | Aktion | Zweck |
|---|---|---|
| `Design/migrate_data_v3.py` | neu | Einmalige Migration v2-Struktur → v3 (Format/Kapazität zum Kurs, Trainer, neue Felder) |
| `Design/verify_migration_v3.py` | neu | Invarianten der migrierten v3-Daten prüfen |
| `Daten/schulungsdaten.json` | überschrieben | Ergebnis der Migration |
| `Design/state-engine.js` | erweitert | Einstellungen, Kategorienliste, Trainer-CRUD, Status-Automatik, Alle-Daten-leeren; `terminAuslastung` liest Kapazität jetzt vom Kurs |
| `Design/file-store.js` | erweitert | Trainer-Dokumente, komplettes Löschen aller Dateien |
| `Design/ui-helpers.js` | erweitert | `trainerName()`-Helfer für die Anzeige |
| `Design/styles.css` | erweitert | Klassen für Trainer-Seite, Hilfe-Seite, Unterbesetzt-Badge, Automatik-Kennzeichen |
| `Design/shell-template.html` | erweitert | Menüpunkte „Trainer" und „Hilfe", Seiten-Container, „Alle Daten leeren", Aufruf der Status-Automatik |
| `Design/assemble.py` | angepasst | Neue Seiten `page-trainer` und `page-hilfe` einbinden |
| `Design/fragments/page-schulungen.html/.js` | überarbeitet | Kategorie-Freitext, Kurs-Felder (Format/Min/Max/Zertifikat), Trainer-Auswahl + Vertretung am Termin |
| `Design/fragments/page-trainer.html/.js` | neu | Trainer-Liste und -Detail mit Dokumenten |
| `Design/fragments/page-uebersicht.js` | erweitert | „Unterbesetzt"-Kennzeichnung |
| `Design/fragments/page-buchungen.js` | erweitert | Uhr-Symbol bei automatisch gesetztem Status |
| `Design/fragments/page-hilfe.html` | neu | Statische Hilfeseite |
| `Design/fragments/page-schulungdetail.js` | angepasst | Trainer-/Vertretungsanzeige statt Textfeld |

---

## Task 1: Datenmodell-Migration auf v3

**Files:**
- Create: `Design/migrate_data_v3.py`
- Create: `Design/verify_migration_v3.py`
- Modify: `Daten/schulungsdaten.json` (wird vom Skript überschrieben)

**Interfaces:**
- Produces: `Daten/schulungsdaten.json` mit Top-Level-Keys `kurse`, `teilnehmer`, `buchungen`, **`trainer`** (neu), **`einstellungen`** (neu)
  - Kurs: `{id, titel, kategorie, beschreibung, lernziele, voraussetzungen, format, minTeilnehmer, maxTeilnehmer, zertifikat:{kuerzel, umfangUE, ueberschrift, bestaetigungstext, gueltigkeit}, agenda, materialien:{seminarunterlagen,vorlagen}, termine:[…]}` — **ohne** `zielgruppe`
  - Termin: `{id, datum, trainerId, vertretungTrainerId, ort, status, checkliste, abschluss}` — **ohne** `format`, **ohne** `kapazitaet`, **ohne** `trainer`
  - Trainer: `{id, name, email, telefon, qualifikation, notizen, dokumente:[]}`, IDs mit Präfix `tr`
  - Buchung: `{id, teilnehmerId, terminId, anmeldestatus, gebuchtAm, anwesenheitProzent, fehlgrund, zertifikatNr, statusManuell}`
  - Einstellungen: `{zertifikatStartNummer: 147, bestaetigungsfristTage: 7}`

- [ ] **Step 1: Migrationsskript schreiben**

```python
# Design/migrate_data_v3.py
# -*- coding: utf-8 -*-
"""Einmalige Migration v2 -> v3.

Verschiebt Format und Kapazitaet vom Termin auf den Kurs, ergaenzt Min-/
Maxteilnehmerzahl und Zertifikatsfelder, macht aus den bisherigen Trainer-
Namensfeldern echte Trainer-Datensaetze und ergaenzt die neuen Buchungs-
felder. Die v2-Daten sind hierfuer konsistent: jeder Kurs hat ueber alle
seine Termine dasselbe Format und dieselbe Kapazitaet."""
import json
from pathlib import Path

BASE = Path(__file__).parent
DATA_PATH = BASE.parent / "Daten" / "schulungsdaten.json"

# Kurs-Kuerzel fuer die Zertifikatsnummer. Bewusst handverlesen statt aus dem
# Titel abgeleitet, damit die Kuerzel lesbar und eindeutig sind.
KUERZEL = {
    "k1": "DSB", "k2": "DSGVO-FK", "k3": "HINSCHG", "k4": "ASIB",
    "k5": "GBU", "k6": "BSH", "k7": "EH", "k8": "DS-AUF",
}

UMFANG_UE = {
    "k1": 40, "k2": 8, "k3": 8, "k4": 8,
    "k5": 8, "k6": 8, "k7": 9, "k8": 4,
}

# Der Bestaetigungstext folgt der tribeta-Vorlage 09_Zertifikat_Vorlage.pdf.
# k1 ist der Zertifizierungslehrgang mit Abschlusspruefung, alle anderen
# bekommen eine neutrale Teilnahmeformulierung.
TEXT_K1 = (
    "den Zertifizierungslehrgang „{kurs}“ – Fachkunde nach Art. 37 DSGVO – "
    "im Umfang von {umfang} Unterrichtseinheiten erfolgreich absolviert und "
    "die Abschlussprüfung bestanden hat. Damit wurde die für die Rolle "
    "erforderliche Fachkunde nachgewiesen."
)
TEXT_STANDARD = (
    "an der Schulung „{kurs}“ im Umfang von {umfang} Unterrichtseinheiten "
    "am {datum} in {ort} teilgenommen hat."
)

UEBERSCHRIFT = {
    "k1": "Zertifizierungslehrgang Datenschutzbeauftragte:r",
}

MIN_TEILNEHMER_VORGABE = 5


def migriere():
    alt = json.loads(DATA_PATH.read_text(encoding="utf-8"))

    # --- Trainer aus den bisherigen Namensfeldern aufbauen ---
    namen = []
    for kurs in alt["kurse"]:
        for termin in kurs["termine"]:
            name = termin.get("trainer", "").strip()
            if name and name not in namen:
                namen.append(name)
    namen.sort()

    trainer = []
    trainer_id_je_name = {}
    for i, name in enumerate(namen, start=1):
        tid = f"tr{i}"
        trainer_id_je_name[name] = tid
        trainer.append({
            "id": tid, "name": name, "email": "", "telefon": "",
            "qualifikation": "", "notizen": "", "dokumente": [],
        })

    # --- Kurse umbauen ---
    for kurs in alt["kurse"]:
        formate = {t["format"] for t in kurs["termine"]}
        kapazitaeten = {t["kapazitaet"] for t in kurs["termine"]}
        if len(formate) != 1 or len(kapazitaeten) != 1:
            raise SystemExit(
                f"Kurs {kurs['id']} hat uneinheitliches Format/Kapazitaet "
                f"({formate} / {kapazitaeten}) - Migration abgebrochen."
            )

        kurs["format"] = formate.pop()
        kurs["maxTeilnehmer"] = kapazitaeten.pop()
        kurs["minTeilnehmer"] = MIN_TEILNEHMER_VORGABE
        kurs.pop("zielgruppe", None)

        kurs["zertifikat"] = {
            "kuerzel": KUERZEL[kurs["id"]],
            "umfangUE": UMFANG_UE[kurs["id"]],
            "ueberschrift": UEBERSCHRIFT.get(kurs["id"], kurs["titel"]),
            "bestaetigungstext": TEXT_K1 if kurs["id"] == "k1" else TEXT_STANDARD,
            "gueltigkeit": "unbefristet",
        }

        for termin in kurs["termine"]:
            termin["trainerId"] = trainer_id_je_name.get(termin.get("trainer", "").strip())
            termin["vertretungTrainerId"] = None
            termin["abschluss"] = None
            termin.pop("trainer", None)
            termin.pop("format", None)
            termin.pop("kapazitaet", None)

    # --- Buchungen um die neuen Felder ergaenzen ---
    for buchung in alt["buchungen"]:
        buchung["anwesenheitProzent"] = None
        buchung["fehlgrund"] = None
        buchung["zertifikatNr"] = None
        buchung["statusManuell"] = False

    neu = {
        "kurse": alt["kurse"],
        "teilnehmer": alt["teilnehmer"],
        "buchungen": alt["buchungen"],
        "trainer": trainer,
        "einstellungen": {"zertifikatStartNummer": 147, "bestaetigungsfristTage": 7},
    }
    DATA_PATH.write_text(json.dumps(neu, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Migriert auf v3: {len(neu['kurse'])} Kurse, "
          f"{sum(len(k['termine']) for k in neu['kurse'])} Termine, "
          f"{len(neu['teilnehmer'])} Teilnehmer, {len(neu['buchungen'])} Buchungen, "
          f"{len(trainer)} Trainer")


if __name__ == "__main__":
    migriere()
```

- [ ] **Step 2: Verifikationsskript schreiben**

```python
# Design/verify_migration_v3.py
# -*- coding: utf-8 -*-
"""Prueft Invarianten der auf v3 migrierten Daten. Exit-Code 1 bei Fehlern."""
import json
from pathlib import Path

DATA_PATH = Path(__file__).parent.parent / "Daten" / "schulungsdaten.json"


def main():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    fehler = []

    for key in ("kurse", "teilnehmer", "buchungen", "trainer", "einstellungen"):
        if key not in data:
            fehler.append(f"Top-Level-Key '{key}' fehlt")
    if fehler:
        print("FEHLER GEFUNDEN:")
        for f in fehler:
            print(" -", f)
        raise SystemExit(1)

    trainer_ids = {t["id"] for t in data["trainer"]}
    if len(data["trainer"]) != 5:
        fehler.append(f"Erwartet 5 Trainer, gefunden {len(data['trainer'])}")
    for t in data["trainer"]:
        for feld in ("id", "name", "email", "telefon", "qualifikation", "notizen", "dokumente"):
            if feld not in t:
                fehler.append(f"Trainer {t.get('id')} fehlt Feld '{feld}'")
        if not isinstance(t.get("dokumente"), list):
            fehler.append(f"Trainer {t.get('id')}: dokumente ist keine Liste")

    alle_termin_ids = set()
    for kurs in data["kurse"]:
        for feld in ("format", "minTeilnehmer", "maxTeilnehmer", "zertifikat"):
            if feld not in kurs:
                fehler.append(f"Kurs {kurs.get('id')} fehlt neues Feld '{feld}'")
        if "zielgruppe" in kurs:
            fehler.append(f"Kurs {kurs['id']} hat noch das alte Feld 'zielgruppe'")
        if kurs.get("format") not in ("Vor Ort", "Online", "Hybrid"):
            fehler.append(f"Kurs {kurs.get('id')}: ungueltiges Format {kurs.get('format')!r}")
        if not isinstance(kurs.get("minTeilnehmer"), int) or kurs["minTeilnehmer"] < 1:
            fehler.append(f"Kurs {kurs.get('id')}: minTeilnehmer ungueltig")
        if not isinstance(kurs.get("maxTeilnehmer"), int) or kurs["maxTeilnehmer"] < 1:
            fehler.append(f"Kurs {kurs.get('id')}: maxTeilnehmer ungueltig")
        if kurs.get("minTeilnehmer", 0) > kurs.get("maxTeilnehmer", 0):
            fehler.append(f"Kurs {kurs.get('id')}: minTeilnehmer > maxTeilnehmer")

        zert = kurs.get("zertifikat", {})
        for feld in ("kuerzel", "umfangUE", "ueberschrift", "bestaetigungstext", "gueltigkeit"):
            if feld not in zert:
                fehler.append(f"Kurs {kurs.get('id')}: zertifikat fehlt Feld '{feld}'")

        for termin in kurs["termine"]:
            for feld in ("trainerId", "vertretungTrainerId", "abschluss"):
                if feld not in termin:
                    fehler.append(f"Termin {termin.get('id')} fehlt neues Feld '{feld}'")
            for altfeld in ("trainer", "format", "kapazitaet"):
                if altfeld in termin:
                    fehler.append(f"Termin {termin.get('id')} hat noch das alte Feld '{altfeld}'")
            if termin.get("trainerId") is not None and termin["trainerId"] not in trainer_ids:
                fehler.append(f"Termin {termin['id']}: unbekannte trainerId {termin['trainerId']}")
            if termin.get("abschluss") is not None:
                fehler.append(f"Termin {termin['id']}: abschluss sollte null sein")
            alle_termin_ids.add(termin["id"])

    for b in data["buchungen"]:
        for feld in ("anwesenheitProzent", "fehlgrund", "zertifikatNr", "statusManuell"):
            if feld not in b:
                fehler.append(f"Buchung {b.get('id')} fehlt neues Feld '{feld}'")
        if b.get("statusManuell") is not False:
            fehler.append(f"Buchung {b.get('id')}: statusManuell sollte false sein")
        if b.get("terminId") not in alle_termin_ids:
            fehler.append(f"Buchung {b.get('id')}: unbekannte terminId {b.get('terminId')}")

    e = data["einstellungen"]
    if e.get("zertifikatStartNummer") != 147:
        fehler.append("einstellungen.zertifikatStartNummer sollte 147 sein")
    if e.get("bestaetigungsfristTage") != 7:
        fehler.append("einstellungen.bestaetigungsfristTage sollte 7 sein")

    if fehler:
        print("FEHLER GEFUNDEN:")
        for f in fehler:
            print(" -", f)
        raise SystemExit(1)
    print("v3-Migration verifiziert: keine Fehler.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Migration ausführen und verifizieren**

Run: `python Design/migrate_data_v3.py && python Design/verify_migration_v3.py`
Expected: Erste Zeile meldet „Migriert auf v3: 8 Kurse, 10 Termine, 33 Teilnehmer, 36 Buchungen, 5 Trainer", danach „v3-Migration verifiziert: keine Fehler."

- [ ] **Step 4: Umlaute im Ergebnis prüfen (CLAUDE.md-Pflicht)**

Run: `python -c "import json; d=json.load(open('Daten/schulungsdaten.json', encoding='utf-8')); print(repr(d['kurse'][0]['zertifikat']['bestaetigungstext'][:60])); print(repr([t['name'] for t in d['trainer']]))"`
Expected: Umlaute und typografische Anführungszeichen erscheinen korrekt (z. B. `'„{kurs}“'`, `'Dr. Julia Berg'`), nicht als `?` oder kaputte Bytes.

- [ ] **Step 5: Commit**

```bash
git add Design/migrate_data_v3.py Design/verify_migration_v3.py Daten/schulungsdaten.json
git commit -m "feat: Datenmodell auf v3 migrieren (Trainer, Kurs-Format/Kapazitaet, Zertifikatsfelder)"
```

---

## Task 2: State-Engine — Einstellungen, Kategorien, Trainer-CRUD, Auslastung am Kurs

**Files:**
- Modify: `Design/state-engine.js`

**Interfaces:**
- Consumes: `window.STATE`, `speichereState()`, `naechsteId()`, `findeKurs()`, `findeTerminMitKurs()` (bestehend)
- Produces:
  - `STORAGE_KEY` ist jetzt `'schulungsplaner_state_v3'` (bewusster Bruch: v2-Stände im Browser haben ein inkompatibles Schema und würden die App zerlegen; sie werden ignoriert, die Beispieldaten greifen)
  - `einstellungen()` → das Einstellungs-Objekt (legt Vorgabewerte an, falls es fehlt)
  - `aktualisiereEinstellungen(felder)` — merged und speichert
  - `kategorienListe()` → `[string]` alphabetisch sortiert, eindeutig, aus allen Kursen
  - `findeTrainer(trainerId)` → Trainer-Objekt | `undefined`
  - `trainerName(trainerId)` → `string` — Name oder `''` bei `null`/unbekannt
  - `erstelleTrainer(felder)` → neue `id` (Präfix `tr`)
  - `aktualisiereTrainer(trainerId, felder)`
  - `loescheTrainer(trainerId)` — setzt `trainerId`/`vertretungTrainerId` betroffener Termine auf `null`
  - `termineFuerTrainer(trainerId)` → `[{kurs, termin, rolle}]` mit `rolle` = `'trainer' | 'vertretung'`
  - `trainerDokumentStatus(trainer)` → `{abgelaufen: n, laeuftBaldAb: n}` (bald = innerhalb 60 Tagen)
  - `terminAuslastung(terminId)` liefert **zusätzlich** `minTeilnehmer` und `unterbesetzt` (Boolean); `kapazitaet` kommt jetzt aus `kurs.maxTeilnehmer` statt `termin.kapazitaet`

- [ ] **Step 1: Storage-Key anheben und Einstellungen ergänzen**

Ersetze in `Design/state-engine.js` die Zeile `const STORAGE_KEY = 'schulungsplaner_state_v2';` durch:

```javascript
// v3: Das Schema hat sich inkompatibel geaendert (Trainer, Format/Kapazitaet
// am Kurs). Ein alter v2-Stand im Browser wuerde die App zerlegen, daher ein
// neuer Schluessel - alte Staende werden ignoriert, die Beispieldaten greifen.
const STORAGE_KEY = 'schulungsplaner_state_v3';
```

Und hänge am Dateiende an:

```javascript
// -- Einstellungen --

const EINSTELLUNGEN_VORGABE = {
  zertifikatStartNummer: 147,
  bestaetigungsfristTage: 7,
};

function einstellungen() {
  if (!window.STATE.einstellungen) {
    window.STATE.einstellungen = { ...EINSTELLUNGEN_VORGABE };
  }
  for (const [schluessel, wert] of Object.entries(EINSTELLUNGEN_VORGABE)) {
    if (window.STATE.einstellungen[schluessel] === undefined) {
      window.STATE.einstellungen[schluessel] = wert;
    }
  }
  return window.STATE.einstellungen;
}

function aktualisiereEinstellungen(felder) {
  Object.assign(einstellungen(), felder);
  speichereState();
}

// -- Kategorien (abgeleitet, keine eigene Verwaltung) --

function kategorienListe() {
  const gesehen = new Set();
  for (const kurs of window.STATE.kurse) {
    const wert = (kurs.kategorie || '').trim();
    if (wert) gesehen.add(wert);
  }
  return [...gesehen].sort((a, b) => a.localeCompare(b, 'de'));
}
```

- [ ] **Step 2: Trainer-CRUD anhängen**

```javascript
// -- Trainer --

function alleTrainer() {
  if (!Array.isArray(window.STATE.trainer)) window.STATE.trainer = [];
  return window.STATE.trainer;
}

function findeTrainer(trainerId) {
  return alleTrainer().find(t => t.id === trainerId);
}

function trainerName(trainerId) {
  const t = findeTrainer(trainerId);
  return t ? t.name : '';
}

function erstelleTrainer(felder) {
  const id = naechsteId('tr', alleTrainer());
  alleTrainer().push({
    id,
    name: felder.name,
    email: felder.email || '',
    telefon: felder.telefon || '',
    qualifikation: felder.qualifikation || '',
    notizen: felder.notizen || '',
    dokumente: [],
  });
  speichereState();
  return id;
}

function aktualisiereTrainer(trainerId, felder) {
  const trainer = findeTrainer(trainerId);
  if (!trainer) throw new Error(`Trainer ${trainerId} nicht gefunden`);
  Object.assign(trainer, felder);
  speichereState();
}

function loescheTrainer(trainerId) {
  if (!findeTrainer(trainerId)) throw new Error(`Trainer ${trainerId} nicht gefunden`);
  for (const kurs of window.STATE.kurse) {
    for (const termin of kurs.termine) {
      if (termin.trainerId === trainerId) termin.trainerId = null;
      if (termin.vertretungTrainerId === trainerId) termin.vertretungTrainerId = null;
    }
  }
  window.STATE.trainer = alleTrainer().filter(t => t.id !== trainerId);
  speichereState();
}

function termineFuerTrainer(trainerId) {
  const treffer = [];
  for (const kurs of window.STATE.kurse) {
    for (const termin of kurs.termine) {
      if (termin.trainerId === trainerId) treffer.push({ kurs, termin, rolle: 'trainer' });
      else if (termin.vertretungTrainerId === trainerId) treffer.push({ kurs, termin, rolle: 'vertretung' });
    }
  }
  return treffer.sort((a, b) => a.termin.datum.localeCompare(b.termin.datum));
}

// Nachweise, die abgelaufen sind oder in den naechsten 60 Tagen ablaufen.
function trainerDokumentStatus(trainer) {
  const heute = new Date().toISOString().slice(0, 10);
  const grenze = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  let abgelaufen = 0;
  let laeuftBaldAb = 0;
  for (const dok of trainer.dokumente || []) {
    if (!dok.gueltigBis) continue;
    if (dok.gueltigBis < heute) abgelaufen++;
    else if (dok.gueltigBis <= grenze) laeuftBaldAb++;
  }
  return { abgelaufen, laeuftBaldAb };
}
```

- [ ] **Step 3: `terminAuslastung` auf die Kurs-Kapazität umstellen**

Ersetze die bestehende Funktion `terminAuslastung` vollständig durch:

```javascript
function terminAuslastung(terminId) {
  const gefunden = findeTerminMitKurs(terminId);
  if (!gefunden) throw new Error(`Termin ${terminId} nicht gefunden`);
  const belegt = window.STATE.buchungen.filter(
    b => b.terminId === terminId && b.anmeldestatus !== 'abgesagt'
  ).length;
  const kapazitaet = gefunden.kurs.maxTeilnehmer;
  const minTeilnehmer = gefunden.kurs.minTeilnehmer;
  return {
    belegt,
    kapazitaet,
    minTeilnehmer,
    frei: Math.max(0, kapazitaet - belegt),
    prozent: kapazitaet > 0 ? Math.round((belegt / kapazitaet) * 100) : 0,
    unterbesetzt: belegt < minTeilnehmer,
  };
}
```

- [ ] **Step 4: `erstelleKurs` und `erstelleTermin` an das neue Schema anpassen**

Ersetze `erstelleKurs` vollständig durch:

```javascript
function erstelleKurs(felder) {
  const id = naechsteId('k', window.STATE.kurse);
  window.STATE.kurse.push({
    id,
    titel: felder.titel,
    kategorie: felder.kategorie,
    beschreibung: felder.beschreibung || '',
    lernziele: felder.lernziele || [],
    voraussetzungen: felder.voraussetzungen || 'Keine',
    format: felder.format || 'Vor Ort',
    minTeilnehmer: felder.minTeilnehmer || 5,
    maxTeilnehmer: felder.maxTeilnehmer || 30,
    zertifikat: {
      kuerzel: felder.kuerzel || '',
      umfangUE: felder.umfangUE || 8,
      ueberschrift: felder.ueberschrift || felder.titel,
      bestaetigungstext: felder.bestaetigungstext
        || 'an der Schulung „{kurs}“ im Umfang von {umfang} Unterrichtseinheiten am {datum} in {ort} teilgenommen hat.',
      gueltigkeit: felder.gueltigkeit || 'unbefristet',
    },
    agenda: [],
    materialien: { seminarunterlagen: [], vorlagen: [] },
    termine: [],
  });
  speichereState();
  return id;
}
```

Ersetze in `erstelleTermin` den Objekt-Aufbau (Format und Kapazität entfallen, Trainer wird Referenz):

```javascript
function erstelleTermin(kursId, felder) {
  const kurs = findeKurs(kursId);
  if (!kurs) throw new Error(`Kurs ${kursId} nicht gefunden`);
  const id = naechsteId('tm', alleTermine());
  kurs.termine.push({
    id,
    datum: felder.datum,
    trainerId: felder.trainerId || null,
    vertretungTrainerId: felder.vertretungTrainerId || null,
    ort: felder.ort || '—',
    status: felder.status || 'geplant',
    checkliste: STANDARD_CHECKLISTE.map(label => ({ label, erledigt: false })),
    abschluss: null,
  });
  speichereState();
  return id;
}
```

- [ ] **Step 5: Manuelle Verifikation via Browser-Konsole**

Die Datei wird bereits von `shell-template.html` eingebunden. Nach `python Design/assemble.py` die gebaute `Berichte/index.html` im Claude Browser Pane öffnen, `localStorage.clear()` ausführen, neu laden und in der Konsole prüfen:

```javascript
window.STATE.trainer.length                  // erwartet: 5
kategorienListe()                            // erwartet: ["Arbeitssicherheit","Compliance","Datenschutz"]
einstellungen()                              // erwartet: {zertifikatStartNummer:147, bestaetigungsfristTage:7}
terminAuslastung('s1')                       // erwartet: {belegt:5, kapazitaet:10, minTeilnehmer:5, frei:5, prozent:50, unterbesetzt:false}
terminAuslastung('s1b')                      // erwartet: unterbesetzt:true (0 Buchungen, min 5)
termineFuerTrainer(window.STATE.trainer[0].id).length   // erwartet: >= 1
trainerDokumentStatus(window.STATE.trainer[0])          // erwartet: {abgelaufen:0, laeuftBaldAb:0}
```

Expected: alle Werte wie angegeben, keine Konsolenfehler (`read_console_messages`, `onlyErrors: true`).

**Hinweis:** Die Seiten zeigen an dieser Stelle noch alte Feldnamen an (z. B. „undefined" beim Trainer auf der Schulungen-Seite), weil sie erst in Task 6 angepasst werden. Das ist an dieser Stelle erwartet und kein Fehler.

- [ ] **Step 6: Commit**

```bash
python Design/assemble.py
git add Design/state-engine.js Berichte/index.html
git commit -m "feat: Einstellungen, Kategorienliste, Trainer-CRUD und Kurs-Kapazitaet in State-Engine"
```

---

## Task 3: Status-Automatik, Trainer-Dokumente, Alle Daten leeren

**Files:**
- Modify: `Design/state-engine.js`
- Modify: `Design/file-store.js`

**Interfaces:**
- Consumes: `einstellungen()`, `findeTerminMitKurs()`, `findeTrainer()`, `speichereState()` (Task 2)
- Produces:
  - `statusAutomatikAnwenden()` → `number` (Anzahl geänderter Buchungen); setzt „angemeldet" auf „bestätigt", wenn der Termin ≤ `bestaetigungsfristTage` Tage in der Zukunft liegt, `statusManuell` `false` ist und der Termin nicht abgeschlossen ist. Speichert nur, wenn sich etwas geändert hat.
  - `aktualisiereBuchungStatus(buchungId, neuerStatus)` setzt zusätzlich `statusManuell = true`
  - `alleDatenLeeren()` — leert Kurse, Termine, Buchungen, Teilnehmer und Trainer; Einstellungen bleiben; löscht auch alle Dateien in IndexedDB
  - `trainerDokumentHinzufuegen(trainerId, referenz)` / `trainerDokumentEntfernen(trainerId, dateiId)`
  - `speichereTrainerDokument(datei, trainerId, gueltigBis)` → `Promise<string>` (Datei-`id`)
  - `loescheTrainerDokumentUndDatei(dateiId, trainerId)` → `Promise<void>`
  - `alleDateienLoeschen()` → `Promise<void>` (leert den IndexedDB-Objektspeicher)

- [ ] **Step 1: Status-Automatik in `state-engine.js` anhängen**

```javascript
// -- Status-Automatik --
// Laeuft als eigener Schritt beim Laden und nach dem Anlegen einer Buchung,
// bewusst NICHT waehrend des Renderns (Rendern bleibt seiteneffektfrei).

function statusAutomatikAnwenden() {
  const fristTage = einstellungen().bestaetigungsfristTage;
  const heute = new Date().toISOString().slice(0, 10);
  let geaendert = 0;

  for (const buchung of window.STATE.buchungen) {
    if (buchung.statusManuell) continue;
    if (buchung.anmeldestatus !== 'angemeldet') continue;
    const gefunden = findeTerminMitKurs(buchung.terminId);
    if (!gefunden) continue;
    if (gefunden.termin.abschluss) continue;
    if (gefunden.termin.datum < heute) continue;
    const tageBisTermin = Math.round(
      (new Date(gefunden.termin.datum) - new Date(heute)) / 86400000
    );
    if (tageBisTermin <= fristTage) {
      buchung.anmeldestatus = 'bestätigt';
      geaendert++;
    }
  }

  if (geaendert > 0) speichereState();
  return geaendert;
}
```

- [ ] **Step 2: `aktualisiereBuchungStatus` um die Manuell-Markierung erweitern**

Ersetze die bestehende Funktion vollständig durch:

```javascript
function aktualisiereBuchungStatus(buchungId, neuerStatus) {
  const buchung = window.STATE.buchungen.find(b => b.id === buchungId);
  if (!buchung) throw new Error(`Buchung ${buchungId} nicht gefunden`);
  buchung.anmeldestatus = neuerStatus;
  // Manuell hat immer Vorrang: ab jetzt fasst die Automatik diese Buchung
  // nicht mehr an.
  buchung.statusManuell = true;
  speichereState();
}
```

- [ ] **Step 3: Trainer-Dokument-Referenzen und „Alle Daten leeren" in `state-engine.js` anhängen**

```javascript
// -- Trainer-Dokumente (Dateiinhalt liegt in IndexedDB, siehe file-store.js) --

function trainerDokumentHinzufuegen(trainerId, referenz) {
  const trainer = findeTrainer(trainerId);
  if (!trainer) throw new Error(`Trainer ${trainerId} nicht gefunden`);
  if (!Array.isArray(trainer.dokumente)) trainer.dokumente = [];
  trainer.dokumente.push(referenz);
  speichereState();
}

function trainerDokumentEntfernen(trainerId, dateiId) {
  const trainer = findeTrainer(trainerId);
  if (!trainer) throw new Error(`Trainer ${trainerId} nicht gefunden`);
  trainer.dokumente = (trainer.dokumente || []).filter(d => d.id !== dateiId);
  speichereState();
}

// -- Produktivstart: alles leeren --

function alleDatenLeeren() {
  if (!confirm(
    'Wirklich ALLE Daten unwiderruflich löschen?\n\n'
    + 'Kurse, Termine, Buchungen, Teilnehmer, Trainer und alle hochgeladenen '
    + 'Dateien werden entfernt. Das lässt sich nicht rückgängig machen.\n\n'
    + 'Tipp: Vorher „Exportieren“ anklicken, falls du eine Sicherung möchtest.'
  )) {
    return;
  }
  window.STATE.kurse = [];
  window.STATE.teilnehmer = [];
  window.STATE.buchungen = [];
  window.STATE.trainer = [];
  speichereState();
  if (typeof alleDateienLoeschen === 'function') {
    alleDateienLoeschen().catch(err => console.warn('Dateien konnten nicht geleert werden.', err));
  }
}
```

- [ ] **Step 4: Trainer-Dateiablage in `file-store.js` anhängen**

```javascript
async function speichereTrainerDokument(datei, trainerId, gueltigBis) {
  if (!findeTrainer(trainerId)) throw new Error(`Trainer ${trainerId} nicht gefunden`);
  const db = await oeffneDateiDB();
  const id = neueDateiId();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DATEI_STORE, 'readwrite');
    tx.objectStore(DATEI_STORE).put({ id, blob: datei });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  trainerDokumentHinzufuegen(trainerId, {
    id,
    name: datei.name,
    typ: datei.type || 'application/octet-stream',
    groesse: datei.size,
    gueltigBis: gueltigBis || null,
  });
  return id;
}

async function loescheTrainerDokumentUndDatei(dateiId, trainerId) {
  if (!findeTrainer(trainerId)) throw new Error(`Trainer ${trainerId} nicht gefunden`);
  const db = await oeffneDateiDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DATEI_STORE, 'readwrite');
    tx.objectStore(DATEI_STORE).delete(dateiId);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  trainerDokumentEntfernen(trainerId, dateiId);
}

async function alleDateienLoeschen() {
  const db = await oeffneDateiDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DATEI_STORE, 'readwrite');
    tx.objectStore(DATEI_STORE).clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
```

- [ ] **Step 5: Manuelle Verifikation via Browser-Konsole**

Nach `python Design/assemble.py` die gebaute Datei öffnen, `localStorage.clear()`, neu laden, dann:

```javascript
// Automatik: eine Buchung auf einen Termin in 3 Tagen legen
const inDreiTagen = new Date(Date.now() + 3*86400000).toISOString().slice(0,10);
aktualisiereTermin('s1b', {datum: inDreiTagen});
const bid = erstelleBuchung({teilnehmerId: window.STATE.teilnehmer[0].id, terminId: 's1b', anmeldestatus: 'angemeldet'});
statusAutomatikAnwenden();                                   // erwartet: 1
window.STATE.buchungen.find(b => b.id === bid).anmeldestatus  // erwartet: "bestätigt"

// Manueller Vorrang
aktualisiereBuchungStatus(bid, 'angemeldet');
window.STATE.buchungen.find(b => b.id === bid).statusManuell  // erwartet: true
statusAutomatikAnwenden();                                    // erwartet: 0 (wird nicht mehr angefasst)

// Trainer-Dokument
const tid = window.STATE.trainer[0].id;
const testDatei = new File(['Zeugnis'], 'nachweis.txt', {type: 'text/plain'});
await speichereTrainerDokument(testDatei, tid, '2020-01-01');
trainerDokumentStatus(findeTrainer(tid))                      // erwartet: {abgelaufen:1, laeuftBaldAb:0}
```

Danach `localStorage.clear()` und neu laden, um den Teststand zu entfernen.

Expected: alle Werte wie angegeben, keine Konsolenfehler.

- [ ] **Step 6: Commit**

```bash
python Design/assemble.py
git add Design/state-engine.js Design/file-store.js Berichte/index.html
git commit -m "feat: Status-Automatik, Trainer-Dokumente und Alle-Daten-leeren"
```

---

## Task 4: Design-System um v3-Klassen erweitern

**Files:**
- Modify: `Design/styles.css` (Ergänzung am Dateiende, bestehende Regeln unverändert)

**Interfaces:**
- Produces: verbindliche Klassen für Task 6–9 — `.badge-unterbesetzt`, `.auto-marker`, `.trainer-grid`, `.trainer-card`, `.trainer-avatar`, `.trainer-card-body`, `.trainer-warn`, `.dok-row`, `.dok-frist`, `.dok-frist.abgelaufen`, `.dok-frist.bald`, `.hilfe-block`, `.hilfe-block h3`, `.field-hint`, `.leer-hinweis`

- [ ] **Step 1: CSS-Ergänzungen anhängen**

```css

/* ========================================================================
   v3-Ergaenzungen: Stammdaten (Trainer), Unterbesetzung, Status-Automatik,
   Hilfeseite. Verbindliche Klassen fuer die Seiten-Fragmente.
   ======================================================================== */

/* Unterbesetzter Termin (unter kurs.minTeilnehmer) */
.badge-unterbesetzt { background: var(--status-amber-bg); color: var(--status-amber-fg); }

/* Kennzeichen fuer automatisch gesetzten Anmeldestatus */
.auto-marker { color: var(--muted2); font-size: 11px; margin-left: 5px; cursor: help; }

/* Trainer-Liste als Kartenraster */
.trainer-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.trainer-card {
  background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card); padding: 16px 18px; cursor: pointer;
  display: flex; flex-direction: column; gap: 10px;
}
.trainer-card:hover { border-color: var(--line-strong); }
.trainer-card-head { display: flex; align-items: center; gap: 11px; }
.trainer-avatar {
  width: 38px; height: 38px; border-radius: 50%; flex: none;
  background: var(--card-2); color: var(--teal-deep);
  font-family: var(--font-display); font-weight: 700; font-size: 13px;
  display: flex; align-items: center; justify-content: center;
}
.trainer-card-name { font-family: var(--font-display); font-weight: 600; font-size: 14px; color: var(--ink); }
.trainer-card-sub { font-size: 12px; color: var(--muted); }
.trainer-card-body { font-size: 12.5px; color: var(--text); display: flex; flex-direction: column; gap: 4px; }
.trainer-warn { font-size: 12px; font-weight: 600; color: var(--status-red-fg); }

/* Trainer-Dokumente mit Gueltigkeitsfrist */
.dok-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); }
.dok-row:last-child { border-bottom: none; }
.dok-frist { font-size: 11.5px; font-weight: 600; font-family: var(--font-display); }
.dok-frist.abgelaufen { color: var(--status-red-fg); }
.dok-frist.bald { color: var(--status-amber-fg); }
.dok-frist.ok { color: var(--muted2); font-weight: 400; }

/* Hilfeseite */
.hilfe-block { margin-bottom: 22px; }
.hilfe-block h3 {
  font-family: var(--font-display); font-size: 14px; font-weight: 600;
  color: var(--ink); margin: 0 0 8px 0;
}
.hilfe-block p, .hilfe-block li { font-size: 13px; line-height: 1.6; color: var(--text); margin: 0 0 8px 0; }
.hilfe-block ul { margin: 0 0 8px 0; padding-left: 20px; }

/* Kleiner Erklaertext unter einem Formularfeld */
.field-hint { font-size: 11px; color: var(--muted2); margin-top: -2px; }

/* Hinweis auf leeren Bestand (nach "Alle Daten leeren") */
.leer-hinweis {
  background: var(--card-2); border: 1px dashed var(--line-strong);
  border-radius: var(--radius-lg); padding: 28px; text-align: center;
  color: var(--muted); font-size: 13px;
}
```

- [ ] **Step 2: Build und Sichtprüfung**

Run: `python Design/assemble.py`

Im Claude Browser Pane `Berichte/index.html` öffnen und in der Konsole prüfen, dass das Stylesheet insgesamt intakt geblieben ist (ein Tippfehler in der Ergänzung würde nachfolgende Regeln unbrauchbar machen):

Run (Browser-Konsole): `getComputedStyle(document.querySelector('.sidebar')).width`
Expected: `"232px"`

- [ ] **Step 3: Commit**

```bash
git add Design/styles.css Berichte/index.html
git commit -m "feat: Design-System um Trainer-, Hilfe- und Unterbesetzt-Klassen erweitern"
```

---

## Task 5: Shell-Template und assemble.py um Trainer- und Hilfe-Seite erweitern

**Files:**
- Modify: `Design/shell-template.html`
- Modify: `Design/assemble.py`
- Create: `Design/fragments/page-trainer.html` (Platzhalter, echter Inhalt in Task 7)
- Create: `Design/fragments/page-hilfe.html` (Platzhalter, echter Inhalt in Task 9)

**Interfaces:**
- Consumes: `statusAutomatikAnwenden()`, `alleDatenLeeren()` (Task 3)
- Produces:
  - Seitenleiste mit fünf Punkten: Übersicht, Schulungen, Buchungen, **Trainer**, **Hilfe** (Hilfe optisch abgesetzt am Ende)
  - Zusätzlicher Sidebar-Knopf „Alle Daten leeren"
  - Seiten-Container `page-trainer` und `page-hilfe`
  - `showTrainerDetail(trainerId)` — wechselt auf die Trainer-Seite und rendert die Detailansicht (die Funktion `renderTrainer(trainerId)` liefert Task 7)
  - `renderAll()` ruft zusätzlich `renderTrainer(window.AKTUELLER_TRAINER_ID)` auf
  - `statusAutomatikAnwenden()` wird **einmal beim Laden vor dem ersten `renderAll()`** aufgerufen
  - `{{PAGE_TRAINER}}` und `{{PAGE_HILFE}}` als neue Platzhalter; `assemble.py` kennt `page-trainer` und `page-hilfe` in allen drei Listen (CSS, JS, HTML)

- [ ] **Step 1: Platzhalter-Fragmente anlegen**

Run:
```bash
printf '<div class="page-header"><div class="page-header-text"><h1>Trainer</h1><p class="subtitle">Wird in Task 7 gebaut.</p></div></div>' > "Design/fragments/page-trainer.html"
printf '<div class="page-header"><div class="page-header-text"><h1>Hilfe</h1><p class="subtitle">Wird in Task 9 gebaut.</p></div></div>' > "Design/fragments/page-hilfe.html"
```

- [ ] **Step 2: Navigationspunkte in `shell-template.html` ergänzen**

Füge in `Design/shell-template.html` direkt **nach** dem `<button>`-Block mit `data-nav="buchungen"` ein:

```html
        <button class="sidebar-nav-item" data-nav="trainer" onclick="showPage('trainer')">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c0-4 3.4-6.6 7.5-6.6s7.5 2.6 7.5 6.6"/></svg>
          Trainer
        </button>
        <button class="sidebar-nav-item" data-nav="hilfe" onclick="showPage('hilfe')" style="margin-top:10px;">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.9"/><path d="M12 17.4h.01"/></svg>
          Hilfe
        </button>
```

- [ ] **Step 3: „Alle Daten leeren" in die Sidebar-Werkzeuge aufnehmen**

Ersetze in `Design/shell-template.html` den `<div class="sidebar-tools">`-Block vollständig durch:

```html
        <div class="sidebar-tools">
          <button class="sidebar-tool-btn" onclick="exportiereJSON()">Exportieren</button>
          <button class="sidebar-tool-btn" onclick="document.getElementById('import-input').click()">Importieren</button>
          <button class="sidebar-tool-btn" onclick="zuruecksetzenAufBeispieldaten()">Zurücksetzen</button>
          <button class="sidebar-tool-btn" onclick="alleDatenLeeren()">Alle Daten leeren</button>
          <input type="file" id="import-input" accept="application/json" style="display:none" />
        </div>
```

- [ ] **Step 4: Seiten-Container ergänzen**

Füge in `Design/shell-template.html` direkt **nach** der `<section id="page-buchungen" class="page">…</section>` ein:

```html
      <section id="page-trainer" class="page">
{{PAGE_TRAINER}}
      </section>

      <section id="page-hilfe" class="page">
{{PAGE_HILFE}}
      </section>
```

- [ ] **Step 5: Navigations- und Render-Logik im Shell-Skript ergänzen**

Füge in `Design/shell-template.html` im letzten `<script>`-Block direkt nach der Funktion `showSchulungDetail` ein:

```javascript
// Von der Trainer-Liste aufgerufen: wechselt auf die Trainer-Seite und
// zeigt die Detailansicht dieser Person.
function showTrainerDetail(trainerId) {
  window.AKTUELLER_TRAINER_ID = trainerId;
  showPage('trainer');
  if (typeof renderTrainer === 'function') {
    renderTrainer(trainerId);
  }
}
```

Ersetze im selben Block die Funktion `renderAll` vollständig durch:

```javascript
function renderAll() {
  if (typeof renderUebersicht === 'function') renderUebersicht();
  if (typeof renderSchulungen === 'function') renderSchulungen();
  if (typeof renderSchulungdetail === 'function') renderSchulungdetail(window.AKTUELLER_TERMIN_ID);
  if (typeof renderBuchungen === 'function') renderBuchungen();
  if (typeof renderTrainer === 'function') renderTrainer(window.AKTUELLER_TRAINER_ID);
}
window.renderAll = renderAll;

// Status-Automatik laeuft genau einmal beim Laden - bewusst vor dem ersten
// Rendern und ausserhalb davon, damit das Rendern seiteneffektfrei bleibt.
if (typeof statusAutomatikAnwenden === 'function') {
  statusAutomatikAnwenden();
}

renderAll();
```

(Die bisherige separate Zeile `renderAll();` unterhalb des Blocks entfällt dadurch — sie darf nicht doppelt stehen bleiben.)

- [ ] **Step 6: `assemble.py` um die neuen Seiten erweitern**

Ersetze in `Design/assemble.py` beide Vorkommen der Seitenliste (CSS-Schleife und JS-Schleife) durch:

```python
for name in ["page-uebersicht", "page-schulungen", "page-schulungdetail", "page-buchungen", "page-trainer", "page-hilfe"]:
```

Und ergänze die HTML-Zuordnung um die beiden neuen Einträge:

```python
pages = {}
for key, fname in [
    ("PAGE_UEBERSICHT", "page-uebersicht.html"),
    ("PAGE_SCHULUNGEN", "page-schulungen.html"),
    ("PAGE_SCHULUNGDETAIL", "page-schulungdetail.html"),
    ("PAGE_BUCHUNGEN", "page-buchungen.html"),
    ("PAGE_TRAINER", "page-trainer.html"),
    ("PAGE_HILFE", "page-hilfe.html"),
]:
    pages[key] = read(FRAGMENTS / fname, f"<p>FEHLT: {fname}</p>")
```

- [ ] **Step 7: Build und Browser-Verifikation**

Run: `python Design/assemble.py`
Expected: `Geschrieben: …Berichte\index.html … Zeichen`, keine Fehler.

Im Claude Browser Pane, nach `localStorage.clear()` und Neuladen:
- Die Seitenleiste zeigt fünf Punkte: Übersicht, Schulungen, Buchungen, Trainer, Hilfe — jeder Klick wechselt sichtbar die Seite
- „Trainer" und „Hilfe" zeigen ihre Platzhaltertexte (erwartet, echter Inhalt folgt in Task 7 bzw. 9)
- Die Sidebar-Werkzeuge zeigen vier Knöpfe inkl. „Alle Daten leeren"
- Konsole ohne Fehler (`read_console_messages`, `onlyErrors: true`)
- In der Konsole: `document.querySelectorAll('.sidebar-nav-item').length` → erwartet `5`
- In der Konsole prüfen, dass keine unersetzten Platzhalter übrig sind: `document.documentElement.innerHTML.includes('{{')` → erwartet `false`

- [ ] **Step 8: Commit**

```bash
git add Design/shell-template.html Design/assemble.py Design/fragments/page-trainer.html Design/fragments/page-hilfe.html Berichte/index.html
git commit -m "feat: Trainer- und Hilfe-Seite in Shell und Build aufnehmen"
```

---

## Task 6: Schulungen-Seite auf das v3-Schema umstellen

**Files:**
- Modify: `Design/fragments/page-schulungen.html`
- Modify: `Design/fragments/page-schulungen.js`
- Modify: `Design/fragments/page-schulungdetail.js` (Kopfbereich: Trainer/Vertretung/Format aus dem neuen Schema)

**Interfaces:**
- Consumes: `kategorienListe()`, `alleTrainer()`, `trainerName()`, `terminAuslastung()` (jetzt mit `unterbesetzt`), `erstelleKurs()`, `aktualisiereKurs()`, `erstelleTermin()`, `aktualisiereTermin()`, `escAttr()`, `formatiereDatum()`, `statusBadgeHtml()`, `oeffneDialog()`, `schliesseDialog()`, `formularWerte()`
- Produces: `schulungenKategorieDatalist()` → HTML-String eines `<datalist id="kategorien-liste">`; `schulungenTrainerOptionen(ausgewaehlt, mitLeer)` → HTML-String von `<option>`-Elementen

- [ ] **Step 1: Kategorie-Filter der Seite aus dem Bestand ableiten**

Ersetze in `Design/fragments/page-schulungen.html` den Block des Kategorie-Filters (`<select id="schulungen-kategorie-filter" …>` mit seinen fest verdrahteten `<option>`-Elementen) durch:

```html
  <select id="schulungen-kategorie-filter" class="filter-select" onchange="renderSchulungen()">
    <option value="">Kategorie: Alle</option>
  </select>
```

- [ ] **Step 2: Hilfsfunktionen und Terminzeile in `page-schulungen.js` anpassen**

Ersetze die Funktionen `schulungenTerminZeile` und `renderSchulungen` vollständig und ergänze die beiden neuen Helfer:

```javascript
// Vorschlagsliste fuer das Kategorie-Freitextfeld, gespeist aus dem Bestand.
function schulungenKategorieDatalist() {
  const optionen = kategorienListe()
    .map(k => `<option value="${escAttr(k)}"></option>`).join('');
  return `<datalist id="kategorien-liste">${optionen}</datalist>`;
}

// Optionen fuer eine Trainer-Auswahl. mitLeer=true ergaenzt einen leeren
// Eintrag (fuer das optionale Vertretungsfeld).
function schulungenTrainerOptionen(ausgewaehlt, mitLeer) {
  const leer = mitLeer
    ? `<option value="" ${!ausgewaehlt ? 'selected' : ''}>— keine —</option>`
    : '';
  const rest = alleTrainer().map(t =>
    `<option value="${escAttr(t.id)}" ${t.id === ausgewaehlt ? 'selected' : ''}>${escAttr(t.name)}</option>`
  ).join('');
  return leer + rest;
}

function schulungenTerminZeile(kurs, termin) {
  const a = terminAuslastung(termin.id);
  let auslastungText;
  if (a.belegt >= a.kapazitaet) {
    auslastungText = '<span class="badge badge-indigo">Ausgebucht</span>';
  } else if (a.unterbesetzt) {
    auslastungText = `<span class="badge badge-unterbesetzt">${a.belegt} von mind. ${a.minTeilnehmer}</span>`;
  } else {
    auslastungText = `${a.belegt} / ${a.kapazitaet}`;
  }

  const trainer = termin.trainerId
    ? escAttr(trainerName(termin.trainerId))
    : '<span style="color:var(--status-red-fg);">Kein Trainer zugeordnet</span>';
  const vertretung = termin.vertretungTrainerId
    ? `<div style="font-size:11.5px; color:var(--muted);">Vertretung: ${escAttr(trainerName(termin.vertretungTrainerId))}</div>`
    : '';

  return `
    <tr>
      <td class="cell-strong" style="cursor:pointer;" onclick="showSchulungDetail('${termin.id}')">${formatiereDatum(termin.datum)}</td>
      <td>${trainer}${vertretung}</td>
      <td>${escAttr(kurs.format)} · ${escAttr(termin.ort)}</td>
      <td>${statusBadgeHtml(termin.status)}</td>
      <td>${auslastungText}</td>
      <td style="text-align:right; white-space:nowrap;">
        <button class="btn" onclick="showSchulungDetail('${termin.id}')">Öffnen</button>
        <button class="btn" onclick="oeffneTerminBearbeitenDialog('${termin.id}')">Bearbeiten</button>
        <button class="btn btn-ghost-red" onclick="terminLoeschenBestaetigen('${termin.id}')">Löschen</button>
      </td>
    </tr>`;
}

function schulungenAktualisiereKategorieFilter() {
  const select = document.getElementById('schulungen-kategorie-filter');
  if (!select) return;
  const aktuell = select.value;
  select.innerHTML = '<option value="">Kategorie: Alle</option>'
    + kategorienListe().map(k => `<option value="${escAttr(k)}">${escAttr(k)}</option>`).join('');
  if ([...select.options].some(o => o.value === aktuell)) select.value = aktuell;
}

function renderSchulungen() {
  const container = document.getElementById('schulungen-kursliste');
  if (!container) return;
  schulungenAktualisiereKategorieFilter();
  const kurse = schulungenGefilterteKurse();

  if (kurse.length === 0) {
    container.innerHTML = window.STATE.kurse.length === 0
      ? '<div class="leer-hinweis">Noch keine Kurse angelegt. Über „+ Neuer Kurs“ startest du.</div>'
      : '<p class="empty-hint">Keine Kurse gefunden.</p>';
    return;
  }

  container.innerHTML = kurse.map(kurs => `
    <div style="border-bottom:1px solid var(--line); padding:14px 0;">
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <div class="expand-row" style="flex:1;" onclick="schulungenToggle('${kurs.id}')">
          <span class="expand-toggle" id="s-toggle-${kurs.id}">▸</span>
          <strong style="font-family:var(--font-display); font-size:14px; color:var(--ink);">${escAttr(kurs.titel)}</strong>
          <span style="color:var(--muted); font-size:12px; margin-left:8px;">${escAttr(kurs.kategorie)} · ${escAttr(kurs.format)} · ${kurs.minTeilnehmer}–${kurs.maxTeilnehmer} Teilnehmer · ${kurs.termine.length} Termin(e)</span>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn" onclick="oeffneNeuerTerminDialog('${kurs.id}')">+ Termin</button>
          <button class="btn" onclick="oeffneKursBearbeitenDialog('${kurs.id}')">Bearbeiten</button>
          <button class="btn btn-ghost-red" onclick="kursLoeschenBestaetigen('${kurs.id}')">Löschen</button>
        </div>
      </div>
      <div class="expand-content" id="s-expand-${kurs.id}">
        ${kurs.termine.length === 0
          ? '<p class="empty-hint">Noch keine Termine. Über „+ Termin“ anlegen.</p>'
          : `<table class="data-table fixed-rows">
          <thead><tr><th>Datum</th><th>Trainer</th><th>Format / Ort</th><th>Status</th><th>Teilnehmer</th><th></th></tr></thead>
          <tbody>${kurs.termine.map(t => schulungenTerminZeile(kurs, t)).join('')}</tbody>
        </table>`}
      </div>
    </div>`).join('');
}
```

- [ ] **Step 3: Kurs-Dialoge auf die neuen Felder umstellen**

Ersetze `oeffneNeuerKursDialog`, `speichereNeuerKurs`, `oeffneKursBearbeitenDialog` und `speichereKursBearbeiten` vollständig durch:

```javascript
// Gemeinsamer Formularrumpf fuer "Neuer Kurs" und "Kurs bearbeiten" - beide
// Dialoge zeigen exakt dieselben Felder, daher eine Quelle.
function schulungenKursFormularFelder(kurs) {
  const k = kurs || {
    titel: '', kategorie: '', beschreibung: '', voraussetzungen: 'Keine',
    format: 'Vor Ort', minTeilnehmer: 5, maxTeilnehmer: 30,
    zertifikat: { kuerzel: '', umfangUE: 8, ueberschrift: '', bestaetigungstext: '', gueltigkeit: 'unbefristet' },
  };
  const z = k.zertifikat || {};
  return `
    ${schulungenKategorieDatalist()}
    <div class="field"><label>Titel</label><input name="titel" value="${escAttr(k.titel)}" required /></div>
    <div class="field">
      <label>Kategorie</label>
      <input name="kategorie" list="kategorien-liste" value="${escAttr(k.kategorie)}" required />
      <div class="field-hint">Vorhandene auswählen oder neue eintippen</div>
    </div>
    <div class="field-row2">
      <div class="field">
        <label>Format</label>
        <select name="format">
          <option ${k.format === 'Vor Ort' ? 'selected' : ''}>Vor Ort</option>
          <option ${k.format === 'Online' ? 'selected' : ''}>Online</option>
          <option ${k.format === 'Hybrid' ? 'selected' : ''}>Hybrid</option>
        </select>
      </div>
      <div class="field"><label>Umfang (UE)</label><input type="number" name="umfangUE" min="1" value="${z.umfangUE || 8}" required /></div>
    </div>
    <div class="field-row2">
      <div class="field"><label>Mindestteilnehmer</label><input type="number" name="minTeilnehmer" min="1" value="${k.minTeilnehmer}" required /></div>
      <div class="field"><label>Maximalteilnehmer</label><input type="number" name="maxTeilnehmer" min="1" value="${k.maxTeilnehmer}" required /></div>
    </div>
    <div class="field"><label>Beschreibung</label><textarea name="beschreibung" rows="3">${escAttr(k.beschreibung)}</textarea></div>
    <div class="field"><label>Voraussetzungen</label><input name="voraussetzungen" value="${escAttr(k.voraussetzungen)}" /></div>
    <div class="field"><label>Kürzel für Zertifikatsnummer</label><input name="kuerzel" value="${escAttr(z.kuerzel || '')}" placeholder="z. B. DSB" /></div>
    <div class="field"><label>Gültigkeit der Bescheinigung</label><input name="gueltigkeit" value="${escAttr(z.gueltigkeit || 'unbefristet')}" /></div>`;
}

// Liest die Zahlenfelder als Zahlen und prueft min <= max.
function schulungenKursFelderLesen(form) {
  const felder = formularWerte(form);
  felder.minTeilnehmer = parseInt(felder.minTeilnehmer, 10);
  felder.maxTeilnehmer = parseInt(felder.maxTeilnehmer, 10);
  felder.umfangUE = parseInt(felder.umfangUE, 10);
  if (felder.minTeilnehmer > felder.maxTeilnehmer) {
    alert('Die Mindestteilnehmerzahl darf nicht größer als die Maximalteilnehmerzahl sein.');
    return null;
  }
  return felder;
}

function oeffneNeuerKursDialog() {
  oeffneDialog(`
    <div class="dialog-head"><h3>Neuen Kurs anlegen</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form onsubmit="return speichereNeuerKurs(event)">
      <div class="dialog-body">${schulungenKursFormularFelder(null)}</div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Kurs anlegen</button>
      </div>
    </form>`);
}

function speichereNeuerKurs(ev) {
  ev.preventDefault();
  const felder = schulungenKursFelderLesen(ev.target);
  if (!felder) return false;
  felder.lernziele = [];
  erstelleKurs(felder);
  schliesseDialog();
  return false;
}

function oeffneKursBearbeitenDialog(kursId) {
  const kurs = findeKurs(kursId);
  oeffneDialog(`
    <div class="dialog-head"><h3>Kurs bearbeiten</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form onsubmit="return speichereKursBearbeiten(event, '${kursId}')">
      <div class="dialog-body">${schulungenKursFormularFelder(kurs)}</div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Speichern</button>
      </div>
    </form>`);
}

function speichereKursBearbeiten(ev, kursId) {
  ev.preventDefault();
  const felder = schulungenKursFelderLesen(ev.target);
  if (!felder) return false;
  const kurs = findeKurs(kursId);
  // Zertifikatsfelder liegen verschachtelt, daher getrennt zusammensetzen.
  aktualisiereKurs(kursId, {
    titel: felder.titel,
    kategorie: felder.kategorie,
    beschreibung: felder.beschreibung,
    voraussetzungen: felder.voraussetzungen,
    format: felder.format,
    minTeilnehmer: felder.minTeilnehmer,
    maxTeilnehmer: felder.maxTeilnehmer,
    zertifikat: {
      ...kurs.zertifikat,
      kuerzel: felder.kuerzel,
      umfangUE: felder.umfangUE,
      gueltigkeit: felder.gueltigkeit,
    },
  });
  schliesseDialog();
  return false;
}
```

- [ ] **Step 4: Termin-Dialoge auf Trainer-Auswahl umstellen**

Ersetze `oeffneNeuerTerminDialog`, `speichereNeuerTermin`, `oeffneTerminBearbeitenDialog` und `speichereTerminBearbeiten` vollständig durch:

```javascript
// Gemeinsamer Formularrumpf fuer beide Termin-Dialoge.
function schulungenTerminFormularFelder(termin) {
  const t = termin || { datum: '', trainerId: '', vertretungTrainerId: '', ort: '', status: 'geplant' };
  return `
    <div class="field"><label>Datum</label><input type="date" name="datum" value="${escAttr(t.datum)}" required /></div>
    <div class="field">
      <label>Trainer</label>
      <select name="trainerId" required>${schulungenTrainerOptionen(t.trainerId, true)}</select>
      <div class="field-hint">Trainer werden im Bereich „Trainer“ gepflegt</div>
    </div>
    <div class="field">
      <label>Vertretung (optional)</label>
      <select name="vertretungTrainerId">${schulungenTrainerOptionen(t.vertretungTrainerId, true)}</select>
    </div>
    <div class="field"><label>Ort</label><input name="ort" value="${escAttr(t.ort)}" placeholder="z. B. Hamburg oder — bei Online" /></div>
    <div class="field">
      <label>Status</label>
      <select name="status">
        <option value="geplant" ${t.status === 'geplant' ? 'selected' : ''}>geplant</option>
        <option value="laufend" ${t.status === 'laufend' ? 'selected' : ''}>laufend</option>
        <option value="abgeschlossen" ${t.status === 'abgeschlossen' ? 'selected' : ''}>abgeschlossen</option>
      </select>
    </div>`;
}

function schulungenTerminFelderLesen(form) {
  const felder = formularWerte(form);
  // Leere Auswahl bedeutet "nicht zugeordnet", nicht der leere String.
  felder.trainerId = felder.trainerId || null;
  felder.vertretungTrainerId = felder.vertretungTrainerId || null;
  if (felder.trainerId && felder.trainerId === felder.vertretungTrainerId) {
    alert('Trainer und Vertretung dürfen nicht dieselbe Person sein.');
    return null;
  }
  return felder;
}

function oeffneNeuerTerminDialog(kursId) {
  if (alleTrainer().length === 0) {
    alert('Bitte zuerst im Bereich „Trainer“ mindestens eine Person anlegen.');
    return;
  }
  oeffneDialog(`
    <div class="dialog-head"><h3>Neuen Termin anlegen</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form onsubmit="return speichereNeuerTermin(event, '${kursId}')">
      <div class="dialog-body">${schulungenTerminFormularFelder(null)}</div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Termin anlegen</button>
      </div>
    </form>`);
}

function speichereNeuerTermin(ev, kursId) {
  ev.preventDefault();
  const felder = schulungenTerminFelderLesen(ev.target);
  if (!felder) return false;
  erstelleTermin(kursId, felder);
  schliesseDialog();
  return false;
}

function oeffneTerminBearbeitenDialog(terminId) {
  const { termin } = findeTerminMitKurs(terminId);
  oeffneDialog(`
    <div class="dialog-head"><h3>Termin bearbeiten</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form onsubmit="return speichereTerminBearbeiten(event, '${terminId}')">
      <div class="dialog-body">${schulungenTerminFormularFelder(termin)}</div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Speichern</button>
      </div>
    </form>`);
}

function speichereTerminBearbeiten(ev, terminId) {
  ev.preventDefault();
  const felder = schulungenTerminFelderLesen(ev.target);
  if (!felder) return false;
  aktualisiereTermin(terminId, felder);
  schliesseDialog();
  return false;
}
```

- [ ] **Step 5: Kopfbereich der Schulungsdetail-Seite anpassen**

In `Design/fragments/page-schulungdetail.js` liest der Kopfbereich noch `termin.format` und `termin.trainer`. Ersetze in der Funktion `renderSchulungdetail` die beiden Meta-Blöcke für Trainer und Format durch:

```javascript
        <div><div class="mat-group-label" style="margin:0 0 3px 0;">Trainer</div><div style="color:var(--ink); font-weight:600;">${
          termin.trainerId
            ? escAttr(trainerName(termin.trainerId))
            : '<span style="color:var(--status-red-fg);">Kein Trainer zugeordnet</span>'
        }${
          termin.vertretungTrainerId
            ? `<div style="font-size:11.5px; font-weight:400; color:var(--muted);">Vertretung: ${escAttr(trainerName(termin.vertretungTrainerId))}</div>`
            : ''
        }</div></div>
        <div><div class="mat-group-label" style="margin:0 0 3px 0;">Format</div><div style="color:var(--ink); font-weight:600;">${escAttr(kurs.format)} · ${escAttr(termin.ort)}</div></div>
```

- [ ] **Step 6: Das entfallene Feld `zielgruppe` aus der Detailseite entfernen**

`zielgruppe` existiert im v3-Schema nicht mehr (durch Min-/Maxteilnehmerzahl abgelöst). In `Design/fragments/page-schulungdetail.js` gibt es dazu noch drei Stellen, die sonst „undefined" anzeigen bzw. ein totes Feld zurückschreiben würden.

**(a)** In `detailAbschnittBeschreibung` — ersetze den `pill-row`-Block durch eine Zeile, die stattdessen die für die Planung relevanten Kurs-Eckdaten zeigt:

```javascript
      <div class="pill-row">
        <span class="pill">Format: ${escAttr(kurs.format)}</span>
        <span class="pill">${kurs.minTeilnehmer}–${kurs.maxTeilnehmer} Teilnehmer</span>
        <span class="pill">Umfang: ${kurs.zertifikat && kurs.zertifikat.umfangUE ? kurs.zertifikat.umfangUE : '—'} UE</span>
        <span class="pill">Voraussetzung: ${escAttr(kurs.voraussetzungen || '—')}</span>
      </div>
```

**(b)** In `detailOeffneBeschreibungBearbeitenDialog` — entferne die Zeile mit dem `zielgruppe`-Eingabefeld ersatzlos und ersetze die umgebende `field-row2` durch ein einzelnes Feld, da nur noch die Voraussetzungen darin stehen:

```javascript
        <div class="field"><label>Voraussetzungen</label><input name="voraussetzungen" value="${escAttr(kurs.voraussetzungen)}" /></div>
```

**(c)** In `detailSpeichereBeschreibung` — entferne `zielgruppe` aus dem Objekt, das an `aktualisiereKurs` übergeben wird:

```javascript
  aktualisiereKurs(kursId, {
    beschreibung: felder.beschreibung,
    voraussetzungen: felder.voraussetzungen,
    lernziele,
  });
```

Prüfe nach der Änderung mit `grep -rn "zielgruppe" Design/fragments/`, dass keine Treffer mehr übrig sind.

- [ ] **Step 7: Build und Browser-Verifikation**

Run: `python Design/assemble.py`

Im Claude Browser Pane, nach `localStorage.clear()` und Neuladen, auf der Seite „Schulungen":
- Der Kategorie-Filter zeigt genau die drei vorhandenen Kategorien (Arbeitssicherheit, Compliance, Datenschutz)
- Die Kurszeile zeigt Kategorie, Format und den Teilnehmerbereich (z. B. „Datenschutz · Vor Ort · 5–10 Teilnehmer · 2 Termin(e)")
- Beim Aufklappen zeigt die Terminzeile den Trainernamen (nicht „undefined"), Format vom Kurs und Ort vom Termin
- Termin `s1b` (0 Buchungen, min 5) zeigt in der Teilnehmerspalte den Amber-Hinweis „0 von mind. 5"
- „+ Neuer Kurs": Kategoriefeld ist ein Textfeld mit Vorschlagsliste — vorhandene Kategorie auswählbar, neue („Testkategorie") eintippbar; Format/Min/Max/Umfang/Kürzel/Gültigkeit vorhanden. Speichern legt den Kurs an, die neue Kategorie taucht danach im Filter auf
- Min größer als Max eingeben → Hinweis erscheint, Kurs wird nicht angelegt
- „Kurs bearbeiten" zeigt alle Werte korrekt vorbelegt
- „+ Termin": Trainer ist eine Auswahlliste mit den 5 Trainern, Vertretung ebenfalls (mit „— keine —"), kein Kapazitäts- und kein Formatfeld mehr. Dieselbe Person für Trainer und Vertretung → Hinweis, kein Speichern
- Angelegter Termin erscheint mit korrektem Trainer, Vertretung wird als zweite Zeile angezeigt
- Detailseite eines Termins zeigt Trainer und ggf. Vertretung sowie das Format des Kurses
- Im Abschnitt „Beschreibung & Lernziele" der Detailseite steht keine „Zielgruppe" mehr, sondern Format, Teilnehmerbereich, Umfang und Voraussetzung — alle mit echten Werten, kein „undefined"
- „Bearbeiten" in diesem Abschnitt zeigt kein Zielgruppe-Feld mehr; Speichern lässt die übrigen Werte unverändert
- Testkurs anschließend wieder löschen
- Konsole ohne Fehler

- [ ] **Step 8: Commit**

```bash
git add Design/fragments/page-schulungen.html Design/fragments/page-schulungen.js Design/fragments/page-schulungdetail.js Berichte/index.html
git commit -m "feat: Schulungen-Seite auf Kategorie-Freitext, Kurs-Format/Kapazitaet und Trainer-Auswahl umstellen"
```

---

## Task 7: Trainer-Seite (Liste und Detail mit Nachweisdokumenten)

**Files:**
- Modify: `Design/fragments/page-trainer.html` (ersetzt den Platzhalter aus Task 5)
- Create: `Design/fragments/page-trainer.js`

**Interfaces:**
- Consumes: `alleTrainer()`, `findeTrainer()`, `erstelleTrainer()`, `aktualisiereTrainer()`, `loescheTrainer()`, `termineFuerTrainer()`, `trainerDokumentStatus()`, `speichereTrainerDokument()`, `loescheTrainerDokumentUndDatei()`, `herunterladeDatei()`, `formatiereDatum()`, `escAttr()`, `escJsArg()`, `oeffneDialog()`, `schliesseDialog()`, `formularWerte()`, `showSchulungDetail()`, `window.AKTUELLER_TRAINER_ID`
- Produces: `renderTrainer(trainerId)` — zeigt die Detailansicht, wenn `trainerId` gesetzt ist, sonst die Liste; wird von `renderAll()` und `showTrainerDetail()` aufgerufen und toleriert `undefined`

- [ ] **Step 1: `page-trainer.html` schreiben**

```html
<div id="trainer-inhalt"></div>
```

- [ ] **Step 2: `page-trainer.js` — Liste schreiben**

```javascript
// Design/fragments/page-trainer.js

function trainerInitialen(name) {
  return (name || '?')
    .split(/\s+/)
    .filter(teil => /[A-Za-zÄÖÜäöüß]/.test(teil))
    .slice(-2)
    .map(teil => teil[0].toUpperCase())
    .join('') || '?';
}

function trainerListeHtml() {
  const trainer = alleTrainer();
  if (trainer.length === 0) {
    return '<div class="leer-hinweis">Noch keine Trainer angelegt. Über „+ Neuer Trainer“ startest du.</div>';
  }
  const karten = trainer.map(t => {
    const termine = termineFuerTrainer(t.id);
    const status = trainerDokumentStatus(t);
    let warnung = '';
    if (status.abgelaufen > 0) {
      warnung = `<div class="trainer-warn">${status.abgelaufen} Nachweis(e) abgelaufen</div>`;
    } else if (status.laeuftBaldAb > 0) {
      warnung = `<div class="trainer-warn" style="color:var(--status-amber-fg);">${status.laeuftBaldAb} Nachweis(e) laufen bald ab</div>`;
    }
    return `
      <div class="trainer-card" onclick="showTrainerDetail('${escJsArg(t.id)}')">
        <div class="trainer-card-head">
          <div class="trainer-avatar">${escAttr(trainerInitialen(t.name))}</div>
          <div>
            <div class="trainer-card-name">${escAttr(t.name)}</div>
            <div class="trainer-card-sub">${escAttr(t.qualifikation || 'Keine Qualifikation hinterlegt')}</div>
          </div>
        </div>
        <div class="trainer-card-body">
          <div>${termine.length} Termin(e) zugeordnet</div>
          <div>${(t.dokumente || []).length} Nachweis(e) hinterlegt</div>
          ${warnung}
        </div>
      </div>`;
  }).join('');

  return `<div class="trainer-grid">${karten}</div>`;
}
```

- [ ] **Step 3: `page-trainer.js` — Detailansicht anhängen**

```javascript
function trainerDokumentZeile(trainer, dok) {
  const heute = new Date().toISOString().slice(0, 10);
  const grenze = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  let fristHtml = '<span class="dok-frist ok">ohne Frist</span>';
  if (dok.gueltigBis) {
    let klasse = 'ok';
    if (dok.gueltigBis < heute) klasse = 'abgelaufen';
    else if (dok.gueltigBis <= grenze) klasse = 'bald';
    const praefix = klasse === 'abgelaufen' ? 'abgelaufen am ' : 'gültig bis ';
    fristHtml = `<span class="dok-frist ${klasse}">${praefix}${formatiereDatum(dok.gueltigBis)}</span>`;
  }
  return `
    <div class="dok-row">
      <div class="mat-icon">📄</div>
      <div>
        <div class="mat-name">${escAttr(dok.name)}</div>
        <div class="mat-sub">${Math.max(1, Math.round(dok.groesse / 1024))} KB · ${fristHtml}</div>
      </div>
      <div class="mat-actions">
        <button class="btn" onclick="herunterladeDatei('${escJsArg(dok.id)}', '${escJsArg(dok.name)}')">↓</button>
        <button class="btn btn-ghost-red" onclick="trainerDokumentEntfernenBestaetigen('${escJsArg(trainer.id)}', '${escJsArg(dok.id)}')">Entfernen</button>
      </div>
    </div>`;
}

function trainerDetailHtml(trainer) {
  const termine = termineFuerTrainer(trainer.id);
  const dokumente = (trainer.dokumente || []).length
    ? trainer.dokumente.map(d => trainerDokumentZeile(trainer, d)).join('')
    : '<p class="empty-hint">Noch keine Nachweise hinterlegt.</p>';

  const terminZeilen = termine.length
    ? termine.map(({ kurs, termin, rolle }) => `
        <tr>
          <td class="cell-strong" style="cursor:pointer;" onclick="showSchulungDetail('${escJsArg(termin.id)}')">${formatiereDatum(termin.datum)}</td>
          <td>${escAttr(kurs.titel)}</td>
          <td>${escAttr(termin.ort)}</td>
          <td>${rolle === 'vertretung' ? '<span class="pill">Vertretung</span>' : '<span class="pill">Trainer</span>'}</td>
        </tr>`).join('')
    : '<tr><td colspan="4" class="empty-hint">Diese Person ist keinem Termin zugeordnet.</td></tr>';

  return `
    <button class="crumb" onclick="showTrainerListe()">← Zurück zur Trainerliste</button>

    <div class="card" style="padding:20px 24px; margin-bottom:20px;">
      <div style="display:flex; align-items:flex-start; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:14px;">
          <div class="trainer-avatar" style="width:52px; height:52px; font-size:17px;">${escAttr(trainerInitialen(trainer.name))}</div>
          <div>
            <h2 style="font-size:20px; margin:0 0 4px 0;">${escAttr(trainer.name)}</h2>
            <div style="font-size:12.5px; color:var(--muted);">${escAttr(trainer.qualifikation || 'Keine Qualifikation hinterlegt')}</div>
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn" onclick="oeffneTrainerBearbeitenDialog('${escJsArg(trainer.id)}')">Bearbeiten</button>
          <button class="btn btn-ghost-red" onclick="trainerLoeschenBestaetigen('${escJsArg(trainer.id)}')">Löschen</button>
        </div>
      </div>
      <div style="display:flex; gap:32px; font-size:13px; margin-top:14px;">
        <div><div class="mat-group-label" style="margin:0 0 3px 0;">E-Mail</div><div style="color:var(--ink);">${escAttr(trainer.email || '—')}</div></div>
        <div><div class="mat-group-label" style="margin:0 0 3px 0;">Telefon</div><div style="color:var(--ink);">${escAttr(trainer.telefon || '—')}</div></div>
      </div>
      ${trainer.notizen ? `<div style="margin-top:14px; font-size:13px; color:var(--text);">${escAttr(trainer.notizen)}</div>` : ''}
    </div>

    <div class="card">
      <div class="section-title">Nachweise &amp; Dokumente <small>${(trainer.dokumente || []).length}</small></div>
      ${dokumente}
      <div style="margin-top:12px; display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap;">
        <div class="field" style="flex:1; min-width:180px;">
          <label>Datei</label>
          <input type="file" id="trainer-datei-input" />
        </div>
        <div class="field">
          <label>gültig bis (optional)</label>
          <input type="date" id="trainer-datei-frist" />
        </div>
        <button class="btn btn-primary" onclick="trainerDokumentHochladen('${escJsArg(trainer.id)}')">Hochladen</button>
      </div>
    </div>

    <div class="card">
      <div class="section-title">Eingeplante Termine <small>${termine.length}</small></div>
      <table class="data-table fixed-rows">
        <thead><tr><th>Datum</th><th>Kurs</th><th>Ort</th><th>Rolle</th></tr></thead>
        <tbody>${terminZeilen}</tbody>
      </table>
    </div>`;
}

function renderTrainer(trainerId) {
  const container = document.getElementById('trainer-inhalt');
  if (!container) return;
  const trainer = trainerId ? findeTrainer(trainerId) : undefined;

  if (!trainer) {
    window.AKTUELLER_TRAINER_ID = undefined;
    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-text">
          <h1>Trainer</h1>
          <p class="subtitle">Dozenten, ihre Nachweise und Einsätze.</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" onclick="oeffneNeuerTrainerDialog()">+ Neuer Trainer</button>
        </div>
      </div>
      ${trainerListeHtml()}`;
    return;
  }

  container.innerHTML = trainerDetailHtml(trainer);
}

function showTrainerListe() {
  window.AKTUELLER_TRAINER_ID = undefined;
  renderTrainer(undefined);
}
```

- [ ] **Step 4: `page-trainer.js` — Dialoge und Aktionen anhängen**

```javascript
function trainerFormularFelder(trainer) {
  const t = trainer || { name: '', email: '', telefon: '', qualifikation: '', notizen: '' };
  return `
    <div class="field"><label>Name</label><input name="name" value="${escAttr(t.name)}" required /></div>
    <div class="field-row2">
      <div class="field"><label>E-Mail</label><input type="email" name="email" value="${escAttr(t.email)}" /></div>
      <div class="field"><label>Telefon</label><input name="telefon" value="${escAttr(t.telefon)}" /></div>
    </div>
    <div class="field"><label>Qualifikation / Schwerpunkte</label><input name="qualifikation" value="${escAttr(t.qualifikation)}" /></div>
    <div class="field"><label>Notizen</label><textarea name="notizen" rows="3">${escAttr(t.notizen)}</textarea></div>`;
}

function oeffneNeuerTrainerDialog() {
  oeffneDialog(`
    <div class="dialog-head"><h3>Neuen Trainer anlegen</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form onsubmit="return speichereNeuerTrainer(event)">
      <div class="dialog-body">${trainerFormularFelder(null)}</div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Trainer anlegen</button>
      </div>
    </form>`);
}

function speichereNeuerTrainer(ev) {
  ev.preventDefault();
  erstelleTrainer(formularWerte(ev.target));
  schliesseDialog();
  return false;
}

function oeffneTrainerBearbeitenDialog(trainerId) {
  const trainer = findeTrainer(trainerId);
  oeffneDialog(`
    <div class="dialog-head"><h3>Trainer bearbeiten</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form onsubmit="return speichereTrainerBearbeiten(event, '${escJsArg(trainerId)}')">
      <div class="dialog-body">${trainerFormularFelder(trainer)}</div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Speichern</button>
      </div>
    </form>`);
}

function speichereTrainerBearbeiten(ev, trainerId) {
  ev.preventDefault();
  aktualisiereTrainer(trainerId, formularWerte(ev.target));
  schliesseDialog();
  return false;
}

function trainerLoeschenBestaetigen(trainerId) {
  const trainer = findeTrainer(trainerId);
  const anzahl = termineFuerTrainer(trainerId).length;
  const zusatz = anzahl > 0
    ? `\n\n"${trainer.name}" ist noch bei ${anzahl} Termin(en) eingetragen. Diese Termine haben danach keinen Trainer mehr.`
    : '';
  if (confirm(`"${trainer.name}" wirklich löschen?${zusatz}`)) {
    loescheTrainer(trainerId);
    showTrainerListe();
  }
}

function trainerDokumentHochladen(trainerId) {
  const dateiFeld = document.getElementById('trainer-datei-input');
  const fristFeld = document.getElementById('trainer-datei-frist');
  const datei = dateiFeld && dateiFeld.files[0];
  if (!datei) {
    alert('Bitte zuerst eine Datei auswählen.');
    return;
  }
  speichereTrainerDokument(datei, trainerId, fristFeld ? fristFeld.value : null)
    .catch(err => alert('Upload fehlgeschlagen: ' + err.message));
}

function trainerDokumentEntfernenBestaetigen(trainerId, dateiId) {
  if (confirm('Diesen Nachweis wirklich entfernen?')) {
    loescheTrainerDokumentUndDatei(dateiId, trainerId)
      .catch(err => alert('Entfernen fehlgeschlagen: ' + err.message));
  }
}
```

- [ ] **Step 5: Build und Browser-Verifikation**

Run: `python Design/assemble.py`

Im Claude Browser Pane, nach `localStorage.clear()` und Neuladen, auf der Seite „Trainer":
- Die Liste zeigt 5 Karten mit Initialen-Kreis, Name und Anzahl zugeordneter Termine
- Klick auf eine Karte öffnet die Detailansicht; „← Zurück zur Trainerliste" führt zurück
- „+ Neuer Trainer" legt eine Person an, die sofort in der Liste erscheint
- In der Detailansicht: Datei auswählen, „gültig bis" auf ein vergangenes Datum setzen, „Hochladen" → das Dokument erscheint mit rotem „abgelaufen am …", und die Trainerliste zeigt bei dieser Person „1 Nachweis(e) abgelaufen"
- Ein zweiter Upload mit „gültig bis" in 30 Tagen erscheint in Amber als „gültig bis …"
- „↓" lädt die Datei herunter, „Entfernen" (mit Bestätigung) entfernt sie
- „Bearbeiten" ändert Stammdaten, Änderung sofort sichtbar
- Einen Trainer löschen, der Termine hat → Hinweis nennt die Anzahl; nach Bestätigung zeigt die Terminzeile auf der Schulungen-Seite „Kein Trainer zugeordnet" in Rot
- Danach `localStorage.clear()` + Neuladen, um den Teststand zu entfernen
- Konsole ohne Fehler

- [ ] **Step 6: Commit**

```bash
git add Design/fragments/page-trainer.html Design/fragments/page-trainer.js Berichte/index.html
git commit -m "feat: Trainer-Seite mit Nachweisdokumenten und Termin-Zuordnung"
```

---

## Task 8: Unterbesetzung in der Übersicht, Automatik-Kennzeichen in den Buchungen

**Files:**
- Modify: `Design/fragments/page-uebersicht.js`
- Modify: `Design/fragments/page-buchungen.js`

**Interfaces:**
- Consumes: `terminAuslastung()` (jetzt mit `unterbesetzt`/`minTeilnehmer`), `escAttr()`
- Produces: keine neuen globalen Funktionen

- [ ] **Step 1: „Unterbesetzt"-Kennzeichnung in der Übersicht ergänzen**

Ersetze in `Design/fragments/page-uebersicht.js` die Funktion `uebersichtTerminSpalte` vollständig durch:

```javascript
function uebersichtTerminSpalte(termin) {
  const a = terminAuslastung(termin.id);
  const istVoll = a.belegt >= a.kapazitaet;
  let badge;
  if (istVoll) {
    badge = '<span class="badge badge-indigo">Ausgebucht</span>';
  } else if (a.unterbesetzt) {
    badge = `<span class="badge badge-unterbesetzt">Unterbesetzt (${a.belegt} von mind. ${a.minTeilnehmer})</span>`;
  } else {
    badge = `<span class="badge badge-green">${a.frei} Plätze frei</span>`;
  }
  return `
    <div class="termin-col">
      <div class="termin-col-label">${formatiereDatum(termin.datum)}</div>
      <div class="progress-track"><div class="progress-fill ${istVoll ? 'full' : ''}" style="width:${a.prozent}%"></div></div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; gap:8px;">
        <span style="font-size:12px; color:var(--muted);">${a.belegt} von ${a.kapazitaet} belegt</span>
        ${badge}
      </div>
    </div>`;
}
```

- [ ] **Step 2: Automatik-Kennzeichen in der Buchungsliste ergänzen**

Ersetze in `Design/fragments/page-buchungen.js` innerhalb von `buchungenZeile` die Status-Zelle durch:

```javascript
      <td>${anmeldestatusBadgeHtml(buchung.anmeldestatus)}${
        buchung.statusManuell
          ? ''
          : '<span class="auto-marker" title="Status wurde automatisch gesetzt">⏱</span>'
      }</td>
```

- [ ] **Step 3: Build und Browser-Verifikation**

Run: `python Design/assemble.py`

Im Claude Browser Pane, nach `localStorage.clear()` und Neuladen:
- Übersicht: Termin `18.11.2026` (Datenschutzbeauftragter, 0 Buchungen, min 5) zeigt „Unterbesetzt (0 von mind. 5)" in Amber; Termin `12.08.2026` (5 Buchungen, min 5) zeigt „5 Plätze frei" in Grün; „Brandschutzhelfer Ausbildung" (5 von 5) zeigt weiterhin „Ausgebucht" in Indigo
- Buchungen: Zeilen zeigen hinter dem Status ein Uhr-Symbol, solange der Status nicht manuell gesetzt wurde. Nach Ändern eines Status per Dropdown auf der Schulungsdetailseite verschwindet das Symbol bei dieser Buchung
- Konsole ohne Fehler

- [ ] **Step 4: Commit**

```bash
git add Design/fragments/page-uebersicht.js Design/fragments/page-buchungen.js Berichte/index.html
git commit -m "feat: Unterbesetzt-Kennzeichnung in der Uebersicht, Automatik-Kennzeichen in den Buchungen"
```

---

## Task 9: Hilfeseite

**Files:**
- Modify: `Design/fragments/page-hilfe.html` (ersetzt den Platzhalter aus Task 5)

**Interfaces:**
- Consumes: nichts (statische Seite)
- Produces: nichts

- [ ] **Step 1: `page-hilfe.html` schreiben**

```html
<div class="page-header">
  <div class="page-header-text">
    <h1>Hilfe</h1>
    <p class="subtitle">Wie der Schulungsplaner rechnet und was die Funktionen bewirken.</p>
  </div>
</div>

<div class="card" style="padding:22px 26px; max-width:820px;">

  <div class="hilfe-block">
    <h3>Kurse und Termine</h3>
    <p>Ein <strong>Kurs</strong> ist das inhaltliche Thema (z.&nbsp;B. „Erste-Hilfe-Kurs"). Ein <strong>Termin</strong> ist eine konkrete Durchführung dieses Kurses an einem Datum. Ein Kurs kann beliebig viele Termine im Jahr haben.</p>
    <p>Am <strong>Kurs</strong> hängen: Beschreibung, Lernziele, Agenda, Materialien, Format, Mindest- und Maximalteilnehmerzahl sowie die Angaben für die Bescheinigung. Diese gelten für <em>alle</em> Termine des Kurses.</p>
    <p>Am <strong>Termin</strong> hängen: Datum, Trainer, Vertretung, Ort, Status, Checkliste und die gebuchten Teilnehmer. Diese unterscheiden sich je Durchführung.</p>
  </div>

  <div class="hilfe-block">
    <h3>Auslastung</h3>
    <p>Die Auslastung eines Termins zählt alle Buchungen <strong>außer den abgesagten</strong>. Wer absagt, gibt seinen Platz also wieder frei.</p>
    <ul>
      <li><strong>Ausgebucht</strong> (indigo): Die Maximalteilnehmerzahl des Kurses ist erreicht. Buchen ist weiterhin möglich, aber nur nach Rückfrage.</li>
      <li><strong>Unterbesetzt</strong> (amber): Es sind weniger Teilnehmer gebucht als die Mindestteilnehmerzahl des Kurses vorgibt. Hier lohnt sich ein Blick, ob Teilnehmer auf den Folgetermin verschoben werden sollten.</li>
      <li><strong>X Plätze frei</strong> (grün): Alles im grünen Bereich.</li>
    </ul>
  </div>

  <div class="hilfe-block">
    <h3>Teilnehmer verschieben</h3>
    <p>Ist ein Termin unterbesetzt, zeigt die Übersicht direkt daneben den nächsten Termin desselben Kurses mit seiner Auslastung. Über die Schulungsdetailseite lässt sich ein Teilnehmer per <strong>„Verschieben"</strong> auf einen anderen Termin desselben Kurses umbuchen. Buchungsdatum und Anmeldestatus bleiben dabei erhalten.</p>
  </div>

  <div class="hilfe-block">
    <h3>Anmeldestatus und Automatik</h3>
    <p>Eine neue Buchung startet als <strong>angemeldet</strong>. Liegt der Termin höchstens sieben Tage in der Zukunft, setzt das System den Status automatisch auf <strong>bestätigt</strong>.</p>
    <p>Sobald du einen Status <strong>von Hand</strong> änderst, hat das Vorrang: Diese Buchung wird von der Automatik nie wieder angefasst. In der Buchungsliste erkennst du an dem Uhr-Symbol ⏱ hinter dem Status, dass er automatisch gesetzt wurde — fehlt das Symbol, wurde manuell eingegriffen.</p>
  </div>

  <div class="hilfe-block">
    <h3>Trainer und Nachweise</h3>
    <p>Trainer werden im Bereich <strong>Trainer</strong> gepflegt und beim Termin ausgewählt. Zusätzlich lässt sich je Termin eine <strong>Vertretung</strong> hinterlegen, die im Krankheitsfall einspringt.</p>
    <p>Zu jedem Trainer können Nachweise (Zeugnisse, Zertifikate) hochgeladen werden, optional mit einem <strong>„gültig bis"</strong>-Datum. Läuft ein Nachweis ab oder läuft er innerhalb der nächsten 60 Tage ab, wird das in der Trainerliste angezeigt.</p>
  </div>

  <div class="hilfe-block">
    <h3>Kategorien</h3>
    <p>Kategorien sind nicht fest vorgegeben. Beim Anlegen oder Bearbeiten eines Kurses kannst du eine bestehende Kategorie aus der Vorschlagsliste wählen oder einfach eine neue eintippen — sie steht danach überall zur Verfügung.</p>
  </div>

  <div class="hilfe-block">
    <h3>Wo die Daten liegen</h3>
    <p>Alle Daten liegen <strong>ausschließlich lokal in diesem Browser</strong> auf diesem Rechner. Es gibt keinen Server, nichts wird übertragen. Ein anderer Browser oder ein anderer Rechner sieht diese Daten nicht.</p>
    <ul>
      <li><strong>Exportieren</strong> — lädt den kompletten Datenstand als JSON-Datei herunter. Das ist deine Sicherung und der Weg, Daten auf einen anderen Rechner zu bringen. Hochgeladene Dateien sind darin nicht enthalten.</li>
      <li><strong>Importieren</strong> — liest eine solche Datei wieder ein und ersetzt den aktuellen Stand. Ist die Datei fehlerhaft, bleibt der bisherige Stand erhalten.</li>
      <li><strong>Zurücksetzen</strong> — stellt die mitgelieferten Beispieldaten wieder her. Alle eigenen Eingaben gehen verloren.</li>
      <li><strong>Alle Daten leeren</strong> — löscht Kurse, Termine, Buchungen, Teilnehmer, Trainer und alle hochgeladenen Dateien. Für den sauberen Start mit echten Daten. Nicht umkehrbar.</li>
    </ul>
  </div>

</div>
```

- [ ] **Step 2: Build und Browser-Verifikation**

Run: `python Design/assemble.py`

Im Claude Browser Pane: Menüpunkt „Hilfe" öffnen. Die Seite zeigt alle sieben Abschnitte lesbar, Umlaute korrekt dargestellt (z. B. „Rückfrage", „Mindestteilnehmerzahl", „gültig bis"), keine Konsolenfehler.

- [ ] **Step 3: Commit**

```bash
git add Design/fragments/page-hilfe.html Berichte/index.html
git commit -m "feat: Hilfeseite mit Erklaerung der Systemlogik"
```

---

## Task 10: Zusammenbau und Ende-zu-Ende-Verifikation

**Files:**
- Modify: `Berichte/index.html` (nur über `assemble.py`, keine Handedits)

**Interfaces:**
- Consumes: alle vorherigen Tasks
- Produces: geprüfte, ausgelieferte `Berichte/index.html`

- [ ] **Step 1: Sauberen Build erzeugen und Daten prüfen**

Run: `python Design/verify_migration_v3.py && python Design/assemble.py`
Expected: „v3-Migration verifiziert: keine Fehler." gefolgt von der Build-Meldung, beides ohne Fehler.

- [ ] **Step 2: Grundzustand prüfen**

Im Claude Browser Pane `localStorage.clear()`, neu laden, dann `read_console_messages` mit `onlyErrors: true`.
Expected: keine Fehler; in der Konsole `window.STATE.kurse.length` → `8`, `window.STATE.trainer.length` → `5`, `document.querySelectorAll('.sidebar-nav-item').length` → `5`.

- [ ] **Step 3: Durchgängiger Stammdaten-Flow**

1. „Trainer" → „+ Neuer Trainer" anlegen (Name „Testdozent", E-Mail, Qualifikation)
2. Detailansicht öffnen, eine Testdatei mit „gültig bis" in der Vergangenheit hochladen → rote Abgelaufen-Markierung, Trainerliste zeigt die Warnung
3. „Schulungen" → „+ Neuer Kurs" mit neuer Kategorie („Testkategorie"), Format „Online", Min 3, Max 12, Umfang 6, Kürzel „TST"
4. Prüfen: Der Kategorie-Filter auf der Schulungen-Seite enthält jetzt „Testkategorie"
5. Bei diesem Kurs „+ Termin": Trainer „Testdozent", Vertretung eine andere Person, Datum in 3 Tagen
6. Übersicht öffnen → der neue Kurs zeigt „Unterbesetzt (0 von mind. 3)"
7. Auf der Schulungsdetailseite des neuen Termins einen Teilnehmer hinzufügen → Übersicht zeigt „Unterbesetzt (1 von mind. 3)"

Expected: alle Schritte ohne Konsolenfehler, Anzeigen aktualisieren sich sofort.

- [ ] **Step 4: Status-Automatik prüfen**

Der in Schritt 3 angelegte Termin liegt 3 Tage in der Zukunft, die Frist beträgt 7 Tage. Seite neu laden (F5) und die Buchung in der Buchungsliste prüfen.
Expected: Status ist „bestätigt" mit Uhr-Symbol. Nach manuellem Ändern auf „angemeldet" über die Schulungsdetailseite verschwindet das Uhr-Symbol, und ein erneutes Neuladen setzt den Status **nicht** zurück auf „bestätigt".

- [ ] **Step 5: Persistenz, Export/Import, Zurücksetzen, Leeren**

1. Seite neu laden → die Testdaten aus Schritt 3 sind noch da
2. „Exportieren" → Download wird ausgelöst
3. „Zurücksetzen" bestätigen → `window.STATE.kurse.length` ist wieder `8`, `window.STATE.trainer.length` wieder `5`
4. „Alle Daten leeren" bestätigen → alle fünf Listen sind leer; Übersicht, Schulungen, Buchungen und Trainer zeigen jeweils ihren Leer-Hinweis statt einer kaputten Seite; Konsole ohne Fehler
5. „Zurücksetzen" → Beispieldaten sind wieder da

Expected: jeder Schritt wie beschrieben, keine Konsolenfehler.

- [ ] **Step 6: Umlaute im ausgelieferten Build prüfen (CLAUDE.md-Pflicht)**

Run: `python -c "c = open('Berichte/index.html', encoding='utf-8').read(); assert 'Mindestteilnehmerzahl' in c and 'gültig bis' in c and 'Rückfrage' in c and '�' not in c and 'Ã¤' not in c, 'Umlaute defekt'; print('Umlaute ok, Länge:', len(c))"`
Expected: „Umlaute ok, Länge: …" ohne AssertionError.

- [ ] **Step 7: Abschließenden Zustand herstellen und committen**

Nach der Verifikation im Browser einmal „Zurücksetzen" klicken, damit der lokale Stand wieder den Beispieldaten entspricht (der `localStorage` selbst ist nicht Teil des Commits).

```bash
git add Berichte/index.html
git commit -m "chore: finaler Build nach Ende-zu-Ende-Verifikation Phase 1"
```

Falls `git status` keine Änderung an `Berichte/index.html` zeigt, weil der Build bereits in Task 9 committet wurde: nichts zu committen, das ist der erwartete Normalfall — dann diesen Schritt überspringen und im Bericht vermerken.

---

## Selbst-Review-Notizen (bereits eingearbeitet)

- **Spec-Abdeckung** gegen `Design/design-spec-v3.md`, Phase 1: Kategorien (Task 6) · Min/Max am Kurs + Unterbesetzung (Task 1, 2, 6, 8) · Format am Kurs (Task 1, 2, 6) · Zertifikatsfelder am Kurs (Task 1, 2, 6 — die Bescheinigung selbst ist Phase 2) · Trainer-Bereich mit Dokumenten und Ablaufwarnung (Task 2, 3, 7) · Vertretung am Termin (Task 1, 2, 6) · Trainer löschen mit Folgeanzeige (Task 2, 6, 7) · Status-Automatik mit manuellem Vorrang und Kennzeichnung (Task 3, 5, 8) · Hilfebereich (Task 9) · Alle Daten leeren inkl. IndexedDB (Task 3, 5). Die Felder `anwesenheitProzent`, `fehlgrund`, `zertifikatNr` und `termin.abschluss` werden in Task 1 bereits angelegt, aber erst in Phase 2 benutzt — bewusst, damit das Schema nicht zweimal migriert werden muss.
- **Platzhalter-Scan:** keine TBD/TODO; jeder Code-Schritt enthält vollständigen, lauffähigen Code.
- **Typ-Konsistenz geprüft:** `terminAuslastung` liefert durchgängig `{belegt, kapazitaet, minTeilnehmer, frei, prozent, unterbesetzt}` und wird in Task 6 und 8 so verwendet; `termineFuerTrainer` liefert `[{kurs, termin, rolle}]` und wird in Task 7 so gelesen; `trainerDokumentStatus` liefert `{abgelaufen, laeuftBaldAb}`; `schulungenTrainerOptionen(ausgewaehlt, mitLeer)` wird in beiden Termin-Dialogen mit derselben Signatur aufgerufen; `renderTrainer(trainerId)` toleriert `undefined` und wird so aus `renderAll()` aufgerufen.
- **Bewusste Entscheidungen:** Der Storage-Key springt auf `_v3`, weil ein v2-Stand im Browser strukturell inkompatibel ist — alte Stände werden verworfen statt migriert (dies ist ein Prototyp mit Beispieldaten, und der Nutzer startet ohnehin mit „Alle Daten leeren" produktiv). Trainer-Auswahl beim Termin ist Pflicht mit „— keine —"-Option statt eines Freitextfelds, damit die Trainer-Übersicht vollständig bleibt.

