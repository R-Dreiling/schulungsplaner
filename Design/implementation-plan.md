# Schulungsplaner v2 (Kurs/Termin/Buchung) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den bestehenden Schulungsplaner-Klickprototyp zu einem echten, dauerhaft nutzbaren Planungswerkzeug ausbauen: Kurs/Termin/Buchungs-Datenmodell, Browser-Persistenz, voller CRUD (Kurse, Termine, Teilnehmer, Buchungen, Materialien-Upload), bereinigtes Design gemäß `Design/design-spec.md`.

**Architecture:** Weiterhin ein einzelnes selbsterklärendes HTML-Dokument (`Berichte/index.html`), gebaut aus Shell + gemeinsamem CSS + Seiten-Fragmenten + Daten via `Design/assemble.py`. Neu: ein zentrales State-Objekt im Browser (`Design/state-engine.js`), das bei jeder Änderung automatisch in `localStorage` persistiert wird; Dateien (Materialien) liegen in `IndexedDB` (`Design/file-store.js`). Jede Seite rendert sich aus diesem State über eine eigene `render*()`-Funktion statt aus festem HTML.

**Tech Stack:** Vanilla HTML/CSS/JS (kein Framework, kein Build-Tool, kein Node — auf dieser Maschine nicht installiert), Python 3 nur für den lokalen Zusammenbau-Schritt (`assemble.py`) und die einmalige Datenmigration.

## Global Constraints

- Kein Server/Backend, keine Mehrbenutzer-Synchronisation — Daten liegen lokal im Browser (siehe `Design/design-spec.md`, Abschnitt „Aus dem Scope ausgeschlossen")
- Design-Tokens/Farben/Schriften strikt aus `Design/styles.css` bzw. Wurzel-`CLAUDE.md` (Poppins/Mulish, Teal `#2BD5D8`/`#0B8A8D`, Indigo `#6C7BFF`/`#4D5EE6`, Lime `#BFF247`/`#7FAE13`, Ink `#0A1028`) — keine neuen Akzentfarben erfinden
- Status-Farb-Zuordnung app-weit einheitlich: Grün = bestätigt/aktiv, Amber = angemeldet/geplant, Grau = abgeschlossen, Rot = abgesagt, Indigo = ausgebucht/voll
- Jede Funktion muss einem konkreten Planungszweck dienen, keine dekorativen Spielereien (siehe Nutzer-Feedback)
- Kein Node.js/npm verfügbar — keine JS-Build-Tools, kein JS-Testrunner. Verifikation von JS/UI-Code erfolgt manuell im Browser (Claude Browser Pane), wie in `Design/design-spec.md` unter „Manuelle Prüfung" festgelegt
- Jeder Task endet mit `git add` + `git commit` (lokales Repo, kein Remote)
- Deutsch als UI-Sprache durchgehend, Umlaute korrekt in UTF-8

---

## Datei-Übersicht

| Datei | Aktion | Zweck |
|---|---|---|
| `Design/migrate_data.py` | neu | Einmalige Migration alte Struktur → Kurs/Termin/Buchung |
| `Daten/schulungsdaten.json` | überschrieben | Neue Datenstruktur (Ergebnis der Migration) |
| `Design/state-engine.js` | neu | Zentraler State, localStorage-Persistenz, CRUD-Mutatoren, abgeleitete Daten, Export/Import/Reset |
| `Design/file-store.js` | neu | IndexedDB-Speicher für Materialien-Dateien |
| `Design/styles.css` | erweitert | Neue Komponentenklassen (Dialoge, Sprungmarken-Nav, Ausklapp-Zeilen, Agenda/Checkliste/Materialien) |
| `Design/shell-template.html` | überarbeitet | 3-Punkte-Sidebar, Einbindung der JS-Module, globale Dialog-Infrastruktur |
| `Design/fragments/page-uebersicht.html` (+`.js`) | neu geschrieben | Navigator-Seite |
| `Design/fragments/page-schulungen.html` (+`.js`) | neu geschrieben | Kurs/Termin-Verwaltung |
| `Design/fragments/page-schulungdetail.html` (+`.js`) | neu geschrieben | Termin-Detailseite |
| `Design/fragments/page-buchungen.html` (+`.js`) | neu (ersetzt teilnehmer+kunden) | Buchungsliste |
| `Design/fragments/page-teilnehmer.html/.css`, `page-kunden.html/.css` | gelöscht | ersetzt durch page-buchungen |
| `Design/assemble.py` | angepasst | neue Seitenliste, JS-Module einbinden |

---

## Task 1: Datenmodell-Migration (Kurs/Termin/Buchung)

**Files:**
- Create: `Design/migrate_data.py`
- Modify: `Daten/schulungsdaten.json` (wird vom Skript überschrieben)
- Test: `Design/verify_migration.py`

**Interfaces:**
- Produces: `Daten/schulungsdaten.json` mit Top-Level-Keys `kurse` (Liste), `teilnehmer` (Liste), `buchungen` (Liste) — **kein** `schulungen`-Key, **kein** `kunden`-Key mehr.
  - Kurs-Objekt: `{id, titel, kategorie, beschreibung, lernziele:[str], zielgruppe, voraussetzungen, agenda:[{zeit,titel,beschreibung}], materialien:{seminarunterlagen:[], vorlagen:[]}, termine:[Termin]}`
  - Termin-Objekt (verschachtelt in `kurs.termine`): `{id, datum, trainer, format, ort, kapazitaet, status, checkliste:[{label, erledigt}]}`
  - Teilnehmer-Objekt: `{id, name, firma, email, bestandskunde}` (kein `schulungIds`, kein `anmeldestatus` mehr)
  - Buchung-Objekt: `{id, teilnehmerId, terminId, anmeldestatus, gebuchtAm}` (`terminId` referenziert die Termin-`id`, nicht den Kurs)

- [ ] **Step 1: Migrationsskript schreiben**

```python
# Design/migrate_data.py
# -*- coding: utf-8 -*-
"""Einmalige Migration: alte Struktur (schulungen/teilnehmer/kunden) ->
neue Struktur (kurse mit verschachtelten terminen, teilnehmer, buchungen).
Nach erfolgreicher Migration + Verifikation kann diese Datei bleiben
(dokumentiert die Herkunft der Daten), wird aber nicht mehr ausgefuehrt."""
import json
import hashlib
from datetime import date, timedelta
from pathlib import Path

BASE = Path(__file__).parent
DATA_PATH = BASE.parent / "Daten" / "schulungsdaten.json"

CHECKLISTE_LABELS = [
    "Raum gebucht", "Technik geprüft", "Unterlagen gedruckt",
    "Einladungen versendet", "Zertifikate vorbereitet",
]

# schulung-id -> kurs-id Gruppierung (in den Beispieldaten hat aktuell jede
# schulung einen eigenen Titel, daher 1:1 -- ausser s1 und s3, denen wir je
# einen zusaetzlichen synthetischen Zweittermin geben, um das Kern-Feature
# "zwei Termine je Kurs" mit den Beispieldaten zeigen zu koennen).
SCHULUNG_ZU_KURS = {
    "s1": "k1", "s5": "k2", "s2": "k3", "s3": "k4",
    "s7": "k5", "s4": "k6", "s6": "k7", "s8": "k8",
}

KURS_META = {
    "k1": dict(titel="Datenschutzbeauftragter Grundlagenschulung", kategorie="Datenschutz",
        beschreibung="Grundlagenschulung für neu bestellte oder angehende Datenschutzbeauftragte. Vermittelt die rechtlichen Grundlagen der DSGVO sowie die praktische Umsetzung im Unternehmensalltag.",
        lernziele=["Rechtliche Grundlagen der DSGVO und des BDSG verstehen", "Rollen und Pflichten des Datenschutzbeauftragten kennen", "Ein Verfahrensverzeichnis eigenständig aufbauen können", "Meldepflichten bei Datenschutzverstößen sicher anwenden"],
        zielgruppe="Neue und angehende Datenschutzbeauftragte", voraussetzungen="Keine",
        agenda=[
            {"zeit": "09:00–10:30", "titel": "Rechtliche Grundlagen der DSGVO", "beschreibung": "Überblick über Verordnung, BDSG und Zusammenspiel"},
            {"zeit": "10:45–12:00", "titel": "Rollen & Pflichten des DSB", "beschreibung": "Bestellung, Stellung im Unternehmen, Haftung"},
            {"zeit": "13:00–14:30", "titel": "Verfahrensverzeichnis in der Praxis", "beschreibung": "Aufbau und Pflege anhand von Beispielen"},
            {"zeit": "14:45–16:00", "titel": "Meldepflichten & Vorfallmanagement", "beschreibung": "Ablauf bei Datenschutzverstößen, Fristen"},
        ]),
    "k2": dict(titel="DSGVO Update für Führungskräfte", kategorie="Datenschutz",
        beschreibung="Kompaktes Update zu aktuellen DSGVO-Entwicklungen speziell für Führungskräfte mit Personalverantwortung.",
        lernziele=["Aktuelle Rechtsprechung zur DSGVO kennen", "Verantwortung als Führungskraft einschätzen können", "Datenschutzrisiken im eigenen Bereich erkennen"],
        zielgruppe="Führungskräfte", voraussetzungen="Grundkenntnisse Datenschutz empfohlen",
        agenda=[
            {"zeit": "09:00–10:30", "titel": "Aktuelle Rechtsprechung", "beschreibung": "Relevante Urteile und deren Praxisfolgen"},
            {"zeit": "10:45–12:00", "titel": "Verantwortung der Führungsebene", "beschreibung": "Haftung, Organisationspflichten"},
        ]),
    "k3": dict(titel="Hinweisgeberschutz kompakt", kategorie="Compliance",
        beschreibung="Kompaktschulung zu den Anforderungen des Hinweisgeberschutzgesetzes und dem Aufbau interner Meldestellen.",
        lernziele=["Anforderungen des Hinweisgeberschutzgesetzes kennen", "Interne Meldestelle korrekt aufsetzen", "Meldungen rechtssicher bearbeiten"],
        zielgruppe="Compliance-Verantwortliche, Personalabteilung", voraussetzungen="Keine",
        agenda=[
            {"zeit": "09:00–10:15", "titel": "Rechtlicher Rahmen", "beschreibung": "HinSchG im Überblick"},
            {"zeit": "10:30–12:00", "titel": "Meldestelle einrichten", "beschreibung": "Organisatorische und technische Anforderungen"},
            {"zeit": "13:00–14:30", "titel": "Fallbearbeitung in der Praxis", "beschreibung": "Vom Eingang der Meldung bis zum Abschluss"},
        ]),
    "k4": dict(titel="Arbeitssicherheit Basisschulung", kategorie="Arbeitssicherheit",
        beschreibung="Basisschulung zu den gesetzlichen Grundlagen der Arbeitssicherheit und praktischen Gefahrenprävention am Arbeitsplatz.",
        lernziele=["Gesetzliche Grundlagen des Arbeitsschutzes kennen", "Gefahren am Arbeitsplatz erkennen", "Präventionsmaßnahmen richtig anwenden"],
        zielgruppe="Alle Mitarbeitenden", voraussetzungen="Keine",
        agenda=[
            {"zeit": "09:00–10:30", "titel": "Grundlagen des Arbeitsschutzes", "beschreibung": "Gesetze, Verordnungen, Zuständigkeiten"},
            {"zeit": "10:45–12:00", "titel": "Gefahrenerkennung", "beschreibung": "Typische Gefahrenquellen im Arbeitsalltag"},
            {"zeit": "13:00–14:30", "titel": "Praxisübung Prävention", "beschreibung": "Maßnahmen anhand von Fallbeispielen"},
        ]),
    "k5": dict(titel="Gefährdungsbeurteilung Workshop", kategorie="Arbeitssicherheit",
        beschreibung="Praxisworkshop zur Erstellung und Aktualisierung von Gefährdungsbeurteilungen im Unternehmen.",
        lernziele=["Systematik der Gefährdungsbeurteilung anwenden", "Gefährdungen strukturiert erfassen", "Maßnahmen ableiten und dokumentieren"],
        zielgruppe="Führungskräfte, Sicherheitsbeauftragte", voraussetzungen="Keine",
        agenda=[
            {"zeit": "09:00–10:30", "titel": "Systematik & Rechtsgrundlagen", "beschreibung": "Ablauf und gesetzliche Vorgaben"},
            {"zeit": "10:45–12:30", "titel": "Praxis-Workshop", "beschreibung": "Gefährdungsbeurteilung anhand eigener Arbeitsplätze"},
        ]),
    "k6": dict(titel="Brandschutzhelfer Ausbildung", kategorie="Arbeitssicherheit",
        beschreibung="Ausbildung zum betrieblichen Brandschutzhelfer nach DGUV Information 205-023, Theorie und Löschübung.",
        lernziele=["Aufgaben des Brandschutzhelfers kennen", "Brandklassen und Löschmittel unterscheiden", "Löschgerät im Ernstfall sicher bedienen"],
        zielgruppe="Benannte Brandschutzhelfer", voraussetzungen="Keine",
        agenda=[
            {"zeit": "09:00–10:00", "titel": "Brandschutzgrundlagen", "beschreibung": "Brandklassen, Brandentstehung, Löschmittel"},
            {"zeit": "10:15–11:30", "titel": "Verhalten im Brandfall", "beschreibung": "Alarmierung, Evakuierung, Aufgaben des Helfers"},
            {"zeit": "11:45–13:00", "titel": "Praktische Löschübung", "beschreibung": "Handhabung von Feuerlöschern im Freien"},
        ]),
    "k7": dict(titel="Erste-Hilfe-Kurs", kategorie="Arbeitssicherheit",
        beschreibung="Betrieblicher Erste-Hilfe-Kurs nach DGUV Grundsatz 304-001 zur Ausbildung betrieblicher Ersthelfer.",
        lernziele=["Grundlagen der Ersten Hilfe anwenden", "Lebensrettende Sofortmaßnahmen sicher durchführen", "Verhalten im Notfall koordinieren"],
        zielgruppe="Benannte Ersthelfer", voraussetzungen="Keine",
        agenda=[
            {"zeit": "09:00–10:30", "titel": "Grundlagen der Ersten Hilfe", "beschreibung": "Absicherung, Notruf, Eigenschutz"},
            {"zeit": "10:45–12:15", "titel": "Lebensrettende Sofortmaßnahmen", "beschreibung": "Stabile Seitenlage, Reanimation"},
            {"zeit": "13:00–14:30", "titel": "Praxisübungen", "beschreibung": "Übungen an Fallbeispielen"},
        ]),
    "k8": dict(titel="Datenschutz-Auffrischung", kategorie="Datenschutz",
        beschreibung="Jährliche Pflicht-Auffrischung der Datenschutzgrundlagen für alle Mitarbeitenden.",
        lernziele=["Datenschutzgrundlagen im Arbeitsalltag anwenden", "Typische Fehlerquellen vermeiden", "Aktuelle Änderungen kennen"],
        zielgruppe="Alle Mitarbeitenden", voraussetzungen="Vorherige Datenschutzschulung",
        agenda=[
            {"zeit": "09:00–10:00", "titel": "Auffrischung der Grundlagen", "beschreibung": "Zentrale Prinzipien der DSGVO"},
            {"zeit": "10:15–11:00", "titel": "Typische Fehlerquellen", "beschreibung": "Beispiele aus der Praxis"},
        ]),
}

# Zusaetzliche synthetische Zweit-Termine, um "zwei naechste Termine je Kurs"
# mit den Beispieldaten sinnvoll zu zeigen. s1 (Datenschutzbeauftragter) und
# s3 (Arbeitssicherheit Basisschulung, aktuell 7/7 ausgebucht) bekommen je
# einen leeren Zweittermin.
ZUSATZ_TERMINE = {
    "k1": [{"id": "s1b", "datum": "2026-11-18", "trainer": "Dr. Julia Berg", "format": "Vor Ort", "ort": "Hamburg", "kapazitaet": 10, "status": "geplant"}],
    "k4": [{"id": "s3b", "datum": "2026-10-15", "trainer": "Sabine Kroll", "format": "Vor Ort", "ort": "München", "kapazitaet": 7, "status": "geplant"}],
}


def checkliste_fuer(status):
    erledigt = status in ("laufend", "abgeschlossen")
    return [{"label": label, "erledigt": erledigt} for label in CHECKLISTE_LABELS]


def gebucht_am(teilnehmer_id, termin_id, termin_datum_str):
    """Deterministisches, plausibles Buchungsdatum vor dem Termin."""
    termin_datum = date.fromisoformat(termin_datum_str)
    h = int(hashlib.sha256(f"{teilnehmer_id}:{termin_id}".encode("utf-8")).hexdigest(), 16)
    offset_tage = 14 + (h % 45)
    return (termin_datum - timedelta(days=offset_tage)).isoformat()


def migrieren():
    alt = json.loads(DATA_PATH.read_text(encoding="utf-8"))

    kurse_by_id = {}
    for schulung in alt["schulungen"]:
        s_id = schulung["id"]
        k_id = SCHULUNG_ZU_KURS[s_id]
        if k_id not in kurse_by_id:
            meta = KURS_META[k_id]
            kurse_by_id[k_id] = {
                "id": k_id, "titel": meta["titel"], "kategorie": meta["kategorie"],
                "beschreibung": meta["beschreibung"], "lernziele": meta["lernziele"],
                "zielgruppe": meta["zielgruppe"], "voraussetzungen": meta["voraussetzungen"],
                "agenda": meta["agenda"],
                "materialien": {"seminarunterlagen": [], "vorlagen": []},
                "termine": [],
            }
        termin = {
            "id": s_id, "datum": schulung["datum"], "trainer": schulung["trainer"],
            "format": schulung["format"], "ort": schulung["ort"],
            "kapazitaet": schulung["kapazitaet"], "status": schulung["status"],
            "checkliste": checkliste_fuer(schulung["status"]),
        }
        kurse_by_id[k_id]["termine"].append(termin)

    for k_id, zusatz_liste in ZUSATZ_TERMINE.items():
        for zusatz in zusatz_liste:
            kurse_by_id[k_id]["termine"].append({
                **zusatz, "checkliste": checkliste_fuer(zusatz["status"]),
            })

    for kurs in kurse_by_id.values():
        kurs["termine"].sort(key=lambda t: t["datum"])

    neue_teilnehmer = []
    neue_buchungen = []
    buchung_zaehler = 1
    for t in alt["teilnehmer"]:
        neue_teilnehmer.append({
            "id": t["id"], "name": t["name"], "firma": t["firma"],
            "email": t["email"], "bestandskunde": t["bestandskunde"],
        })
        for schulung_id in t["schulungIds"]:
            termin_datum = next(
                s["datum"] for s in alt["schulungen"] if s["id"] == schulung_id
            )
            neue_buchungen.append({
                "id": f"b{buchung_zaehler}",
                "teilnehmerId": t["id"],
                "terminId": schulung_id,
                "anmeldestatus": t["anmeldestatus"],
                "gebuchtAm": gebucht_am(t["id"], schulung_id, termin_datum),
            })
            buchung_zaehler += 1

    neu = {
        "kurse": sorted(kurse_by_id.values(), key=lambda k: k["id"]),
        "teilnehmer": neue_teilnehmer,
        "buchungen": neue_buchungen,
    }
    DATA_PATH.write_text(json.dumps(neu, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Migriert: {len(neu['kurse'])} Kurse, "
          f"{sum(len(k['termine']) for k in neu['kurse'])} Termine, "
          f"{len(neue_teilnehmer)} Teilnehmer, {len(neue_buchungen)} Buchungen")


if __name__ == "__main__":
    migrieren()
```

- [ ] **Step 2: Verifikationsskript schreiben**

```python
# Design/verify_migration.py
# -*- coding: utf-8 -*-
"""Prueft Invarianten der migrierten Daten. Exit-Code 1 bei Fehlern."""
import json
from pathlib import Path

DATA_PATH = Path(__file__).parent.parent / "Daten" / "schulungsdaten.json"


def main():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    fehler = []

    if "schulungen" in data or "kunden" in data:
        fehler.append("Alte Top-Level-Keys 'schulungen'/'kunden' noch vorhanden")

    kurse = data.get("kurse", [])
    if len(kurse) != 8:
        fehler.append(f"Erwartet 8 Kurse, gefunden {len(kurse)}")

    alle_termin_ids = set()
    for kurs in kurse:
        for feld in ("id", "titel", "kategorie", "beschreibung", "lernziele", "agenda", "materialien", "termine"):
            if feld not in kurs:
                fehler.append(f"Kurs {kurs.get('id')} fehlt Feld '{feld}'")
        for termin in kurs.get("termine", []):
            for feld in ("id", "datum", "trainer", "format", "ort", "kapazitaet", "status", "checkliste"):
                if feld not in termin:
                    fehler.append(f"Termin {termin.get('id')} fehlt Feld '{feld}'")
            if termin["id"] in alle_termin_ids:
                fehler.append(f"Doppelte Termin-ID: {termin['id']}")
            alle_termin_ids.add(termin["id"])
            if len(termin.get("checkliste", [])) != 5:
                fehler.append(f"Termin {termin['id']}: Checkliste hat nicht 5 Punkte")

    erwartete_zusatz_termine = {"s1b", "s3b"}
    if not erwartete_zusatz_termine.issubset(alle_termin_ids):
        fehler.append("Synthetische Zweittermine s1b/s3b fehlen")

    teilnehmer = data.get("teilnehmer", [])
    if len(teilnehmer) != 33:
        fehler.append(f"Erwartet 33 Teilnehmer, gefunden {len(teilnehmer)}")
    teilnehmer_ids = {t["id"] for t in teilnehmer}
    for t in teilnehmer:
        if "schulungIds" in t or "anmeldestatus" in t:
            fehler.append(f"Teilnehmer {t['id']} hat noch altes Feld schulungIds/anmeldestatus")

    buchungen = data.get("buchungen", [])
    if len(buchungen) != 40:
        fehler.append(f"Erwartet 40 Buchungen (Summe aller alten schulungIds), gefunden {len(buchungen)}")
    buchung_ids = set()
    for b in buchungen:
        for feld in ("id", "teilnehmerId", "terminId", "anmeldestatus", "gebuchtAm"):
            if feld not in b:
                fehler.append(f"Buchung {b.get('id')} fehlt Feld '{feld}'")
        if b["id"] in buchung_ids:
            fehler.append(f"Doppelte Buchungs-ID: {b['id']}")
        buchung_ids.add(b["id"])
        if b["teilnehmerId"] not in teilnehmer_ids:
            fehler.append(f"Buchung {b['id']}: unbekannte teilnehmerId {b['teilnehmerId']}")
        if b["terminId"] not in alle_termin_ids:
            fehler.append(f"Buchung {b['id']}: unbekannte terminId {b['terminId']}")

    if fehler:
        print("FEHLER GEFUNDEN:")
        for f in fehler:
            print(" -", f)
        raise SystemExit(1)
    print("Migration verifiziert: keine Fehler.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Migration ausführen und verifizieren**

Run: `python Design/migrate_data.py && python Design/verify_migration.py`
Expected: Beide Skripte laufen ohne Fehler durch, Ausgabe endet mit „Migration verifiziert: keine Fehler."

- [ ] **Step 4: Umlaute im Ergebnis stichprobenartig prüfen (CLAUDE.md-Pflicht)**

Run: `python -c "import json; d=json.load(open('Daten/schulungsdaten.json', encoding='utf-8')); print(repr(d['kurse'][0]['beschreibung'])); print(repr(d['teilnehmer'][6]['email']))"`
Expected: Umlaute erscheinen korrekt im `repr()`-Output (z. B. `'für'`, `'paul.krüger@...'`), nicht als `�` oder kaputte Bytes.

- [ ] **Step 5: Commit**

```bash
git add Design/migrate_data.py Design/verify_migration.py Daten/schulungsdaten.json
git commit -m "feat: Datenmodell auf Kurs/Termin/Buchung migrieren"
```

---

## Task 2: State-Engine Grundgerüst (Laden/Speichern/Reset/Export/Import)

**Files:**
- Create: `Design/state-engine.js`

**Interfaces:**
- Consumes: `window.SEED_DATA` (vom Shell-Template beim Einbetten gesetzt, siehe Task 5) — Objekt mit `{kurse, teilnehmer, buchungen}` aus `Daten/schulungsdaten.json`
- Produces (globale Funktionen, von allen späteren Tasks genutzt):
  - `window.STATE` — das aktuell geladene State-Objekt `{kurse:[], teilnehmer:[], buchungen:[]}`
  - `speichereState()` — persistiert `window.STATE` nach `localStorage`, ruft danach `window.renderAll()` auf falls definiert
  - `zuruecksetzenAufBeispieldaten()` — ersetzt `window.STATE` durch eine tiefe Kopie von `window.SEED_DATA`, speichert
  - `exportiereJSON()` — löst Download von `schulungsplaner-export-<ISO-Datum>.json` aus
  - `importiereJSON(file)` — `Promise`, liest `File`, ersetzt `window.STATE`, speichert; wirft bei ungültigem JSON
  - `naechsteId(praefix, liste)` — `string`, z. B. `naechsteId('k', STATE.kurse)` → `"k9"` wenn höchste vorhandene ID `k8` ist

- [ ] **Step 1: state-engine.js schreiben**

```javascript
// Design/state-engine.js
// Zentraler State: Laden aus localStorage (Fallback: SEED_DATA), Speichern,
// Reset, Export/Import. Wird von shell-template.html vor den Seiten-Skripten
// eingebunden. window.SEED_DATA muss vorher gesetzt sein.

const STORAGE_KEY = 'schulungsplaner_state_v2';

function ladeState() {
  const roh = localStorage.getItem(STORAGE_KEY);
  if (roh) {
    try {
      return JSON.parse(roh);
    } catch (e) {
      console.warn('Gespeicherter State ungültig, verwende Beispieldaten.', e);
    }
  }
  return JSON.parse(JSON.stringify(window.SEED_DATA));
}

window.STATE = ladeState();

function speichereState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(window.STATE));
  if (typeof window.renderAll === 'function') {
    window.renderAll();
  }
}

