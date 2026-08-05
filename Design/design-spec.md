# Design-Spec: Schulungsplaner (v2 – interaktives Arbeitswerkzeug)

> Ersetzt die ursprüngliche v1-Spec (reiner Klickprototyp). Diese Version macht aus dem Prototyp ein echtes, dauerhaft nutzbares Planungswerkzeug.

## Kontext & Ziel

Der Schulungsplaner dient der effizienten Planung gebuchter Schulungen: Kurse mit mehreren Terminen im Jahr, Teilnehmerzuordnung, Verschieben zwischen Terminen bei zu geringer Auslastung, Vorbereitung (Checkliste) und Bereitstellung von Kursinhalten. Jede Funktion muss einem konkreten Planungszweck dienen – keine Spielereien oder rein dekorative Features.

Technisch bleibt es ein einzelnes selbsterklärendes HTML/CSS/JS-Dokument (`index.html`, kein Server/Build-Tool außer dem lokalen `assemble.py`, per Doppelklick lauffähig), im tribeta-Design (siehe Wurzel-`CLAUDE.md`). Neu: die Seiten rendern sich aus einem zentralen State statt aus festem HTML, und Änderungen (neue Kurse, Buchungen, Checklisten, Datei-Uploads) werden dauerhaft im Browser gespeichert.

## Datenmodell