function zuruecksetzenAufBeispieldaten() {
  if (!confirm('Wirklich alle Änderungen verwerfen und auf die Beispieldaten zurücksetzen?')) {
    return;
  }
  window.STATE = JSON.parse(JSON.stringify(window.SEED_DATA));
  speichereState();
}

function exportiereJSON() {
  const inhalt = JSON.stringify(window.STATE, null, 2);
  const blob = new Blob([inhalt], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const heute = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `schulungsplaner-export-${heute}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function importiereJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const geparst = JSON.parse(reader.result);
        if (!geparst.kurse || !geparst.teilnehmer || !geparst.buchungen) {
          throw new Error('Datei enthält nicht die erwarteten Felder (kurse/teilnehmer/buchungen).');
        }
        window.STATE = geparst;
        speichereState();
        resolve();
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, 'utf-8');
  });
}

function naechsteId(praefix, liste) {
  let hoechste = 0;
  for (const eintrag of liste) {
    const match = String(eintrag.id).match(new RegExp(`^${praefix}(\\d+)$`));
    if (match) {
      hoechste = Math.max(hoechste, parseInt(match[1], 10));
    }
  }
  return `${praefix}${hoechste + 1}`;
}
```

- [ ] **Step 2: Manuelle Verifikation vorbereiten**

Diese Datei hat noch keine eigene Seite, die sie sichtbar nutzt — die Verifikation erfolgt zusammen mit Task 5 (Einbindung in `shell-template.html`), wo geprüft wird, dass `window.STATE` beim Öffnen der App befüllt ist. Für diesen Task reicht eine Syntaxprüfung.

Run: `node -c Design/state-engine.js 2>&1 || echo "Node fehlt hier - manuelle Sichtprüfung stattdessen"`
Expected: Da auf dieser Maschine kein Node installiert ist, wird der Fallback-Text ausgegeben — in diesem Fall die Datei stattdessen per Lesen/Sichtprüfung auf offensichtliche Syntaxfehler (unbalancierte Klammern/Anführungszeichen) kontrollieren. Sobald Task 5 die Datei einbindet, bestätigt das Öffnen der Seite ohne Konsolenfehler (siehe Task 5, Step 4) die Syntax verbindlich.

- [ ] **Step 3: Commit**

```bash
git add Design/state-engine.js
git commit -m "feat: State-Engine Grundgerüst (laden/speichern/reset/export/import)"
```

---

## Task 3: CRUD-Mutatoren & abgeleitete Daten

**Files:**
- Modify: `Design/state-engine.js` (Ergänzung am Dateiende)

**Interfaces:**
- Consumes: `window.STATE`, `speichereState()`, `naechsteId()` aus Task 2
- Produces (globale Funktionen für alle Seiten-Skripte):
  - Suche: `findeKurs(kursId)` → Kurs-Objekt|`undefined`; `findeTerminMitKurs(terminId)` → `{kurs, termin}`|`undefined`
  - Kurs: `erstelleKurs(felder)` → neue `id`; `aktualisiereKurs(kursId, felder)`; `loescheKurs(kursId)`
  - Termin: `erstelleTermin(kursId, felder)` → neue `id`; `aktualisiereTermin(terminId, felder)`; `loescheTermin(terminId)`
  - Checkliste: `checklistePunktToggeln(terminId, index)`; `checklistePunktHinzufuegen(terminId, label)`; `checklistePunktEntfernen(terminId, index)`
  - Agenda: `agendaPunktHinzufuegen(kursId, punkt)`; `agendaPunktEntfernen(kursId, index)`
  - Teilnehmer/Buchung: `erstelleTeilnehmer(felder)` → neue `id`; `erstelleBuchung(felder)` → neue `id`, setzt `gebuchtAm` auf heute; `aktualisiereBuchungStatus(buchungId, neuerStatus)`; `loescheBuchung(buchungId)`
  - Abgeleitete Daten (reine Lesefunktionen, keine Persistenz): `terminAuslastung(terminId)` → `{belegt, kapazitaet, frei, prozent}`; `naechsteZweiTermine(kursId)` → `[Termin, Termin]` (bis zu 2, chronologisch ab heute, danach älteste zuerst falls keine zukünftigen mehr da sind); `buchungenFuerTermin(terminId)` → `[Buchung]`; `buchungenSortiertNeuesteZuerst()` → `[Buchung]`; `buchungshistorieFirma(firma)` → `[{titel, anzahl}]` absteigend sortiert

- [ ] **Step 1: Suchfunktionen und Kurs/Termin-CRUD anhängen**

```javascript
// -- Suche --

function findeKurs(kursId) {
  return window.STATE.kurse.find(k => k.id === kursId);
}

function findeTerminMitKurs(terminId) {
  for (const kurs of window.STATE.kurse) {
    const termin = kurs.termine.find(t => t.id === terminId);
    if (termin) return { kurs, termin };
  }
  return undefined;
}

// -- Kurs-CRUD --

function erstelleKurs(felder) {
  const id = naechsteId('k', window.STATE.kurse);
  window.STATE.kurse.push({
    id,
    titel: felder.titel,
    kategorie: felder.kategorie,
    beschreibung: felder.beschreibung || '',
    lernziele: felder.lernziele || [],
    zielgruppe: felder.zielgruppe || '',
    voraussetzungen: felder.voraussetzungen || '',
    agenda: [],
    materialien: { seminarunterlagen: [], vorlagen: [] },
    termine: [],
  });
  speichereState();
  return id;
}

function aktualisiereKurs(kursId, felder) {
  const kurs = findeKurs(kursId);
  if (!kurs) throw new Error(`Kurs ${kursId} nicht gefunden`);
  Object.assign(kurs, felder);
  speichereState();
}

function loescheKurs(kursId) {
  const kurs = findeKurs(kursId);
  if (!kurs) throw new Error(`Kurs ${kursId} nicht gefunden`);
  const terminIds = new Set(kurs.termine.map(t => t.id));
  window.STATE.buchungen = window.STATE.buchungen.filter(b => !terminIds.has(b.terminId));
  window.STATE.kurse = window.STATE.kurse.filter(k => k.id !== kursId);
  speichereState();
}

// -- Termin-CRUD --

const STANDARD_CHECKLISTE = [
  'Raum gebucht', 'Technik geprüft', 'Unterlagen gedruckt',
  'Einladungen versendet', 'Zertifikate vorbereitet',
];

function alleTermine() {
  return window.STATE.kurse.flatMap(k => k.termine);
}

function erstelleTermin(kursId, felder) {
  const kurs = findeKurs(kursId);
  if (!kurs) throw new Error(`Kurs ${kursId} nicht gefunden`);
  const id = naechsteId('t', alleTermine());
  kurs.termine.push({
    id,
    datum: felder.datum,
    trainer: felder.trainer,
    format: felder.format,
    ort: felder.ort,
    kapazitaet: felder.kapazitaet,
    status: felder.status || 'geplant',
    checkliste: STANDARD_CHECKLISTE.map(label => ({ label, erledigt: false })),
  });
  speichereState();
  return id;
}

function aktualisiereTermin(terminId, felder) {
  const gefunden = findeTerminMitKurs(terminId);
  if (!gefunden) throw new Error(`Termin ${terminId} nicht gefunden`);
  Object.assign(gefunden.termin, felder);
  speichereState();
}

function loescheTermin(terminId) {
  const gefunden = findeTerminMitKurs(terminId);
  if (!gefunden) throw new Error(`Termin ${terminId} nicht gefunden`);
  gefunden.kurs.termine = gefunden.kurs.termine.filter(t => t.id !== terminId);
  window.STATE.buchungen = window.STATE.buchungen.filter(b => b.terminId !== terminId);
  speichereState();
}
```

- [ ] **Step 2: Checkliste, Agenda, Teilnehmer/Buchung-CRUD anhängen**

```javascript
// -- Checkliste (pro Termin) --

function checklistePunktToggeln(terminId, index) {
  const gefunden = findeTerminMitKurs(terminId);
  if (!gefunden) throw new Error(`Termin ${terminId} nicht gefunden`);
  const punkt = gefunden.termin.checkliste[index];
  if (!punkt) throw new Error(`Checklistenpunkt ${index} nicht gefunden`);
  punkt.erledigt = !punkt.erledigt;
  speichereState();
}

function checklistePunktHinzufuegen(terminId, label) {
  const gefunden = findeTerminMitKurs(terminId);
  if (!gefunden) throw new Error(`Termin ${terminId} nicht gefunden`);
  gefunden.termin.checkliste.push({ label, erledigt: false });
  speichereState();
}

function checklistePunktEntfernen(terminId, index) {
  const gefunden = findeTerminMitKurs(terminId);
  if (!gefunden) throw new Error(`Termin ${terminId} nicht gefunden`);
  gefunden.termin.checkliste.splice(index, 1);
  speichereState();
}

// -- Agenda (kursweit) --

function agendaPunktHinzufuegen(kursId, punkt) {
  const kurs = findeKurs(kursId);
  if (!kurs) throw new Error(`Kurs ${kursId} nicht gefunden`);
  kurs.agenda.push(punkt);
  speichereState();
}

function agendaPunktEntfernen(kursId, index) {
  const kurs = findeKurs(kursId);
  if (!kurs) throw new Error(`Kurs ${kursId} nicht gefunden`);
  kurs.agenda.splice(index, 1);
  speichereState();
}

// -- Teilnehmer & Buchungen --

function erstelleTeilnehmer(felder) {
  const id = naechsteId('t', window.STATE.teilnehmer);
  window.STATE.teilnehmer.push({
    id,
    name: felder.name,
    firma: felder.firma,
    email: felder.email,
    bestandskunde: !!felder.bestandskunde,
  });
  speichereState();
  return id;
}

function erstelleBuchung(felder) {
  const id = naechsteId('b', window.STATE.buchungen);
  window.STATE.buchungen.push({
    id,
    teilnehmerId: felder.teilnehmerId,
    terminId: felder.terminId,
    anmeldestatus: felder.anmeldestatus || 'angemeldet',
    gebuchtAm: new Date().toISOString().slice(0, 10),
  });
  speichereState();
  return id;
}

function aktualisiereBuchungStatus(buchungId, neuerStatus) {
  const buchung = window.STATE.buchungen.find(b => b.id === buchungId);
  if (!buchung) throw new Error(`Buchung ${buchungId} nicht gefunden`);
  buchung.anmeldestatus = neuerStatus;
  speichereState();
}

function loescheBuchung(buchungId) {
  window.STATE.buchungen = window.STATE.buchungen.filter(b => b.id !== buchungId);
  speichereState();
}
```

- [ ] **Step 3: Abgeleitete Daten (reine Lesefunktionen) anhängen**

```javascript
// -- Abgeleitete Daten --

function terminAuslastung(terminId) {
  const gefunden = findeTerminMitKurs(terminId);
  if (!gefunden) throw new Error(`Termin ${terminId} nicht gefunden`);
  const belegt = window.STATE.buchungen.filter(
    b => b.terminId === terminId && b.anmeldestatus !== 'abgesagt'
  ).length;
  const kapazitaet = gefunden.termin.kapazitaet;
  return {
    belegt,
    kapazitaet,
    frei: Math.max(0, kapazitaet - belegt),
    prozent: kapazitaet > 0 ? Math.round((belegt / kapazitaet) * 100) : 0,
  };
}

function naechsteZweiTermine(kursId) {
  const kurs = findeKurs(kursId);
  if (!kurs) throw new Error(`Kurs ${kursId} nicht gefunden`);
  const heute = new Date().toISOString().slice(0, 10);
  const sortiert = [...kurs.termine].sort((a, b) => a.datum.localeCompare(b.datum));
  const kommende = sortiert.filter(t => t.datum >= heute);
  const vergangene = sortiert.filter(t => t.datum < heute).reverse();
  return [...kommende, ...vergangene].slice(0, 2);
}

function buchungenFuerTermin(terminId) {
  return window.STATE.buchungen.filter(b => b.terminId === terminId);
}

function buchungenSortiertNeuesteZuerst() {
  return [...window.STATE.buchungen].sort((a, b) => b.gebuchtAm.localeCompare(a.gebuchtAm));
}

function buchungshistorieFirma(firma) {
  const zaehlerNachTitel = {};
  for (const buchung of window.STATE.buchungen) {
    const teilnehmer = window.STATE.teilnehmer.find(t => t.id === buchung.teilnehmerId);
    if (!teilnehmer || teilnehmer.firma !== firma) continue;
    const gefunden = findeTerminMitKurs(buchung.terminId);
    if (!gefunden) continue;
    const titel = gefunden.kurs.titel;
    zaehlerNachTitel[titel] = (zaehlerNachTitel[titel] || 0) + 1;
  }
  return Object.entries(zaehlerNachTitel)
    .map(([titel, anzahl]) => ({ titel, anzahl }))
    .sort((a, b) => b.anzahl - a.anzahl);
}
```

- [ ] **Step 4: Manuelle Verifikation via Browser-Konsole**

Diese Datei wird zusammen mit Task 5 in `shell-template.html` eingebunden. Sobald das geschieht (siehe Task 5), in der Browser-Konsole (Claude Browser Pane, `javascript_tool`) folgendes ausführen:

```javascript
erstelleKurs({titel:'Test-Kurs', kategorie:'Test'});
naechsteId('k', window.STATE.kurse) // sollte 'k10' liefern, wenn 'Test-Kurs' k9 bekommen hat
terminAuslastung(window.STATE.kurse[0].termine[0].id) // sollte {belegt, kapazitaet, frei, prozent} liefern
zuruecksetzenAufBeispieldaten() // danach ist der Test-Kurs wieder weg
```

Expected: Keine Fehler in der Konsole, Rückgabewerte entsprechen den beschriebenen Formen, nach `zuruecksetzenAufBeispieldaten()` ist `window.STATE.kurse.length` wieder 8.

- [ ] **Step 5: Commit**

```bash
git add Design/state-engine.js
git commit -m "feat: CRUD-Mutatoren und abgeleitete Daten in State-Engine"
```

---

## Task 4: Datei-Ablage für Materialien (IndexedDB)

**Files:**
- Create: `Design/file-store.js`
- Modify: `Design/state-engine.js` (zwei weitere Mutatoren anhängen)

**Interfaces:**
- Consumes: `findeKurs(kursId)`, `speichereState()` aus Task 2/3
- Produces:
  - `materialHinzufuegen(kursId, bereich, referenz)` — `bereich` ist `'seminarunterlagen'` oder `'vorlagen'`, `referenz = {id, name, typ, groesse}`; pusht in `kurs.materialien[bereich]`
  - `materialEntfernen(kursId, bereich, dateiId)` — entfernt die Referenz
  - `speichereDatei(datei, {kursId, bereich})` → `Promise<string>` (Datei-`id`) — `datei` ist ein `File`-Objekt aus einem `<input type="file">`; legt den Blob in IndexedDB ab und ruft `materialHinzufuegen` auf
  - `ladeDateiBlob(dateiId)` → `Promise<Blob>`
  - `loescheDateiUndReferenz(dateiId, kursId, bereich)` → `Promise<void>` — löscht Blob aus IndexedDB und Referenz aus `kurs.materialien[bereich]`
  - `herunterladeDatei(dateiId, dateiName)` → `Promise<void>` — löst Browser-Download aus

- [ ] **Step 1: Mutatoren in state-engine.js anhängen**

```javascript
// -- Materialien-Referenzen (Datei-Inhalt liegt in IndexedDB, siehe file-store.js) --

function materialHinzufuegen(kursId, bereich, referenz) {
  const kurs = findeKurs(kursId);
  if (!kurs) throw new Error(`Kurs ${kursId} nicht gefunden`);
  kurs.materialien[bereich].push(referenz);
  speichereState();
}

function materialEntfernen(kursId, bereich, dateiId) {
  const kurs = findeKurs(kursId);
  if (!kurs) throw new Error(`Kurs ${kursId} nicht gefunden`);
  kurs.materialien[bereich] = kurs.materialien[bereich].filter(d => d.id !== dateiId);
  speichereState();
}
```

- [ ] **Step 2: file-store.js schreiben**

```javascript
// Design/file-store.js
// IndexedDB-Speicher fuer hochgeladene Materialien-Dateien. Referenzen
// (Name/Typ/Groesse) leben im normalen State (localStorage), der Blob-Inhalt
// liegt separat in IndexedDB, da localStorage zu klein fuer Dateien ist.

const DATEI_DB_NAME = 'schulungsplaner_dateien';
const DATEI_STORE = 'dateien';

function oeffneDateiDB() {
  return new Promise((resolve, reject) => {
    const anfrage = indexedDB.open(DATEI_DB_NAME, 1);
    anfrage.onupgradeneeded = () => {
      anfrage.result.createObjectStore(DATEI_STORE, { keyPath: 'id' });
    };
    anfrage.onsuccess = () => resolve(anfrage.result);
    anfrage.onerror = () => reject(anfrage.error);
  });
}

function neueDateiId() {
  return `d${Date.now()}${Math.floor(Math.random() * 10000)}`;
}

async function speichereDatei(datei, { kursId, bereich }) {
  const db = await oeffneDateiDB();
  const id = neueDateiId();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DATEI_STORE, 'readwrite');
    tx.objectStore(DATEI_STORE).put({ id, blob: datei });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  materialHinzufuegen(kursId, bereich, {
    id, name: datei.name, typ: datei.type || 'application/octet-stream', groesse: datei.size,
  });
  return id;
}

async function ladeDateiBlob(dateiId) {
  const db = await oeffneDateiDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DATEI_STORE, 'readonly');
    const anfrage = tx.objectStore(DATEI_STORE).get(dateiId);
    anfrage.onsuccess = () => resolve(anfrage.result ? anfrage.result.blob : null);
    anfrage.onerror = () => reject(anfrage.error);
  });
}

async function loescheDateiUndReferenz(dateiId, kursId, bereich) {
  const db = await oeffneDateiDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DATEI_STORE, 'readwrite');
    tx.objectStore(DATEI_STORE).delete(dateiId);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  materialEntfernen(kursId, bereich, dateiId);
}

async function herunterladeDatei(dateiId, dateiName) {
  const blob = await ladeDateiBlob(dateiId);
  if (!blob) {
    alert('Datei wurde nicht gefunden (evtl. nach einem Import ohne Dateien).');
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = dateiName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 3: Manuelle Verifikation via Browser-Konsole**

Wird zusammen mit Task 5 eingebunden. Danach in der Browser-Konsole:

```javascript
const testDatei = new File(['Testinhalt'], 'test.txt', { type: 'text/plain' });
const kursId = window.STATE.kurse[0].id;
speichereDatei(testDatei, { kursId, bereich: 'vorlagen' }).then(id => {
  console.log('gespeichert als', id);
  return ladeDateiBlob(id);
}).then(blob => console.log('geladen, Größe:', blob.size));
```

Expected: Keine Fehler, `geladen, Größe: 10` (Länge von "Testinhalt") wird geloggt, und `window.STATE.kurse[0].materialien.vorlagen` enthält einen neuen Eintrag mit `name: 'test.txt'`.

- [ ] **Step 4: Commit**

```bash
git add Design/file-store.js Design/state-engine.js
git commit -m "feat: IndexedDB-Dateiablage für Materialien"
```

---

## Task 5: Shell-Template umbauen (3-Punkte-Sidebar, JS-Einbindung, Dialog-Infrastruktur) + assemble.py anpassen

**Files:**
- Create: `Design/ui-helpers.js`
- Modify: `Design/shell-template.html`
- Modify: `Design/assemble.py`

**Interfaces:**
- Consumes: `Design/state-engine.js`, `Design/file-store.js` (Task 2–4), `Daten/schulungsdaten.json` (Task 1)
- Produces:
  - `oeffneDialog(innerHtml)` / `schliesseDialog()` — globale Dialog-Helfer, von allen Seiten-Skripten (Task 7–10) für Formulare genutzt
  - `formularWerte(formElement)` → `object` — liest ein `<form>` per `FormData` in ein einfaches Objekt
  - `formatiereDatum(isoDatum)` → `string` — `"2026-08-12"` → `"12.08.2026"`, von allen Seiten-Skripten für die Anzeige genutzt
  - `statusBadgeHtml(terminStatus)` → `string` (HTML) — Badge für `geplant`/`laufend`/`abgeschlossen`
  - `anmeldestatusBadgeHtml(anmeldestatus)` → `string` (HTML) — Badge für `angemeldet`/`bestätigt`/`abgesagt`
  - `window.renderAll()` — Dispatcher, ruft `renderUebersicht()`, `renderSchulungen()`, `renderSchulungdetail()`, `renderBuchungen()` auf (diese vier Funktionen werden in Task 7–10 definiert; `renderAll` muss defensiv sein — `typeof fn === 'function'` prüfen, da beim erstmaligen Testen von Task 5 diese Funktionen noch nicht existieren)
  - `showPage(id)` / `showSchulungDetail(terminId)` — wie im bisherigen Prototyp, aber `showSchulungDetail` nimmt jetzt eine **Termin-ID** entgegen (nicht mehr Kurs-ID)
  - `{{CORE_JS}}`-Platzhalter in `shell-template.html`, befüllt von `assemble.py` mit `state-engine.js` + `file-store.js` + `ui-helpers.js`
  - `{{PAGE_JS}}`-Platzhalter, befüllt mit den vier Seiten-Skripten aus Task 7–10 (existieren zu diesem Zeitpunkt noch nicht — `assemble.py` muss fehlende Dateien tolerant als leeren String behandeln, analog zum bestehenden `read(path, default="")`-Muster)

- [ ] **Step 1: ui-helpers.js schreiben**

```javascript
// Design/ui-helpers.js
// Generische UI-Helfer: Dialog-Overlay oeffnen/schliessen, Formular auslesen.
// Destruktive Bestaetigungen (Loeschen) laufen bewusst ueber das native
// confirm(), nicht ueber einen eigenen Dialog - konsistent mit
// zuruecksetzenAufBeispieldaten() aus state-engine.js.

function oeffneDialog(innerHtml) {
  const overlay = document.getElementById('dialog-overlay');
  const container = document.getElementById('dialog-container');
  container.innerHTML = innerHtml;
  overlay.style.display = 'flex';
}

function schliesseDialog() {
  const overlay = document.getElementById('dialog-overlay');
  document.getElementById('dialog-container').innerHTML = '';
  overlay.style.display = 'none';
}

function formularWerte(formElement) {
  return Object.fromEntries(new FormData(formElement).entries());
}

function formatiereDatum(isoDatum) {
  const [jahr, monat, tag] = isoDatum.split('-');
  return `${tag}.${monat}.${jahr}`;
}

// Einheitliche Status-Farb-Zuordnung app-weit (siehe design-spec.md):
// Gruen=bestaetigt/aktiv, Amber=angemeldet/geplant, Grau=abgeschlossen,
// Rot=abgesagt, Indigo=ausgebucht/voll (Indigo wird direkt an den
// Aufrufstellen mit terminAuslastung() gesetzt, nicht hier).

function statusBadgeHtml(status) {
  const zuordnung = {
    geplant: ['badge-amber', 'geplant'],
    laufend: ['badge-green', 'laufend'],
    abgeschlossen: ['badge-gray', 'abgeschlossen'],
  };
  const [klasse, label] = zuordnung[status] || ['badge-gray', status];
  return `<span class="badge ${klasse}">${label}</span>`;
}

function anmeldestatusBadgeHtml(status) {
  const zuordnung = {
    angemeldet: ['badge-amber', 'angemeldet'],
    bestätigt: ['badge-green', 'bestätigt'],
    abgesagt: ['badge-red', 'abgesagt'],
  };
  const [klasse, label] = zuordnung[status] || ['badge-gray', status];
  return `<span class="badge ${klasse}">${label}</span>`;
}

document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('dialog-overlay');
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) schliesseDialog();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') schliesseDialog();
  });
});
```

- [ ] **Step 2: shell-template.html überarbeiten**

Vollständiger neuer Inhalt (ersetzt die bisherige Datei komplett):

```html
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<title>Schulungsplaner – Dashboard</title>
<style>
{{BASE_CSS}}

/* ---- Seitenspezifisches CSS (von den Seiten-Fragmenten, optional) ---- */
{{PAGE_CSS}}

/* ---- Aussenrahmen fuer die Vorschau (die App selbst ist app-window) ---- */
body { display: flex; align-items: center; justify-content: center; padding: 18px; background: #e4e8f0; min-height: 100vh; }
.app-window { width: 1360px; max-width: 100%; height: 860px; }
</style>
</head>
<body>

<div class="app-window">
  <div class="titlebar">
    <div class="traffic-dots">
      <span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span>
    </div>
    <img class="logo" src="data:image/svg+xml;base64,{{LOGO_B64}}" alt="tribeta" />
    <span class="app-name">Schulungsplaner</span>
  </div>
  <div class="app-body">
    <nav class="sidebar">
      <div class="sidebar-nav">
        <button class="sidebar-nav-item active" data-nav="uebersicht" onclick="showPage('uebersicht')">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
          Übersicht
        </button>
        <button class="sidebar-nav-item" data-nav="schulungen" onclick="showPage('schulungen')">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H20v15H5.5A2.5 2.5 0 0 0 3 20.5z"/><path d="M3 5.5A2.5 2.5 0 0 0 5.5 8H20"/></svg>
          Schulungen
        </button>
        <button class="sidebar-nav-item" data-nav="buchungen" onclick="showPage('buchungen')">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5A1.5 1.5 0 0 1 7.5 2h9A1.5 1.5 0 0 1 18 3.5V21l-6-4-6 4z"/></svg>
          Buchungen
        </button>
      </div>
      <div class="sidebar-footer">
        <div class="sidebar-tools">
          <button class="sidebar-tool-btn" onclick="exportiereJSON()">Exportieren</button>
          <button class="sidebar-tool-btn" onclick="document.getElementById('import-input').click()">Importieren</button>
          <button class="sidebar-tool-btn" onclick="zuruecksetzenAufBeispieldaten()">Zurücksetzen</button>
          <input type="file" id="import-input" accept="application/json" style="display:none" />
        </div>
        Schulungsplaner<br/>Lokal gespeichert im Browser
      </div>
    </nav>

    <main class="main">
      <section id="page-uebersicht" class="page active">
{{PAGE_UEBERSICHT}}
      </section>

      <section id="page-schulungen" class="page">
{{PAGE_SCHULUNGEN}}
      </section>

      <section id="page-schulungdetail" class="page">
{{PAGE_SCHULUNGDETAIL}}
      </section>

      <section id="page-buchungen" class="page">
{{PAGE_BUCHUNGEN}}
      </section>
    </main>
  </div>
</div>

<div id="dialog-overlay" class="dialog-overlay" style="display:none">
  <div id="dialog-container" class="dialog"></div>
</div>

<script>
window.SEED_DATA = {{DATA_JSON}};
</script>
<script>
{{CORE_JS}}
</script>
<script>
{{PAGE_JS}}
</script>
<script>
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  document.querySelectorAll('.sidebar-nav-item').forEach(b => b.classList.remove('active'));
  var navBtn = document.querySelector('.sidebar-nav-item[data-nav="' + id + '"]');
  if (navBtn) navBtn.classList.add('active');
  document.querySelector('.main').scrollTop = 0;
}