- **Kurs** – der inhaltliche Rahmen, gleich über alle Termine hinweg: `id`, `titel`, `kategorie`, `beschreibung`, `lernziele[]`, `zielgruppe`, `voraussetzungen`, `agenda[]` (`{zeit, titel, beschreibung}`), `materialien.seminarunterlagen[]` (feste Kursunterlagen), `materialien.vorlagen[]` (freie Ressourcen-Bibliothek, z. B. Musterdokumente für die Umsetzung)
- **Termin** – eine konkrete Durchführung eines Kurses: `id`, `kursId`, `datum`, `trainer`, `format` (Online/Vor Ort), `ort`, `kapazitaet`, `status` (geplant/laufend/abgeschlossen), `checkliste[]` (`{label, erledigt}`, individuell pro Termin, da Vorbereitung terminabhängig ist – Raum, Technik, Unterlagen)
- **Teilnehmer** (Person) – `id`, `name`, `firma`, `email`, `bestandskunde` (bool)
- **Buchung** – verknüpft Teilnehmer × Termin: `id`, `teilnehmerId`, `terminId`, `anmeldestatus` (angemeldet/bestätigt/abgesagt), `gebuchtAm` (Datum, neu – Grundlage für „neueste Buchungen zuerst")
- **Datei** (für Materialien) – in IndexedDB gespeichert (Name, Typ, Binärinhalt), referenziert aus `materialien.seminarunterlagen[]`/`materialien.vorlagen[]`

Für die bestehenden Beispieldaten werden beim Umbau plausible `gebuchtAm`-Werte ergänzt (aktuell nicht vorhanden) und die heutigen Einzel-Schulungen zu Kurs+Termin gruppiert (Kurse mit gleichem Titel/Kategorie werden zu einem Kurs mit mehreren Terminen zusammengeführt, wo inhaltlich sinnvoll; ansonsten bleibt ein Kurs mit einem Termin).

## Architektur

- Zentrales State-Objekt (Weiterentwicklung von `window.DATA`), jede Seite hat eine `render*()`-Funktion, die bei jeder Änderung neu zeichnet
- **Persistenz:** Textdaten (Kurse, Termine, Buchungen, Teilnehmer) automatisch in `localStorage` bei jeder Änderung; Dateien (Materialien) in `IndexedDB` (deutlich höheres Speicherlimit als `localStorage`); Daten werden beim Öffnen der Datei aus dem gespeicherten Stand geladen, nicht aus den Beispieldaten
- **Export/Import:** Knopf zum Herunterladen des aktuellen Stands als JSON (Backup/Teilen) sowie Import einer solchen Datei; „Auf Beispieldaten zurücksetzen" als Notausgang
- Build-Prozess bleibt `Design/assemble.py` (Shell + gemeinsames CSS + Seiten-Fragmente + Beispieldaten → `Berichte/index.html`)

## Navigation

Sidebar mit 3 Punkten: **Übersicht, Schulungen, Buchungen** (die bisherige eigene „Kunden"-Seite entfällt, ihre Information fließt in Buchungen ein).

## Seiten

### 1. Übersicht – Navigator für die häufigsten Fragen

- Keine Kennzahlen-Kacheln (entfernt, da nichtssagend)
- „Auslastung je Kurs": pro Kurs werden die **zwei nächsten Termine** nebeneinander angezeigt (Datum, Auslastungsbalken, „X Plätze frei" / „Ausgebucht" je Termin) – Kernzweck: auf einen Blick erkennen, ob im nächsten Termin noch Platz ist, um Teilnehmer bei zu geringer Auslastung dorthin zu verschieben
- Jede Kurszeile ist aufklappbar und zeigt dann direkt die Namen der aktuell zugeordneten Teilnehmer je Termin (ohne Seitenwechsel)
- „Nächste anstehende Termine" bleibt als chronologische Liste zur Orientierung unverändert

### 2. Schulungen – Kurs- und Terminverwaltung

- Liste zeigt Kurse; Termine je Kurs sind aufklappbar (Datum, Trainer, Status, Auslastung)
- Aktionen: „+ Neuer Kurs" (Dialog: Titel, Kategorie, Beschreibung, erste Lernziele) und „+ Neuer Termin" zu bestehendem Kurs (Dialog: Datum, Trainer, Format/Ort, Kapazität)
- Kurs/Termin bearbeiten und löschen (Löschen mit Bestätigungsdialog, da destruktiv)
- Klick auf einen Termin → Schulungsdetail-Seite dieses Termins

### 3. Schulungsdetail (ein Termin) – Layout: ein Scroll mit Sprungmarken-Navigation

Kopfkarte (Kurstitel, Kategorie- und Status-Badge, Datum/Trainer/Format-Ort/Kapazität, Auslastungsbalken, Aktionen „Bearbeiten"/„+ Teilnehmer") + linke Sprungmarken-Navigation zu:

- **Beschreibung & Lernziele** (kursweit, inline editierbar)
- **Agenda** (kursweit, Programmpunkte hinzufügen/bearbeiten/entfernen/umsortieren)
- **Materialien** (kursweit): Block „Seminarunterlagen" (feste Kursunterlagen, Datei-Upload/Ersetzen/Löschen) und Block „Vorlagen-Bibliothek" (frei beliebig viele zusätzliche Dateien mit Titel/Beschreibung, z. B. Vorlagen die bei der Umsetzung des Kursinhalts helfen)
- **Checkliste** (pro Termin): abhakbar, Punkte hinzufügen/entfernen; beim Anlegen eines neuen Termins wird eine Standard-Vorlage kopiert (Raum gebucht, Technik geprüft, Unterlagen gedruckt, Einladungen versendet, Zertifikate vorbereitet) und ist danach frei anpassbar
- **Teilnehmer dieses Termins**: „+ Teilnehmer hinzufügen" (bestehende Person wählen oder neu anlegen → erzeugt Buchung, mit Warnung bei Buchung in einen vollen Termin), Anmeldestatus je Zeile per Dropdown ändern, „Verschieben" auf einen anderen Termin desselben Kurses (behält `gebuchtAm`/Anmeldestatus bei — das ist die konkrete Umsetzung des eingangs genannten Kernzwecks „Verschieben zwischen Terminen bei zu geringer Auslastung"), Teilnehmer entfernen (Buchung löschen)

### 4. Buchungen – ersetzt die bisherigen Seiten „Teilnehmer" und „Kunden"

- Eine Zeile pro Buchung (Person × Termin), sortiert nach `gebuchtAm` (neueste zuerst), neue/kürzliche Buchungen optisch hervorgehoben
- Spalten: Name, Firma (mit Bestandskunde-Badge), E-Mail (gekürzt mit Tooltip), Anmeldestatus, gebuchter Kurs/Termin
- Zeile aufklappbar → bisherige Buchungshistorie dieser Firma (welche Kurse, wie oft gebucht) – ersetzt die frühere eigenständige Kunden-Seite
- Filter: Anmeldestatus und **Kurs** (kein Firma-Filter mehr, da uninteressant)
- „+ Neue Buchung" (Person auswählen/neu anlegen + Termin wählen)

## Visueller Stil / Design-Bereinigung

tribeta-Tokens (Poppins/Mulish, Teal/Indigo/Lime/Ink-Palette, siehe Wurzel-`CLAUDE.md`) bleiben Basis, werden aber diesmal konsequent app-weit über `Design/styles.css` verwendet statt seitenspezifisch variiert:

- Einheitlicher Seitenkopf auf allen Listen-Seiten: Titel + Unterzeile + primäre Aktion rechts
- Tabellen mit fester Zeilenhöhe; lange Inhalte (E-Mail, mehrere Kurse) gekürzt mit Tooltip bzw. Ausklapp-Chip statt Zeilenumbruch
- Eine einzige Status-Farb-Zuordnung app-weit: Grün = bestätigt/aktiv, Amber = angemeldet/geplant, Grau = abgeschlossen, Rot = abgesagt, Indigo = ausgebucht/voll
- Ausklapp-Interaktion (Übersicht-Kurszeilen, Buchungs-Kundenhistorie) folgt demselben visuellen Muster app-weit

## Umsetzung

1. **Fundament (seriell):** Datenmodell umbauen (`Daten/schulungsdaten.json` → Kurse mit verschachtelten Terminen, Buchungen mit `gebuchtAm`), Persistenz-Layer (localStorage/IndexedDB, Export/Import/Reset), zentrale Render-/State-Engine in `Design/shell-template.html`, neue 3-Punkte-Sidebar
2. **Parallele Subagents je Seite** (Übersicht, Schulungen inkl. Detailseite, Buchungen), jeweils mit `frontend-design`-Skill und den bereinigten Design-Vorgaben oben
3. **Zusammenbau** über `Design/assemble.py` zu `Berichte/index.html`
4. **Manuelle Prüfung** (kein Server/Backend, daher kein automatisierter Test-Runner): alle CRUD-Flows im Browser durchklicken – Kurs/Termin anlegen, Teilnehmer buchen/Status ändern/verschieben, Checkliste abhaken, Datei hochladen/herunterladen, Export/Import, Seite neu laden und prüfen dass Stand erhalten bleibt

## Aus dem Scope ausgeschlossen (bewusst)

- Kein Server/Backend, keine Mehrbenutzer-Synchronisation – Daten liegen lokal im Browser des jeweiligen Nutzers
- Keine eigenständige „Kunden"-Seite mehr (siehe oben, Information lebt jetzt in Buchungen)
- Keine Kennzahlen-Kacheln auf der Übersicht