// Von der Schulungen-Liste aufgerufen: navigiert zur Detailseite und rendert
// den passenden Termin (terminId, nicht kursId).
function showSchulungDetail(terminId) {
  window.AKTUELLER_TERMIN_ID = terminId;
  showPage('schulungdetail');
  if (typeof renderSchulungdetail === 'function') {
    renderSchulungdetail(terminId);
  }
}

document.getElementById('import-input').addEventListener('change', (ev) => {
  const datei = ev.target.files[0];
  if (!datei) return;
  importiereJSON(datei)
    .then(() => alert('Import erfolgreich.'))
    .catch(err => alert('Import fehlgeschlagen: ' + err.message));
  ev.target.value = '';
});

function renderAll() {
  if (typeof renderUebersicht === 'function') renderUebersicht();
  if (typeof renderSchulungen === 'function') renderSchulungen();
  if (typeof renderSchulungdetail === 'function') renderSchulungdetail(window.AKTUELLER_TERMIN_ID);
  if (typeof renderBuchungen === 'function') renderBuchungen();
}
window.renderAll = renderAll;

renderAll();

// Deep-Link ueber URL-Hash, z.B. index.html#schulungen oder index.html#detail-s1
(function () {
  var hash = location.hash.replace('#', '');
  if (!hash) return;
  if (hash.indexOf('detail-') === 0) {
    showSchulungDetail(hash.replace('detail-', ''));
  } else if (document.getElementById('page-' + hash)) {
    showPage(hash);
  }
})();
</script>
</body>
</html>
```

- [ ] **Step 3: assemble.py anpassen**

```python
# Design/assemble.py
# -*- coding: utf-8 -*-
"""Fuegt Shell-Template + gemeinsames CSS + JS-Module + Seiten-Fragmente +
Beispieldaten zu einer einzigen, eigenstaendigen index.html zusammen."""
import json
from pathlib import Path

BASE = Path(__file__).parent
FRAGMENTS = BASE / "fragments"
OUT = BASE.parent / "Berichte" / "index.html"

def read(path, default=""):
    p = Path(path)
    return p.read_text(encoding="utf-8") if p.exists() else default

template = read(BASE / "shell-template.html")
base_css = read(BASE / "styles.css")
logo_b64 = read(BASE / "logo-invers.b64.txt").strip()

page_css_parts = []
for name in ["page-uebersicht", "page-schulungen", "page-schulungdetail", "page-buchungen"]:
    css = read(FRAGMENTS / f"{name}.css")
    if css.strip():
        page_css_parts.append(f"/* ---- {name}.css ---- */\n{css}")
page_css = "\n\n".join(page_css_parts)

core_js_parts = []
for name in ["state-engine", "file-store", "ui-helpers"]:
    js = read(BASE / f"{name}.js")
    core_js_parts.append(f"// ---- {name}.js ----\n{js}")
core_js = "\n\n".join(core_js_parts)

page_js_parts = []
for name in ["page-uebersicht", "page-schulungen", "page-schulungdetail", "page-buchungen"]:
    js = read(FRAGMENTS / f"{name}.js")
    if js.strip():
        page_js_parts.append(f"// ---- {name}.js ----\n{js}")
page_js = "\n\n".join(page_js_parts)

pages = {}
for key, fname in [
    ("PAGE_UEBERSICHT", "page-uebersicht.html"),
    ("PAGE_SCHULUNGEN", "page-schulungen.html"),
    ("PAGE_SCHULUNGDETAIL", "page-schulungdetail.html"),
    ("PAGE_BUCHUNGEN", "page-buchungen.html"),
]:
    pages[key] = read(FRAGMENTS / fname, f"<p>FEHLT: {fname}</p>")

data_json_path = BASE.parent / "Daten" / "schulungsdaten.json"
data = json.loads(data_json_path.read_text(encoding="utf-8"))
data_json_str = json.dumps(data, ensure_ascii=False)

html = template
html = html.replace("{{BASE_CSS}}", base_css)
html = html.replace("{{PAGE_CSS}}", page_css)
html = html.replace("{{LOGO_B64}}", logo_b64)
html = html.replace("{{CORE_JS}}", core_js)
html = html.replace("{{PAGE_JS}}", page_js)
html = html.replace("{{DATA_JSON}}", data_json_str)
for key, content in pages.items():
    html = html.replace("{{" + key + "}}", content)

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(html, encoding="utf-8")
print("Geschrieben:", OUT, len(html), "Zeichen")
```

- [ ] **Step 4: Alte Fragmente entfernen, Build ausführen, im Browser prüfen**

Die Seiten-Fragmente `page-teilnehmer.html`, `page-teilnehmer.css`, `page-kunden.html`, `page-kunden.css` werden nicht mehr eingebunden (siehe neue Seitenliste in `assemble.py`) und durch `page-buchungen.*` ersetzt (Task 10). Da diese Datei zu diesem Zeitpunkt noch nicht existiert, legt dieser Step Platzhalter an, damit der Build nicht mit „FEHLT" sichtbar bricht:

Run: `rm "Design/fragments/page-teilnehmer.html" "Design/fragments/page-teilnehmer.css" "Design/fragments/page-kunden.html" "Design/fragments/page-kunden.css"`

Run: `printf '<div class="page-header"><h1>Buchungen</h1><p class="subtitle">Wird in Task 10 gebaut.</p></div>' > "Design/fragments/page-buchungen.html"`

Run: `python Design/assemble.py`
Expected: Ausgabe `Geschrieben: ...Berichte\index.html ... Zeichen` ohne Fehler.

Im Claude Browser Pane öffnen (`file:///…/Berichte/index.html`), dann:
- Sidebar zeigt genau 3 Punkte: Übersicht, Schulungen, Buchungen — Klick auf jeden wechselt sichtbar die Seite
- Browser-Konsole (`read_console_messages`, `onlyErrors: true`) zeigt keine Fehler
- `javascript_tool` ausführen: `window.STATE.kurse.length` → erwartet `8` (bzw. mehr, falls vorherige manuelle Tests aus Task 3/4 noch im `localStorage` dieses Browserprofils stecken — in dem Fall vorher `localStorage.clear()` ausführen und Seite neu laden)
- Klick auf „Exportieren" löst einen Datei-Download aus (im Browser-Pane als Download-Ereignis sichtbar oder zumindest ohne Konsolenfehler)

- [ ] **Step 5: Commit**

```bash
git add Design/ui-helpers.js Design/shell-template.html Design/assemble.py Design/fragments/page-buchungen.html
git rm Design/fragments/page-teilnehmer.html Design/fragments/page-teilnehmer.css Design/fragments/page-kunden.html Design/fragments/page-kunden.css
git commit -m "refactor: Shell-Template auf 3-Punkte-Sidebar + JS-Module + Dialog-Infrastruktur umgebaut"
```

---

## Task 6: Design-System erweitern (styles.css)

**Files:**
- Modify: `Design/styles.css` (Ergänzung am Dateiende, bestehende Regeln bleiben unverändert)

**Interfaces:**
- Produces: die folgenden CSS-Klassen, verbindlich für Task 7–10 (keine Seite darf eigene abweichende Varianten dieser Muster erfinden — das war genau das Problem in v1):
  `.page-header` (jetzt Flex-Row mit `.page-header-text` + optional `.page-header-actions`), `.sidebar-tools`/`.sidebar-tool-btn`, `.dialog-overlay`/`.dialog`/`.dialog-head`/`.dialog-body`/`.dialog-foot`/`.field`/`.field-row2`, `.detail-layout`/`.detail-nav`/`.detail-main`, `.agenda-item`/`.agenda-time`/`.agenda-title`/`.agenda-desc`, `.check-row`/`.check-box`/`.check-box.done`, `.mat-group-label`/`.mat-row`/`.mat-icon`/`.mat-name`/`.mat-sub`/`.mat-actions`, `.goal-list`, `.pill`/`.pill-row`, `.chip-count`, `.badge-indigo`, `.expand-row`/`.expand-toggle`/`.expand-content`, `.termin-pair`/`.termin-col`, `table.data-table.fixed-rows`, `.truncate`, `.buchung-neu`, `.crumb`, `.uebersicht-grid`, `.btn-ghost-red`

- [ ] **Step 1: CSS-Ergänzungen anhängen**

```css

/* ========================================================================
   v2-Ergaenzungen: Kurs/Termin/Buchung-Umbau. Verbindliche Klassen fuer
   alle Seiten-Fragmente (page-uebersicht/-schulungen/-schulungdetail/
   -buchungen) - keine seitenspezifischen Abweichungen dieser Muster.
   ======================================================================== */

/* Seitenkopf mit optionaler primaerer Aktion rechts */
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 22px; }
.page-header-text h1 { font-size: 21px; font-weight: 700; margin: 0 0 4px 0; }
.page-header-text .subtitle { font-size: 13px; color: var(--muted); margin: 0; }
.page-header-actions { display: flex; gap: 8px; flex: none; }

/* Sidebar Werkzeuge (Export/Import/Reset) */
.sidebar-tools { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.sidebar-tool-btn {
  font-family: var(--font-display); font-size: 11.5px; font-weight: 600;
  color: #b8bfd6; background: transparent; border: none; text-align: left;
  padding: 4px 2px; border-radius: 6px; cursor: pointer;
}
.sidebar-tool-btn:hover { color: #fff; }

/* Zurueck-Link auf Detailseiten */
.crumb { font-size: 12.5px; color: var(--indigo-deep); font-weight: 600; font-family: var(--font-display); margin-bottom: 14px; cursor: pointer; background: none; border: none; padding: 0; }

/* Destruktive Sekundaer-Aktion (Loeschen-Buttons) */
.btn-ghost-red { color: var(--status-red-fg); border-color: #F3D4D1; }

/* Dialoge (Formulare: Neuer Kurs/Termin/Teilnehmer/Buchung) */
.dialog-overlay { position: fixed; inset: 0; background: rgba(10,16,40,0.45); align-items: center; justify-content: center; z-index: 100; }
.dialog { width: 480px; max-width: calc(100vw - 40px); background: #fff; border-radius: var(--radius-lg); box-shadow: var(--shadow-pop); overflow: hidden; }
.dialog-head { padding: 18px 22px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; }
.dialog-head h3 { margin: 0; font-size: 15px; }
.dialog-close { color: var(--muted2); font-size: 18px; cursor: pointer; background: none; border: none; }
.dialog-body { padding: 20px 22px; display: flex; flex-direction: column; gap: 14px; max-height: 60vh; overflow-y: auto; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.field label { font-family: var(--font-display); font-size: 11.5px; font-weight: 600; color: var(--muted); }
.field input, .field select, .field textarea {
  font-family: var(--font-body); font-size: 13px; padding: 9px 11px;
  border: 1px solid var(--line-strong); border-radius: 8px; color: var(--ink); background: #fff;
}
.dialog-foot { padding: 16px 22px; border-top: 1px solid var(--line); display: flex; justify-content: flex-end; gap: 8px; }

/* Schulungsdetail: Sprungmarken-Navigation (Layout-Option B) */
.detail-layout { display: flex; gap: 24px; align-items: flex-start; }
.detail-nav { width: 168px; flex: none; position: sticky; top: 0; display: flex; flex-direction: column; gap: 2px; }
.detail-nav a { font-family: var(--font-display); font-size: 12.5px; font-weight: 600; color: var(--muted); text-decoration: none; padding: 8px 10px; border-radius: 8px; border-left: 2px solid transparent; cursor: pointer; }
.detail-nav a.active { color: var(--ink); background: var(--card-2); border-left-color: var(--teal-deep); }
.detail-main { flex: 1; min-width: 0; }

/* Agenda */
.agenda-item { display: flex; gap: 14px; padding: 12px 0; border-bottom: 1px solid var(--line); }
.agenda-item:last-child { border-bottom: none; }
.agenda-time { font-family: var(--font-display); font-size: 12.5px; font-weight: 700; color: var(--teal-deep); width: 92px; flex: none; }
.agenda-title { font-weight: 600; color: var(--ink); font-size: 13.5px; margin-bottom: 2px; }
.agenda-desc { font-size: 12.5px; color: var(--muted); }

/* Lernziele */
.goal-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 9px; }
.goal-list li { display: flex; gap: 9px; font-size: 13px; align-items: flex-start; }
.goal-list li::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--indigo-deep); margin-top: 6px; flex: none; }
.pill-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.pill { font-size: 11.5px; font-family: var(--font-display); font-weight: 600; background: var(--card-2); border: 1px solid var(--line); padding: 4px 10px; border-radius: 8px; color: var(--text); }

/* Materialien */
.mat-group-label { font-family: var(--font-display); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); margin: 4px 0 10px 0; }
.mat-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); }
.mat-row:last-child { border-bottom: none; }
.mat-icon { width: 34px; height: 34px; border-radius: 9px; background: var(--card-2); display: flex; align-items: center; justify-content: center; flex: none; font-size: 14px; }
.mat-name { font-weight: 600; color: var(--ink); font-size: 13px; }
.mat-sub { font-size: 11.5px; color: var(--muted2); }
.mat-actions { margin-left: auto; display: flex; gap: 6px; }

/* Checkliste */
.check-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--line); font-size: 13px; }
.check-row:last-child { border-bottom: none; }
.check-box { width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid var(--line-strong); flex: none; display: flex; align-items: center; justify-content: center; cursor: pointer; background: none; padding: 0; }
.check-box.done { background: var(--teal-deep); border-color: var(--teal-deep); color: #fff; font-size: 12px; }
.check-row.done .lbl { color: var(--muted2); text-decoration: line-through; }

/* Status: ausgebucht/voll (Design-Bereinigung, einheitliche Zuordnung) */
.badge-indigo { background: #ECEEFF; color: var(--indigo-deep); }

/* Ausklapp-Zeilen (Uebersicht-Kurszeilen, Buchungs-Kundenhistorie) */
.expand-row { cursor: pointer; }
.expand-toggle { display: inline-block; transition: transform 0.15s ease; margin-right: 6px; color: var(--muted2); }
.expand-toggle.open { transform: rotate(90deg); }
.expand-content { display: none; padding: 10px 14px 14px 14px; background: var(--card-2); border-top: 1px solid var(--line); }
.expand-content.open { display: block; }

/* Uebersicht: zwei Termine nebeneinander je Kurs */
.termin-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.termin-col { padding: 12px 14px; background: var(--card-2); border-radius: var(--radius-md); }
.termin-col-label { font-family: var(--font-display); font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .3px; color: var(--muted); margin-bottom: 6px; }

/* Tabellen: feste Zeilenhoehe + Textkuerzung (Design-Bereinigung) */
table.data-table.fixed-rows tbody tr { height: 46px; }
.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 1px; }

/* Buchungen: neue/kuerzliche Buchung hervorheben */
.buchung-neu { box-shadow: inset 3px 0 0 var(--teal-deep); }

/* Uebersicht: zwei Spalten, beide mit gedeckelter Hoehe + eigenem Scroll,
   damit die Spalten nie unterschiedlich hoch "auslaufen" (v1-Problem) */
.uebersicht-grid { display: grid; grid-template-columns: 1.6fr 1fr; gap: 20px; align-items: start; }
.uebersicht-grid .card { max-height: 560px; overflow-y: auto; }
```

- [ ] **Step 2: Im Browser sichtprüfen**

Build ausführen (`python Design/assemble.py`) und `Berichte/index.html` im Claude Browser Pane öffnen. Da die Seiten diese Klassen erst ab Task 7–10 tatsächlich verwenden, reicht für diesen Task eine Konsolenprüfung, dass keine CSS-Syntaxfehler das restliche Stylesheet brechen:

Run (Browser-Konsole via `javascript_tool`): `getComputedStyle(document.querySelector('.sidebar')).width`
Expected: `"232px"` — bestätigt, dass die bereits bestehenden Regeln (vor der Ergänzung) weiterhin korrekt greifen und das Stylesheet nicht durch einen Tippfehler in der Ergänzung unbrauchbar wurde.

- [ ] **Step 3: Commit**

```bash
git add Design/styles.css
git commit -m "feat: Design-System um Dialog/Detail/Agenda/Checkliste/Materialien-Klassen erweitern"
```

---

## Task 7: Seite Übersicht (Navigator)

**Files:**
- Modify: `Design/fragments/page-uebersicht.html` (kompletter Neuinhalt)
- Create: `Design/fragments/page-uebersicht.js`

**Interfaces:**
- Consumes: `naechsteZweiTermine(kursId)`, `terminAuslastung(terminId)`, `buchungenFuerTermin(terminId)`, `formatiereDatum(iso)`, `window.STATE` (Task 2/3/5)
- Produces: `renderUebersicht()` — liest `#uebersicht-kursliste` und `#uebersicht-naechste-termine` neu; wird von `renderAll()` (Task 5) aufgerufen

- [ ] **Step 1: page-uebersicht.html schreiben**

```html
<div class="page-header">
  <div class="page-header-text">
    <h1>Übersicht</h1>
    <p class="subtitle">Auslastung je Kurs und anstehende Termine auf einen Blick.</p>
  </div>
</div>

<div class="uebersicht-grid">
  <div class="card" style="padding:18px 22px;">
    <div class="section-title">Auslastung je Kurs</div>
    <div id="uebersicht-kursliste"></div>
  </div>
  <div class="card" style="padding:18px 22px;">
    <div class="section-title">Nächste anstehende Termine</div>
    <div id="uebersicht-naechste-termine"></div>
  </div>
</div>
```

- [ ] **Step 2: page-uebersicht.js schreiben**

```javascript
// Design/fragments/page-uebersicht.js

function uebersichtTerminSpalte(termin) {
  const a = terminAuslastung(termin.id);
  const badge = a.belegt >= a.kapazitaet
    ? '<span class="badge badge-indigo">Ausgebucht</span>'
    : `<span class="badge badge-green">${a.frei} Plätze frei</span>`;
  return `
    <div class="termin-col">
      <div class="termin-col-label">${formatiereDatum(termin.datum)}</div>
      <div class="progress-track"><div class="progress-fill ${a.belegt >= a.kapazitaet ? 'full' : ''}" style="width:${a.prozent}%"></div></div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
        <span style="font-size:12px; color:var(--muted);">${a.belegt} von ${a.kapazitaet} belegt</span>
        ${badge}
      </div>
    </div>`;
}

function uebersichtTeilnehmerListe(termin) {
  const buchungen = buchungenFuerTermin(termin.id);
  if (buchungen.length === 0) {
    return '<p class="empty-hint">Noch keine Teilnehmer zugeordnet.</p>';
  }
  const zeilen = buchungen.map(b => {
    const t = window.STATE.teilnehmer.find(p => p.id === b.teilnehmerId);
    return `<li>${t ? t.name : '(unbekannt)'} <span style="color:var(--muted2);">· ${t ? t.firma : ''}</span></li>`;
  }).join('');
  return `<ul style="margin:0; padding-left:18px; font-size:12.5px; color:var(--text);">${zeilen}</ul>`;
}

function renderUebersicht() {
  const container = document.getElementById('uebersicht-kursliste');
  if (!container) return;

  container.innerHTML = window.STATE.kurse.map(kurs => {
    const termine = naechsteZweiTermine(kurs.id);
    const spalten = termine.map(uebersichtTerminSpalte).join('');
    const teilnehmerBloecke = termine.map(t => `
      <div>
        <div class="termin-col-label">${formatiereDatum(t.datum)}</div>
        ${uebersichtTeilnehmerListe(t)}
      </div>`).join('');
    return `
      <div style="border-bottom:1px solid var(--line); padding:14px 0;">
        <div class="expand-row" onclick="uebersichtToggle('${kurs.id}')">
          <span class="expand-toggle" id="toggle-${kurs.id}">▸</span>
          <strong style="font-family:var(--font-display); font-size:14px; color:var(--ink);">${kurs.titel}</strong>
          <span style="color:var(--muted); font-size:12px; margin-left:8px;">${kurs.kategorie}</span>
        </div>
        <div class="termin-pair" style="margin-top:10px;">${spalten}</div>
        <div class="expand-content" id="expand-${kurs.id}" style="margin-top:10px;">
          <div class="termin-pair">${teilnehmerBloecke}</div>
        </div>
      </div>`;
  }).join('');

  const naechsteContainer = document.getElementById('uebersicht-naechste-termine');
  const heute = new Date().toISOString().slice(0, 10);
  const alleTermineMitKurs = window.STATE.kurse.flatMap(kurs =>
    kurs.termine.map(termin => ({ kurs, termin }))
  ).filter(({ termin }) => termin.status === 'laufend' || termin.datum >= heute)
   .sort((a, b) => a.termin.datum.localeCompare(b.termin.datum))
   .slice(0, 6);

  naechsteContainer.innerHTML = alleTermineMitKurs.map(({ kurs, termin }) => {
    let chip;
    if (termin.status === 'laufend') {
      chip = '<span class="badge badge-amber">Läuft</span>';
    } else {
      const tage = Math.round((new Date(termin.datum) - new Date(heute)) / 86400000);
      chip = `<span class="badge badge-gray">${tage === 0 ? 'Heute' : 'in ' + tage + ' Tagen'}</span>`;
    }
    return `
      <div class="list-row">
        <div>
          <div style="font-weight:600; color:var(--ink); font-size:13px;">${kurs.titel}</div>
          <div style="font-size:12px; color:var(--muted);">${termin.trainer} · ${formatiereDatum(termin.datum)}</div>
        </div>
        ${chip}
      </div>`;
  }).join('');
}

function uebersichtToggle(kursId) {
  document.getElementById(`expand-${kursId}`).classList.toggle('open');
  document.getElementById(`toggle-${kursId}`).classList.toggle('open');
}
```

- [ ] **Step 3: Build + manuelle Verifikation im Browser**

Run: `python Design/assemble.py`

Im Claude Browser Pane `Berichte/index.html` öffnen (bei Bedarf vorher `localStorage.clear()` in der Konsole und neu laden, falls Teststände aus früheren Tasks stören):
- Übersicht zeigt 8 Kurszeilen, jede mit ein oder zwei Terminspalten
- Bei „Datenschutzbeauftragter Grundlagenschulung": ein Termin am 12.08.2026 und ein zweiter am 18.11.2026 sichtbar
- Bei „Arbeitssicherheit Basisschulung": ein Termin zeigt „Ausgebucht" (Indigo-Badge), der zweite (15.10.2026) zeigt „7 Plätze frei"
- Klick auf eine Kurszeile klappt die Teilnehmerliste(n) auf, zweiter Klick klappt sie wieder zu
- „Nächste anstehende Termine" zeigt eine sortierte Liste mit Chips
- Keine Konsolenfehler (`read_console_messages`, `onlyErrors: true`)

- [ ] **Step 4: Commit**

```bash
git add Design/fragments/page-uebersicht.html Design/fragments/page-uebersicht.js Berichte/index.html
git commit -m "feat: Übersicht als Navigator mit Zwei-Termine-Ansicht und Ausklappen"
```

---

## Task 8: Seite Schulungen (Kurs/Termin-Verwaltung)

**Files:**
- Modify: `Design/fragments/page-schulungen.html` (kompletter Neuinhalt)
- Create: `Design/fragments/page-schulungen.js`

**Interfaces:**
- Consumes: `erstelleKurs`, `aktualisiereKurs`, `loescheKurs`, `erstelleTermin`, `aktualisiereTermin`, `loescheTermin`, `terminAuslastung`, `formatiereDatum`, `statusBadgeHtml`, `oeffneDialog`, `schliesseDialog`, `formularWerte`, `showSchulungDetail(terminId)` (Task 2–5, 7)
- Produces: `renderSchulungen()` — von `renderAll()` aufgerufen

- [ ] **Step 1: page-schulungen.html schreiben**

```html
<div class="page-header">
  <div class="page-header-text">
    <h1>Schulungen</h1>
    <p class="subtitle">Kurse und ihre Termine verwalten.</p>
  </div>
  <div class="page-header-actions">
    <button class="btn btn-primary" onclick="oeffneNeuerKursDialog()">+ Neuer Kurs</button>
  </div>
</div>

<div class="filter-bar">
  <input type="text" id="schulungen-suche" class="filter-input" placeholder="Kurs suchen …" oninput="renderSchulungen()" />
  <select id="schulungen-kategorie-filter" class="filter-select" onchange="renderSchulungen()">
    <option value="">Kategorie: Alle</option>
    <option value="Datenschutz">Datenschutz</option>
    <option value="Compliance">Compliance</option>
    <option value="Arbeitssicherheit">Arbeitssicherheit</option>
  </select>
</div>

<div class="card" style="padding:6px 22px;">
  <div id="schulungen-kursliste"></div>
</div>
```

- [ ] **Step 2: page-schulungen.js — Liste + Filter + Ausklappen schreiben**

```javascript
// Design/fragments/page-schulungen.js

function schulungenGefilterteKurse() {
  const suche = (document.getElementById('schulungen-suche')?.value || '').toLowerCase();
  const kategorie = document.getElementById('schulungen-kategorie-filter')?.value || '';
  return window.STATE.kurse.filter(k =>
    (!suche || k.titel.toLowerCase().includes(suche)) &&
    (!kategorie || k.kategorie === kategorie)
  );
}

function schulungenTerminZeile(kurs, termin) {
  const a = terminAuslastung(termin.id);
  const auslastungText = a.belegt >= a.kapazitaet
    ? '<span class="badge badge-indigo">Ausgebucht</span>'
    : `${a.belegt} / ${a.kapazitaet}`;
  return `
    <tr>
      <td class="cell-strong" style="cursor:pointer;" onclick="showSchulungDetail('${termin.id}')">${formatiereDatum(termin.datum)}</td>
      <td>${termin.trainer}</td>
      <td>${termin.format} · ${termin.ort}</td>
      <td>${statusBadgeHtml(termin.status)}</td>
      <td>${auslastungText}</td>
      <td style="text-align:right; white-space:nowrap;">
        <button class="btn" onclick="showSchulungDetail('${termin.id}')">Öffnen</button>
        <button class="btn" onclick="oeffneTerminBearbeitenDialog('${termin.id}')">Bearbeiten</button>
        <button class="btn btn-ghost-red" onclick="terminLoeschenBestaetigen('${termin.id}')">Löschen</button>
      </td>
    </tr>`;
}

function renderSchulungen() {
  const container = document.getElementById('schulungen-kursliste');
  if (!container) return;
  const kurse = schulungenGefilterteKurse();

  container.innerHTML = kurse.map(kurs => `
    <div style="border-bottom:1px solid var(--line); padding:14px 0;">
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <div class="expand-row" style="flex:1;" onclick="schulungenToggle('${kurs.id}')">
          <span class="expand-toggle" id="s-toggle-${kurs.id}">▸</span>
          <strong style="font-family:var(--font-display); font-size:14px; color:var(--ink);">${kurs.titel}</strong>
          <span style="color:var(--muted); font-size:12px; margin-left:8px;">${kurs.kategorie} · ${kurs.termine.length} Termin(e)</span>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn" onclick="oeffneNeuerTerminDialog('${kurs.id}')">+ Termin</button>
          <button class="btn" onclick="oeffneKursBearbeitenDialog('${kurs.id}')">Bearbeiten</button>
          <button class="btn btn-ghost-red" onclick="kursLoeschenBestaetigen('${kurs.id}')">Löschen</button>
        </div>
      </div>
      <div class="expand-content" id="s-expand-${kurs.id}">
        <table class="data-table fixed-rows">
          <thead><tr><th>Datum</th><th>Trainer</th><th>Format / Ort</th><th>Status</th><th>Teilnehmer</th><th></th></tr></thead>
          <tbody>${kurs.termine.map(t => schulungenTerminZeile(kurs, t)).join('')}</tbody>
        </table>
      </div>
    </div>`).join('');
}

function schulungenToggle(kursId) {
  document.getElementById(`s-expand-${kursId}`).classList.toggle('open');
  document.getElementById(`s-toggle-${kursId}`).classList.toggle('open');
}
```

- [ ] **Step 3: page-schulungen.js — Dialoge (Kurs anlegen/bearbeiten/löschen) anhängen**

```javascript
function oeffneNeuerKursDialog() {
  oeffneDialog(`
    <div class="dialog-head"><h3>Neuen Kurs anlegen</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form id="neuer-kurs-form" onsubmit="return speichereNeuerKurs(event)">
      <div class="dialog-body">
        <div class="field"><label>Titel</label><input name="titel" required /></div>
        <div class="field">
          <label>Kategorie</label>
          <select name="kategorie" required>
            <option value="Datenschutz">Datenschutz</option>
            <option value="Compliance">Compliance</option>
            <option value="Arbeitssicherheit">Arbeitssicherheit</option>
          </select>
        </div>
        <div class="field"><label>Beschreibung</label><textarea name="beschreibung" rows="3"></textarea></div>
        <div class="field"><label>Zielgruppe</label><input name="zielgruppe" /></div>
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Kurs anlegen</button>
      </div>
    </form>`);
}

function speichereNeuerKurs(ev) {
  ev.preventDefault();
  const felder = formularWerte(ev.target);
  felder.lernziele = [];
  felder.voraussetzungen = felder.voraussetzungen || 'Keine';
  erstelleKurs(felder);
  schliesseDialog();
  return false;
}

function oeffneKursBearbeitenDialog(kursId) {
  const kurs = findeKurs(kursId);
  oeffneDialog(`
    <div class="dialog-head"><h3>Kurs bearbeiten</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form id="kurs-bearbeiten-form" onsubmit="return speichereKursBearbeiten(event, '${kursId}')">
      <div class="dialog-body">
        <div class="field"><label>Titel</label><input name="titel" value="${kurs.titel}" required /></div>
        <div class="field"><label>Kategorie</label><input name="kategorie" value="${kurs.kategorie}" required /></div>
        <div class="field"><label>Beschreibung</label><textarea name="beschreibung" rows="3">${kurs.beschreibung}</textarea></div>
        <div class="field"><label>Zielgruppe</label><input name="zielgruppe" value="${kurs.zielgruppe}" /></div>
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Speichern</button>
      </div>
    </form>`);
}

function speichereKursBearbeiten(ev, kursId) {
  ev.preventDefault();
  aktualisiereKurs(kursId, formularWerte(ev.target));
  schliesseDialog();
  return false;
}

function kursLoeschenBestaetigen(kursId) {
  const kurs = findeKurs(kursId);
  if (confirm(`"${kurs.titel}" mit allen ${kurs.termine.length} Terminen und zugehörigen Buchungen wirklich löschen?`)) {
    loescheKurs(kursId);
  }
}
```

- [ ] **Step 4: page-schulungen.js — Dialoge (Termin anlegen/bearbeiten/löschen) anhängen**

```javascript
function oeffneNeuerTerminDialog(kursId) {
  oeffneDialog(`
    <div class="dialog-head"><h3>Neuen Termin anlegen</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form id="neuer-termin-form" onsubmit="return speichereNeuerTermin(event, '${kursId}')">
      <div class="dialog-body">
        <div class="field-row2">
          <div class="field"><label>Datum</label><input type="date" name="datum" required /></div>
          <div class="field"><label>Kapazität</label><input type="number" name="kapazitaet" min="1" required /></div>
        </div>
        <div class="field-row2">
          <div class="field"><label>Trainer</label><input name="trainer" required /></div>
          <div class="field">
            <label>Format</label>
            <select name="format"><option>Vor Ort</option><option>Online</option></select>
          </div>
        </div>
        <div class="field"><label>Ort</label><input name="ort" placeholder="z. B. Hamburg oder — bei Online" /></div>
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Termin anlegen</button>
      </div>
    </form>`);
}

function speichereNeuerTermin(ev, kursId) {
  ev.preventDefault();
  const felder = formularWerte(ev.target);
  felder.kapazitaet = parseInt(felder.kapazitaet, 10);
  erstelleTermin(kursId, felder);
  schliesseDialog();
  return false;
}

function oeffneTerminBearbeitenDialog(terminId) {
  const { termin } = findeTerminMitKurs(terminId);
  oeffneDialog(`
    <div class="dialog-head"><h3>Termin bearbeiten</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form id="termin-bearbeiten-form" onsubmit="return speichereTerminBearbeiten(event, '${terminId}')">
      <div class="dialog-body">
        <div class="field-row2">
          <div class="field"><label>Datum</label><input type="date" name="datum" value="${termin.datum}" required /></div>
          <div class="field"><label>Kapazität</label><input type="number" name="kapazitaet" min="1" value="${termin.kapazitaet}" required /></div>
        </div>
        <div class="field-row2">
          <div class="field"><label>Trainer</label><input name="trainer" value="${termin.trainer}" required /></div>
          <div class="field">
            <label>Format</label>
            <select name="format">
              <option ${termin.format === 'Vor Ort' ? 'selected' : ''}>Vor Ort</option>
              <option ${termin.format === 'Online' ? 'selected' : ''}>Online</option>
            </select>
          </div>
        </div>
        <div class="field"><label>Ort</label><input name="ort" value="${termin.ort}" /></div>
        <div class="field">
          <label>Status</label>
          <select name="status">
            <option value="geplant" ${termin.status === 'geplant' ? 'selected' : ''}>geplant</option>
            <option value="laufend" ${termin.status === 'laufend' ? 'selected' : ''}>laufend</option>
            <option value="abgeschlossen" ${termin.status === 'abgeschlossen' ? 'selected' : ''}>abgeschlossen</option>
          </select>
        </div>
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Speichern</button>
      </div>
    </form>`);
}

function speichereTerminBearbeiten(ev, terminId) {
  ev.preventDefault();
  const felder = formularWerte(ev.target);
  felder.kapazitaet = parseInt(felder.kapazitaet, 10);
  aktualisiereTermin(terminId, felder);
  schliesseDialog();
  return false;
}

function terminLoeschenBestaetigen(terminId) {
  const { kurs, termin } = findeTerminMitKurs(terminId);
  if (confirm(`Termin "${kurs.titel}" am ${formatiereDatum(termin.datum)} mit allen Buchungen wirklich löschen?`)) {
    loescheTermin(terminId);
  }
}
```

- [ ] **Step 5: Build + manuelle Verifikation im Browser**

Run: `python Design/assemble.py`

Im Claude Browser Pane:
- „+ Neuer Kurs" klicken, Formular ausfüllen (Titel „Test-Workshop", Kategorie „Compliance"), speichern → neuer Kurs erscheint sofort in der Liste, Dialog schließt sich
- Bei diesem neuen Kurs „+ Termin" klicken, Datum/Kapazität/Trainer ausfüllen, speichern → Termin erscheint beim Aufklappen
- „Löschen" beim Test-Kurs klicken, Bestätigungsdialog (natives `confirm()`) erscheint, bestätigen → Kurs verschwindet
- Bei einem bestehenden Kurs „+ Termin" → „Öffnen" beim neuen Termin klickt zur Detailseite (zeigt vorerst nur den alten Platzhalter-Inhalt aus Task 5/9, das ist an dieser Stelle erwartet)
- Seite neu laden (F5) → Änderungen (falls nicht wieder gelöscht) bleiben erhalten (localStorage-Persistenz)
- Keine Konsolenfehler

- [ ] **Step 6: Commit**

```bash
git add Design/fragments/page-schulungen.html Design/fragments/page-schulungen.js Berichte/index.html
git commit -m "feat: Schulungen-Seite mit Kurs/Termin-CRUD"
```

---

## Task 9: Seite Schulungsdetail (ein Termin)

**Files:**
- Modify: `Design/fragments/page-schulungdetail.html` (kompletter Neuinhalt)
- Create: `Design/fragments/page-schulungdetail.js`

**Interfaces:**
- Consumes: `findeTerminMitKurs`, `findeKurs`, `terminAuslastung`, `aktualisiereKurs`, `agendaPunktHinzufuegen`, `agendaPunktEntfernen`, `checklistePunktToggeln`, `checklistePunktHinzufuegen`, `checklistePunktEntfernen`, `erstelleTeilnehmer`, `erstelleBuchung`, `aktualisiereBuchungStatus`, `loescheBuchung`, `buchungenFuerTermin`, `speichereDatei`, `herunterladeDatei`, `loescheDateiUndReferenz`, `formatiereDatum`, `statusBadgeHtml`, `anmeldestatusBadgeHtml`, `oeffneDialog`, `schliesseDialog`, `formularWerte`, `oeffneTerminBearbeitenDialog` (aus Task 8, wiederverwendet), `window.AKTUELLER_TERMIN_ID` (Task 5/9)
- Produces: `renderSchulungdetail(terminId)` — von `renderAll()` und `showSchulungDetail()` aufgerufen; toleriert `terminId === undefined` (Leerzustand vor erster Navigation)

- [ ] **Step 1: page-schulungdetail.html schreiben**

```html
<div id="schulungdetail-inhalt">
  <p class="empty-hint">Wähle links unter „Schulungen" einen Termin aus, um Details zu sehen.</p>
</div>
```

- [ ] **Step 2: page-schulungdetail.js — Kopfbereich + Navigation + Grundgerüst schreiben**

```javascript
// Design/fragments/page-schulungdetail.js

function detailFormatiereGroesse(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function detailDateiIcon(typ) {
  if (typ.includes('pdf')) return '📄';
  if (typ.includes('presentation') || typ.includes('powerpoint')) return '📊';
  if (typ.includes('sheet') || typ.includes('excel')) return '📈';
  return '📁';
}

function detailScrollZu(anker) {
  document.getElementById(`abschnitt-${anker}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.querySelectorAll('.detail-nav a').forEach(a => a.classList.remove('active'));
  document.getElementById(`nav-${anker}`)?.classList.add('active');
}

function renderSchulungdetail(terminId) {
  const container = document.getElementById('schulungdetail-inhalt');
  if (!container) return;
  const gefunden = terminId ? findeTerminMitKurs(terminId) : undefined;
  if (!gefunden) {
    container.innerHTML = '<p class="empty-hint">Wähle links unter „Schulungen" einen Termin aus, um Details zu sehen.</p>';
    return;
  }
  const { kurs, termin } = gefunden;
  const a = terminAuslastung(termin.id);

  container.innerHTML = `
    <button class="crumb" onclick="showPage('schulungen')">← Zurück zu Schulungen</button>

    <div class="card" style="padding:20px 24px; margin-bottom:20px;">
      <div style="display:flex; align-items:flex-start; justify-content:space-between;">
        <div>
          <div style="display:flex; gap:8px; margin-bottom:10px;">
            <span class="badge badge-indigo">${kurs.kategorie}</span>
            ${statusBadgeHtml(termin.status)}
          </div>
          <h2 style="font-size:20px; margin:0 0 8px 0;">${kurs.titel}</h2>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn" onclick="oeffneTerminBearbeitenDialog('${termin.id}')">Bearbeiten</button>
          <button class="btn btn-primary" onclick="detailOeffneTeilnehmerHinzufuegenDialog('${termin.id}')">+ Teilnehmer</button>
        </div>
      </div>
      <div style="display:flex; gap:32px; font-size:13px; margin:14px 0;">
        <div><div class="mat-group-label" style="margin:0 0 3px 0;">Datum</div><div style="color:var(--ink); font-weight:600;">${formatiereDatum(termin.datum)}</div></div>
        <div><div class="mat-group-label" style="margin:0 0 3px 0;">Trainer</div><div style="color:var(--ink); font-weight:600;">${termin.trainer}</div></div>
        <div><div class="mat-group-label" style="margin:0 0 3px 0;">Format</div><div style="color:var(--ink); font-weight:600;">${termin.format} · ${termin.ort}</div></div>
        <div><div class="mat-group-label" style="margin:0 0 3px 0;">Kapazität</div><div style="color:var(--ink); font-weight:600;">${a.belegt} von ${a.kapazitaet} belegt</div></div>
      </div>
      <div class="progress-track"><div class="progress-fill ${a.belegt >= a.kapazitaet ? 'full' : ''}" style="width:${a.prozent}%"></div></div>
    </div>

    <div class="detail-layout">
      <div class="detail-nav">
        <a id="nav-beschreibung" class="active" onclick="detailScrollZu('beschreibung')">Beschreibung</a>
        <a id="nav-agenda" onclick="detailScrollZu('agenda')">Agenda</a>
        <a id="nav-materialien" onclick="detailScrollZu('materialien')">Materialien</a>
        <a id="nav-checkliste" onclick="detailScrollZu('checkliste')">Checkliste</a>
        <a id="nav-teilnehmer" onclick="detailScrollZu('teilnehmer')">Teilnehmer</a>
      </div>
      <div class="detail-main">
        ${detailAbschnittBeschreibung(kurs)}
        ${detailAbschnittAgenda(kurs)}
        ${detailAbschnittMaterialien(kurs)}
        ${detailAbschnittCheckliste(termin)}
        ${detailAbschnittTeilnehmer(termin)}
      </div>
    </div>`;
}
```

- [ ] **Step 3: Abschnitt „Beschreibung & Lernziele" schreiben**

```javascript
function detailAbschnittBeschreibung(kurs) {
  return `
    <div class="card" id="abschnitt-beschreibung">
      <div class="section-title">Beschreibung &amp; Lernziele
        <button class="btn" onclick="detailOeffneBeschreibungBearbeitenDialog('${kurs.id}')">Bearbeiten</button>
      </div>
      <p class="desc-text" style="font-size:13px; line-height:1.55;">${kurs.beschreibung || '<em>Noch keine Beschreibung.</em>'}</p>
      <ul class="goal-list">${(kurs.lernziele || []).map(z => `<li>${z}</li>`).join('') || '<li style="color:var(--muted2);">Noch keine Lernziele.</li>'}</ul>
      <div class="pill-row">
        <span class="pill">Zielgruppe: ${kurs.zielgruppe || '—'}</span>
        <span class="pill">Voraussetzung: ${kurs.voraussetzungen || '—'}</span>
      </div>
    </div>`;
}

function detailOeffneBeschreibungBearbeitenDialog(kursId) {
  const kurs = findeKurs(kursId);
  oeffneDialog(`
    <div class="dialog-head"><h3>Beschreibung &amp; Lernziele bearbeiten</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form onsubmit="return detailSpeichereBeschreibung(event, '${kursId}')">
      <div class="dialog-body">
        <div class="field"><label>Beschreibung</label><textarea name="beschreibung" rows="3">${kurs.beschreibung}</textarea></div>
        <div class="field"><label>Lernziele (ein Punkt pro Zeile)</label><textarea name="lernzieleText" rows="4">${(kurs.lernziele || []).join('\n')}</textarea></div>
        <div class="field-row2">
          <div class="field"><label>Zielgruppe</label><input name="zielgruppe" value="${kurs.zielgruppe}" /></div>
          <div class="field"><label>Voraussetzungen</label><input name="voraussetzungen" value="${kurs.voraussetzungen}" /></div>
        </div>
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Speichern</button>
      </div>
    </form>`);
}

function detailSpeichereBeschreibung(ev, kursId) {
  ev.preventDefault();
  const felder = formularWerte(ev.target);
  const lernziele = felder.lernzieleText.split('\n').map(z => z.trim()).filter(Boolean);
  aktualisiereKurs(kursId, {
    beschreibung: felder.beschreibung, zielgruppe: felder.zielgruppe,
    voraussetzungen: felder.voraussetzungen, lernziele,
  });
  schliesseDialog();
  return false;
}
```

- [ ] **Step 4: Abschnitt „Agenda" schreiben**

```javascript
function detailAbschnittAgenda(kurs) {
  const punkte = kurs.agenda.map((p, i) => `
    <div class="agenda-item">
      <div class="agenda-time">${p.zeit}</div>
      <div style="flex:1;">
        <div class="agenda-title">${p.titel}</div>
        <div class="agenda-desc">${p.beschreibung}</div>
      </div>
      <button class="btn-link" style="color:var(--status-red-fg);" onclick="detailAgendaEntfernen('${kurs.id}', ${i})">Entfernen</button>
    </div>`).join('') || '<p class="empty-hint">Noch keine Agenda-Punkte.</p>';
  return `
    <div class="card" id="abschnitt-agenda">
      <div class="section-title">Agenda <small>${kurs.agenda.length} Programmpunkte</small>
        <button class="btn" onclick="detailOeffneAgendaDialog('${kurs.id}')">+ Programmpunkt</button>
      </div>
      ${punkte}
    </div>`;
}

function detailOeffneAgendaDialog(kursId) {
  oeffneDialog(`
    <div class="dialog-head"><h3>Programmpunkt hinzufügen</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form onsubmit="return detailSpeichereAgenda(event, '${kursId}')">
      <div class="dialog-body">
        <div class="field"><label>Zeit</label><input name="zeit" placeholder="09:00–10:30" required /></div>
        <div class="field"><label>Titel</label><input name="titel" required /></div>
        <div class="field"><label>Beschreibung</label><textarea name="beschreibung" rows="2"></textarea></div>
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Hinzufügen</button>
      </div>
    </form>`);
}

function detailSpeichereAgenda(ev, kursId) {
  ev.preventDefault();
  agendaPunktHinzufuegen(kursId, formularWerte(ev.target));
  schliesseDialog();
  return false;
}

function detailAgendaEntfernen(kursId, index) {
  if (confirm('Diesen Programmpunkt entfernen?')) {
    agendaPunktEntfernen(kursId, index);
  }
}
```

- [ ] **Step 5: Abschnitt „Materialien" schreiben**

```javascript
function detailMaterialListe(kurs, bereich) {
  const dateien = kurs.materialien[bereich];
  if (dateien.length === 0) return '<p class="empty-hint">Noch keine Dateien.</p>';
  return dateien.map(d => `
    <div class="mat-row">
      <div class="mat-icon">${detailDateiIcon(d.typ)}</div>
      <div>
        <div class="mat-name">${d.name}</div>
        <div class="mat-sub">${detailFormatiereGroesse(d.groesse)}</div>
      </div>
      <div class="mat-actions">
        <button class="btn" onclick="herunterladeDatei('${d.id}', '${d.name}')">↓</button>
        <button class="btn btn-ghost-red" onclick="detailMaterialEntfernen('${kurs.id}', '${bereich}', '${d.id}')">Entfernen</button>
      </div>
    </div>`).join('');
}

function detailAbschnittMaterialien(kurs) {
  return `
    <div class="card" id="abschnitt-materialien">
      <div class="section-title">Materialien</div>
      <div class="mat-group-label">Seminarunterlagen</div>
      ${detailMaterialListe(kurs, 'seminarunterlagen')}
      <div style="margin:10px 0 18px 0;">
        <input type="file" onchange="detailMaterialUpload(event, '${kurs.id}', 'seminarunterlagen')" />
      </div>
      <div class="mat-group-label">Vorlagen-Bibliothek <span style="text-transform:none; font-weight:400;">— Ressourcen für die Umsetzung</span></div>
      ${detailMaterialListe(kurs, 'vorlagen')}
      <div style="margin-top:10px;">
        <input type="file" onchange="detailMaterialUpload(event, '${kurs.id}', 'vorlagen')" />
      </div>
    </div>`;
}

function detailMaterialUpload(ev, kursId, bereich) {
  const datei = ev.target.files[0];
  if (!datei) return;
  speichereDatei(datei, { kursId, bereich }).then(() => { ev.target.value = ''; });
}

function detailMaterialEntfernen(kursId, bereich, dateiId) {
  if (confirm('Diese Datei wirklich entfernen?')) {
    loescheDateiUndReferenz(dateiId, kursId, bereich);
  }
}
```

- [ ] **Step 6: Abschnitte „Checkliste" und „Teilnehmer" schreiben**

```javascript
function detailAbschnittCheckliste(termin) {
  const zeilen = termin.checkliste.map((p, i) => `
    <div class="check-row ${p.erledigt ? 'done' : ''}">
      <button class="check-box ${p.erledigt ? 'done' : ''}" onclick="checklistePunktToggeln('${termin.id}', ${i})">${p.erledigt ? '✓' : ''}</button>
      <span class="lbl" style="flex:1;">${p.label}</span>
      <button class="btn-link" style="color:var(--status-red-fg);" onclick="detailChecklisteEntfernen('${termin.id}', ${i})">Entfernen</button>
    </div>`).join('');
  const erledigtAnzahl = termin.checkliste.filter(p => p.erledigt).length;
  return `
    <div class="card" id="abschnitt-checkliste">
      <div class="section-title">Checkliste <small>${erledigtAnzahl}/${termin.checkliste.length}</small>
        <button class="btn" onclick="detailChecklisteHinzufuegen('${termin.id}')">+ Punkt</button>
      </div>
      ${zeilen}
    </div>`;
}

function detailChecklisteHinzufuegen(terminId) {
  const label = prompt('Neuer Checklistenpunkt:');
  if (label && label.trim()) {
    checklistePunktHinzufuegen(terminId, label.trim());
  }
}

function detailChecklisteEntfernen(terminId, index) {
  checklistePunktEntfernen(terminId, index);
}

function detailAbschnittTeilnehmer(termin) {
  const buchungen = buchungenFuerTermin(termin.id);
  const zeilen = buchungen.map(b => {
    const t = window.STATE.teilnehmer.find(p => p.id === b.teilnehmerId);
    return `
      <tr>
        <td class="cell-strong">${t ? t.name : '(unbekannt)'}</td>
        <td>${t ? t.firma : ''}</td>
        <td>${t ? t.email : ''}</td>
        <td>
          <select onchange="aktualisiereBuchungStatus('${b.id}', this.value)">
            <option value="angemeldet" ${b.anmeldestatus === 'angemeldet' ? 'selected' : ''}>angemeldet</option>
            <option value="bestätigt" ${b.anmeldestatus === 'bestätigt' ? 'selected' : ''}>bestätigt</option>
            <option value="abgesagt" ${b.anmeldestatus === 'abgesagt' ? 'selected' : ''}>abgesagt</option>
          </select>
        </td>
        <td><button class="btn btn-ghost-red" onclick="detailBuchungEntfernen('${b.id}')">Entfernen</button></td>
      </tr>`;
  }).join('') || '<tr><td colspan="5" class="empty-hint">Noch keine Teilnehmer.</td></tr>';
  return `
    <div class="card" id="abschnitt-teilnehmer">
      <div class="section-title">Teilnehmer dieses Termins <small>${buchungen.length}</small></div>
      <table class="data-table fixed-rows">
        <thead><tr><th>Name</th><th>Firma</th><th>E-Mail</th><th>Anmeldestatus</th><th></th></tr></thead>
        <tbody>${zeilen}</tbody>
      </table>
    </div>`;
}

function detailBuchungEntfernen(buchungId) {
  if (confirm('Diese Buchung wirklich entfernen?')) {
    loescheBuchung(buchungId);
  }
}

function detailOeffneTeilnehmerHinzufuegenDialog(terminId) {
  const optionen = window.STATE.teilnehmer
    .map(t => `<option value="${t.id}">${t.name} — ${t.firma}</option>`).join('');
  oeffneDialog(`
    <div class="dialog-head"><h3>Teilnehmer hinzufügen</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form onsubmit="return detailSpeichereTeilnehmerHinzufuegen(event, '${terminId}')">
      <div class="dialog-body">
        <div class="field">
          <label>Person</label>
          <select name="teilnehmerId" id="detail-teilnehmer-auswahl" onchange="detailToggleNeuePersonFelder(this.value)">
            <option value="__neu__">— Neue Person —</option>
            ${optionen}
          </select>
        </div>
        <div id="detail-neue-person-felder">
          <div class="field"><label>Name</label><input name="name" /></div>
          <div class="field"><label>Firma</label><input name="firma" /></div>
          <div class="field"><label>E-Mail</label><input type="email" name="email" /></div>
        </div>
        <div class="field">
          <label>Anmeldestatus</label>
          <select name="anmeldestatus">
            <option value="angemeldet">angemeldet</option>
            <option value="bestätigt">bestätigt</option>
          </select>
        </div>
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Hinzufügen</button>
      </div>
    </form>`);
}

function detailToggleNeuePersonFelder(wert) {
  document.getElementById('detail-neue-person-felder').style.display = wert === '__neu__' ? 'flex' : 'none';
}

function detailSpeichereTeilnehmerHinzufuegen(ev, terminId) {
  ev.preventDefault();
  const felder = formularWerte(ev.target);
  let teilnehmerId = felder.teilnehmerId;
  if (teilnehmerId === '__neu__') {
    teilnehmerId = erstelleTeilnehmer({
      name: felder.name, firma: felder.firma, email: felder.email, bestandskunde: false,
    });
  }
  erstelleBuchung({ teilnehmerId, terminId, anmeldestatus: felder.anmeldestatus });
  schliesseDialog();
  return false;
}
```

- [ ] **Step 7: Build + manuelle Verifikation im Browser**

Run: `python Design/assemble.py`

Im Claude Browser Pane:
- Über „Schulungen" → „Öffnen" bei einem Termin → Detailseite zeigt Kopfkarte, alle 5 Abschnitte mit echten Daten
- Klick auf „Agenda" in der linken Navigation scrollt dorthin
- „+ Programmpunkt" → Formular ausfüllen → neuer Punkt erscheint sofort in der Liste
- Bei „Materialien" eine beliebige Testdatei über den Datei-Auswähler hochladen → erscheint in der Liste, „↓" löst Download aus, „Entfernen" (mit Bestätigung) entfernt sie wieder
- Checkliste: Klick auf eine Checkbox hakt sie ab (durchgestrichen), „+ Punkt" fügt über `prompt()` einen neuen hinzu
- „+ Teilnehmer" → bestehende Person auswählen ODER „— Neue Person —" wählen und Felder ausfüllen → erscheint in der Teilnehmertabelle; Anmeldestatus-Dropdown in der Tabelle ändern → Änderung bleibt nach Neuladen erhalten
- Zurück zur Übersicht: die neue Buchung erhöht sichtbar die Auslastung des Termins dort
- Keine Konsolenfehler

- [ ] **Step 8: Commit**

```bash
git add Design/fragments/page-schulungdetail.html Design/fragments/page-schulungdetail.js Berichte/index.html
git commit -m "feat: Schulungsdetail-Seite mit Agenda/Materialien/Checkliste/Teilnehmer-CRUD"
```

---

## Task 10: Seite Buchungen (ersetzt Teilnehmer + Kunden)

**Files:**
- Modify: `Design/fragments/page-buchungen.html` (kompletter Neuinhalt, ersetzt den Platzhalter aus Task 5)
- Create: `Design/fragments/page-buchungen.js`

**Interfaces:**
- Consumes: `buchungenSortiertNeuesteZuerst`, `findeTerminMitKurs`, `buchungshistorieFirma`, `erstelleTeilnehmer`, `erstelleBuchung`, `loescheBuchung`, `formatiereDatum`, `anmeldestatusBadgeHtml`, `oeffneDialog`, `schliesseDialog`, `formularWerte`, `window.STATE` (Task 2/3/5)
- Produces: `renderBuchungen()` — von `renderAll()` aufgerufen

- [ ] **Step 1: page-buchungen.html schreiben**

```html
<div class="page-header">
  <div class="page-header-text">
    <h1>Buchungen</h1>
    <p class="subtitle">Alle Anmeldungen, neueste zuerst.</p>
  </div>
  <div class="page-header-actions">
    <button class="btn btn-primary" onclick="oeffneNeueBuchungDialog()">+ Neue Buchung</button>
  </div>
</div>

<div class="filter-bar">
  <select id="buchungen-status-filter" class="filter-select" onchange="renderBuchungen()">
    <option value="">Anmeldestatus: Alle</option>
    <option value="angemeldet">angemeldet</option>
    <option value="bestätigt">bestätigt</option>
    <option value="abgesagt">abgesagt</option>
  </select>
  <select id="buchungen-kurs-filter" class="filter-select" onchange="renderBuchungen()">
    <option value="">Kurs: Alle</option>
  </select>
</div>

<div class="card" style="padding:6px 22px;">
  <table class="data-table fixed-rows">
    <thead><tr><th>Name</th><th>Firma</th><th>E-Mail</th><th>Status</th><th>Kurs / Termin</th><th></th></tr></thead>
    <tbody id="buchungen-tabelle"></tbody>
  </table>
</div>
```

- [ ] **Step 2: page-buchungen.js schreiben**

```javascript
// Design/fragments/page-buchungen.js

function buchungenAktualisiereKursFilterOptionen() {
  const select = document.getElementById('buchungen-kurs-filter');
  const aktuellerWert = select.value;
  const optionen = window.STATE.kurse
    .map(k => `<option value="${k.id}">${k.titel}</option>`).join('');
  select.innerHTML = '<option value="">Kurs: Alle</option>' + optionen;
  if ([...select.options].some(o => o.value === aktuellerWert)) {
    select.value = aktuellerWert;
  }
}

function buchungenIstNeu(gebuchtAm) {
  const heute = new Date();
  const datum = new Date(gebuchtAm);
  const tageDiff = Math.abs((heute - datum) / 86400000);
  return tageDiff <= 14;
}

function buchungenZeile(buchung) {
  const teilnehmer = window.STATE.teilnehmer.find(t => t.id === buchung.teilnehmerId);
  const gefunden = findeTerminMitKurs(buchung.terminId);
  if (!teilnehmer || !gefunden) return '';
  const { kurs, termin } = gefunden;
  const neu = buchungenIstNeu(buchung.gebuchtAm);
  const historie = buchungshistorieFirma(teilnehmer.firma);
  const historieHtml = historie.length
    ? `<ul style="margin:0; padding-left:18px;">${historie.map(h => `<li>${h.titel}: ${h.anzahl}×</li>`).join('')}</ul>`
    : '<p class="empty-hint" style="padding:0;">Keine weiteren Buchungen dieser Firma.</p>';

  return `
    <tr class="expand-row ${neu ? 'buchung-neu' : ''}" onclick="buchungenToggleVerlauf('${buchung.id}')">
      <td class="cell-strong">${teilnehmer.name}</td>
      <td>${teilnehmer.firma} ${teilnehmer.bestandskunde ? '<span class="badge badge-green">Bestandskunde</span>' : ''}</td>
      <td class="truncate" style="max-width:200px;" title="${teilnehmer.email}">${teilnehmer.email}</td>
      <td>${anmeldestatusBadgeHtml(buchung.anmeldestatus)}</td>
      <td>${kurs.titel} <span style="color:var(--muted2);">· ${formatiereDatum(termin.datum)}</span></td>
      <td onclick="event.stopPropagation();"><button class="btn btn-ghost-red" onclick="buchungenEntfernen('${buchung.id}')">Entfernen</button></td>
    </tr>
    <tr id="buchung-verlauf-${buchung.id}" style="display:none;">
      <td colspan="6" style="background:var(--card-2); padding:10px 14px 14px 34px;">
        <div class="mat-group-label" style="margin:0 0 6px 0;">Buchungshistorie ${teilnehmer.firma}</div>
        ${historieHtml}
      </td>
    </tr>`;
}

function renderBuchungen() {
  const tbody = document.getElementById('buchungen-tabelle');
  if (!tbody) return;
  buchungenAktualisiereKursFilterOptionen();

  const statusFilter = document.getElementById('buchungen-status-filter').value;
  const kursFilter = document.getElementById('buchungen-kurs-filter').value;

  const buchungen = buchungenSortiertNeuesteZuerst().filter(b => {
    if (statusFilter && b.anmeldestatus !== statusFilter) return false;
    if (kursFilter) {
      const gefunden = findeTerminMitKurs(b.terminId);
      if (!gefunden || gefunden.kurs.id !== kursFilter) return false;
    }
    return true;
  });

  tbody.innerHTML = buchungen.map(buchungenZeile).join('') ||
    '<tr><td colspan="6" class="empty-hint">Keine Buchungen gefunden.</td></tr>';
}

function buchungenToggleVerlauf(buchungId) {
  const zeile = document.getElementById(`buchung-verlauf-${buchungId}`);
  zeile.style.display = zeile.style.display === 'table-row' ? 'none' : 'table-row';
}

function buchungenEntfernen(buchungId) {
  if (confirm('Diese Buchung wirklich entfernen?')) {
    loescheBuchung(buchungId);
  }
}
```

- [ ] **Step 3: page-buchungen.js — „Neue Buchung"-Dialog anhängen**

```javascript
function oeffneNeueBuchungDialog() {
  const personenOptionen = window.STATE.teilnehmer
    .map(t => `<option value="${t.id}">${t.name} — ${t.firma}</option>`).join('');
  const terminOptionen = window.STATE.kurse.map(k => `
    <optgroup label="${k.titel}">
      ${k.termine.map(t => `<option value="${t.id}">${formatiereDatum(t.datum)} · ${t.trainer}</option>`).join('')}
    </optgroup>`).join('');

  oeffneDialog(`
    <div class="dialog-head"><h3>Neue Buchung</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form onsubmit="return speichereNeueBuchung(event)">
      <div class="dialog-body">
        <div class="field">
          <label>Person</label>
          <select name="teilnehmerId" onchange="buchungenToggleNeuePersonFelder(this.value)">
            <option value="__neu__">— Neue Person —</option>
            ${personenOptionen}
          </select>
        </div>
        <div id="buchungen-neue-person-felder">
          <div class="field"><label>Name</label><input name="name" /></div>
          <div class="field"><label>Firma</label><input name="firma" /></div>
          <div class="field"><label>E-Mail</label><input type="email" name="email" /></div>
        </div>
        <div class="field"><label>Termin</label><select name="terminId" required>${terminOptionen}</select></div>
        <div class="field">
          <label>Anmeldestatus</label>
          <select name="anmeldestatus">
            <option value="angemeldet">angemeldet</option>
            <option value="bestätigt">bestätigt</option>
          </select>
        </div>
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Buchen</button>
      </div>
    </form>`);
}

function buchungenToggleNeuePersonFelder(wert) {
  document.getElementById('buchungen-neue-person-felder').style.display = wert === '__neu__' ? 'flex' : 'none';
}

function speichereNeueBuchung(ev) {
  ev.preventDefault();
  const felder = formularWerte(ev.target);
  let teilnehmerId = felder.teilnehmerId;
  if (teilnehmerId === '__neu__') {
    teilnehmerId = erstelleTeilnehmer({
      name: felder.name, firma: felder.firma, email: felder.email, bestandskunde: false,
    });
  }
  erstelleBuchung({ teilnehmerId, terminId: felder.terminId, anmeldestatus: felder.anmeldestatus });
  schliesseDialog();
  return false;
}
```

- [ ] **Step 4: Build + manuelle Verifikation im Browser**

Run: `python Design/assemble.py`

Im Claude Browser Pane, Seite „Buchungen" öffnen:
- Tabelle zeigt eine Zeile pro Buchung, neueste zuerst; Zeilen mit kürzlichem `gebuchtAm` haben einen Teal-Streifen links (`.buchung-neu`)
- Filter „Anmeldestatus" und „Kurs" schränken die Liste sichtbar ein; Firma-Filter existiert bewusst **nicht** mehr
- Klick auf eine Zeile klappt die Buchungshistorie der Firma darunter auf (welche Kurse, wie oft) — zweiter Klick klappt wieder zu
- „+ Neue Buchung" → bestehende Person + Termin wählen, speichern → neue Zeile erscheint oben (da `gebuchtAm` = heute) und ist als „neu" hervorgehoben
- „Entfernen" bei einer Buchung (mit Bestätigung) lässt sie verschwinden, ohne dass sich die Seite dabei zuklappt (Klick-Propagation auf der Aktionsspalte gestoppt)
- Keine Konsolenfehler

- [ ] **Step 5: Commit**

```bash
git add Design/fragments/page-buchungen.html Design/fragments/page-buchungen.js Berichte/index.html
git commit -m "feat: Buchungen-Seite ersetzt Teilnehmer- und Kunden-Ansicht"
```

---

## Task 11: Zusammenbau & Ende-zu-Ende-Verifikation

**Files:**
- Modify: `Berichte/index.html` (finaler Build-Output, keine manuellen Edits — nur über `assemble.py`)

**Interfaces:**
- Consumes: alle vorherigen Tasks
- Produces: fertige, geprüfte `Berichte/index.html`

- [ ] **Step 1: Sauberen Build erzeugen**

Run: `python Design/assemble.py`
Expected: `Geschrieben: ...Berichte\index.html ... Zeichen` ohne Fehler.

- [ ] **Step 2: Browser-Konsole und Grundzustand prüfen**

Im Claude Browser Pane: `localStorage.clear()` ausführen, Seite neu laden (frischer Zustand aus den Beispieldaten), dann `read_console_messages` mit `onlyErrors: true` prüfen.
Expected: keine Fehler; `window.STATE.kurse.length === 8`.

- [ ] **Step 3: Kernszenario des Nutzers durchklicken (Teilnehmer bei zu geringer Auslastung verschieben)**

1. „Übersicht" öffnen, Kurszeile „Arbeitssicherheit Basisschulung" aufklappen
2. Prüfen: erster Termin (30.07.2026) zeigt „Ausgebucht" (Indigo-Badge), zweiter Termin (15.10.2026) zeigt „7 Plätze frei"
3. Zu „Schulungen" wechseln, bei „Arbeitssicherheit Basisschulung" den ausgebuchten Termin öffnen
4. Bei „Teilnehmer dieses Termins" eine Buchung per „Entfernen" löschen (simuliert das Verschieben aus dem vollen Termin)
5. Zurück zu „Schulungen", den zweiten Termin (15.10.2026) öffnen, „+ Teilnehmer" klicken, dieselbe Person aus der Liste auswählen, Status „bestätigt", speichern
6. Zurück zur Übersicht: der zweite Termin zeigt jetzt „6 Plätze frei" statt „7 Plätze frei"

Expected: Alle Schritte funktionieren ohne Konsolenfehler, die Auslastungsanzeige aktualisiert sich sofort nach jeder Aktion.

- [ ] **Step 4: Restliche CRUD-Flows durchklicken**

- Neuen Kurs anlegen, dazu einen Termin, dazu über die Detailseite eine Agenda, Lernziele, eine Checkliste abhaken und einen zusätzlichen Checklistenpunkt hinzufügen, eine Testdatei in „Vorlagen-Bibliothek" hochladen und wieder herunterladen
- Auf „Buchungen" wechseln, „+ Neue Buchung" für eine neue Person nutzen, danach die Zeile aufklappen und die Buchungshistorie prüfen
- Den zuvor angelegten Test-Kurs wieder löschen (inkl. Bestätigungsdialog) und sicherstellen, dass seine Buchungen aus der Buchungen-Seite verschwunden sind

Expected: Keine Konsolenfehler, keine hängenden Dialoge, alle Listen aktualisieren sich sofort.

- [ ] **Step 5: Persistenz, Export/Import/Reset prüfen**

1. Seite neu laden (F5) → alle in Step 3–4 vorgenommenen und nicht wieder gelöschten Änderungen sind noch da (localStorage)
2. „Exportieren" klicken → Download einer `schulungsplaner-export-<Datum>.json` wird ausgelöst
3. „Zurücksetzen" klicken, Bestätigung annehmen → `window.STATE.kurse.length` ist wieder `8`, alle Testdaten aus Step 3–4 sind weg
4. Die in Schritt 2 exportierte Datei über „Importieren" wieder einlesen → der Zwischenstand mit den Testdaten ist wiederhergestellt

Expected: Jeder der vier Schritte funktioniert wie beschrieben, keine Konsolenfehler.

- [ ] **Step 6: Umlaute im finalen Output stichprobenartig prüfen (CLAUDE.md-Pflicht)**

Run: `python -c "c = open('Berichte/index.html', encoding='utf-8').read(); assert 'für' in c and 'Grundlagenschulung' in c and '�' not in c and 'Ã¤' not in c, 'Umlaute defekt'; print('Umlaute ok, Länge:', len(c))"`

Zusätzlich im Browser: Seite „Buchungen" öffnen, Teilnehmer mit Umlaut im Namen/Firma suchen (z. B. „Paul Krüger", „Bäckerei Feinbrot GmbH") und per Sichtprüfung bestätigen, dass Umlaute korrekt angezeigt werden (nicht als `�` oder `?`).

- [ ] **Step 7: Abschließenden Zustand zurücksetzen und committen**

Nach der Verifikation in Step 3–5 wurden testweise Kurse/Buchungen angelegt und teilweise wieder gelöscht — vor dem finalen Commit einmal „Zurücksetzen" im Browser klicken, damit der ausgelieferte `localStorage`-unabhängige Ausgangszustand von `Berichte/index.html` exakt den migrierten Beispieldaten entspricht (der `localStorage` selbst ist Browser-lokal und nicht Teil des Commits).

```bash
git add Berichte/index.html
git commit -m "chore: finaler Build nach Ende-zu-Ende-Verifikation aller CRUD-Flows"
```

---

## Selbst-Review-Notizen (bereits eingearbeitet)

- **Spec-Abdeckung:** Kurs/Termin/Buchung-Datenmodell (Task 1–3), Persistenz + Export/Import/Reset (Task 2), Datei-Ablage (Task 4), 3-Punkte-Sidebar (Task 5), Design-Bereinigung (Task 6), Übersicht als Navigator mit Zwei-Termine-Ansicht + Ausklappen (Task 7), Kurs/Termin-CRUD (Task 8), Schulungsdetail mit allen fünf Abschnitten inkl. Materialien-Upload (Task 9), Buchungen mit Historie-Ausklappung (Task 10) — jede Spec-Zeile aus `Design/design-spec.md` hat eine Entsprechung.
- **Platzhalter-Scan:** keine TBD/TODO; jeder Code-Schritt enthält vollständigen, lauffähigen Code statt Beschreibungen.
- **Typ-Konsistenz geprüft:** `findeTerminMitKurs` liefert konsequent `{kurs, termin}` (nicht umgekehrt) und wird so in Task 8/9/10 verwendet; `terminAuslastung(terminId)` liefert konsequent `{belegt, kapazitaet, frei, prozent}`; `oeffneDialog`/`schliesseDialog`/`formularWerte`/`formatiereDatum`/`statusBadgeHtml`/`anmeldestatusBadgeHtml` aus `ui-helpers.js` (Task 5) werden in Task 7–10 mit identischer Signatur aufgerufen.
- **Bewusste Vereinfachungen:** Checklistenpunkt-Hinzufügen nutzt `prompt()` statt eines eigenen Dialogs (ein einzelnes Textfeld, kein eigenes Formular nötig); Kurs-Löschen/Termin-Löschen/Buchung-Löschen nutzen alle das native `confirm()` statt eines gestylten Bestätigungsdialogs — beides bewusst schlank gehalten, da funktional ausreichend (siehe Nutzer-Feedback „keine Spielereien").

