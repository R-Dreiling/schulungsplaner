# HANDOFF — Schulungsplaner

Stand: Ende der Session, Branch `feature/kurs-termin-buchung`, HEAD `a6d36d4`.
Arbeitsbaum sauber, **keine Datei in einem halbfertigen Zustand**.

**Projektpfad seit dem Umzug:**
`C:\Hinschg\OneDrive - HinSchG Meldungen GbR\Claude-tribeta-Tools\Schulungsplaner`

Das alte Verzeichnis unter `Desktop\Persönlich\Claude Code\Projekt-Systeme\Schulungsplanner`
existiert noch als Rückfallebene und **kann gelöscht werden**, sobald OneDrive
einmal durchsynchronisiert hat. Die Wurzel-`CLAUDE.md` mit den tribeta-Designregeln
liegt weiterhin am alten Ort und gilt hier **nicht mehr automatisch** — die
relevanten Regeln stehen in der projektlokalen `CLAUDE.md`.

## Was das ist

Lokales, serverloses Werkzeug für die **tribeta GmbH** zur Planung und
Nachweisführung von Schulungen. Eine einzige `Berichte/index.html`, per
Doppelklick oder als App-Fenster lauffähig, ohne Server und ohne Internet.

## Stand: einsatzbereit, in der Testphase

Fertig und im Einsatz: Kurse/Termine/Buchungen, Trainer mit Nachweisen,
Anwesenheit mit 80-%-Regel, Bescheinigungen, Abschluss mit Festschreibung,
Abschlussbericht, Anwesenheitsliste, Arbeitgebernachweis, fällige
Auffrischungen, Sammelbuchung, Ablage in einen Ordner, gemeinsamer
Datenbestand, PDF-Erzeugung.

### Zuletzt gebaut (diese Session)

| Commit | Inhalt |
|---|---|
| `9f43f34` | Auffrischungen, Arbeitgeber-Nachweis, Sicherungserinnerung — dabei **Datumsfehler** gefunden: `toISOString()` verschob alle Daten um einen Tag |
| `f7b6c4c` | Teilnehmer sammelweise buchen (Excel/CSV einfügen) |
| `94fdc85` | Ablage der Dokumente in einen Ordner |
| `48d173e` | Ablageordner sichtbar, alles auf einmal ablegen |
| `fced2d7` | **Gemeinsamer Datenbestand** im Ablageordner |
| `a6d36d4` | **PDF-Erzeugung** über Chrome headless |

## Die drei Bausteine, die man verstanden haben muss

**1. Ablage** (`Design/fragments/ablage.js`)
Ordner wird einmal über `showDirectoryPicker()` gewählt, der Zugriff liegt in
IndexedDB. Dokumente landen als HTML unter `Schulungen/<Datum Kurs>/…`,
Sicherungen unter `Sicherungen/`. Ein ungültiger gespeicherter Eintrag gilt als
„kein Ordner gewählt" (`istOrdnerZugriff`) — vorher zerlegte er die Oberfläche.

**2. Gemeinsamer Datenbestand**
`Schulungsplaner-Daten.json` im Ablageordner ist die Wahrheit, `localStorage`
nur die schnelle Kopie. Beim Start wird die Datei geladen, jede Änderung
gebündelt (1,2 s) zurückgeschrieben. Vor dem Schreiben prüft die App den
Zeitstempel: fremd geändert → **nicht schreiben**, sondern melden.
**Grenze:** kein echter Mehrbenutzerbetrieb. Gleichzeitiges Arbeiten führt zu
Konflikten; nacheinander ist sicher.

**3. PDF**
Die App kann keine PDFs erzeugen — ein PDF entsteht erst im Druckdialog.
`Design/pdf_erzeugen.py` (bzw. `PDFs-erzeugen.cmd`) lässt Chrome headless über
den Ablageordner laufen und erzeugt zu jedem HTML ein PDF. Absolute Pfade sind
Pflicht, eigenes Browserprofil je Lauf ebenfalls.

## Offen

- **Node.js ist NICHT installiert** (Registry geprüft). Sobald es da ist:
  automatisierte Tests für die Nachweislogik (Anwesenheitsgrenze,
  Zertifikatsnummern, Auffrischungsfristen, Datumsrechnung), Start über
  lokalen Server (dauerhafte Ordnerberechtigung).
- **Echter Mehrbenutzerbetrieb** braucht eine gehostete Fassung mit Datenbank.
  Dieselbe Grundlage benötigen die geplanten Schnittstellen zu **sevDesk**
  (Rechnungen) und zur **Website** (Buchungen). Eine Entscheidungsvorlage dazu
  wurde angeboten, aber noch nicht geschrieben.
- **Handelsregisternummer und USt-IdNr.** fehlen im Fuß der Bescheinigung —
  sobald die Eintragung durch ist, im Dialog „Unterschrift & Stempel" ergänzen.
- Vom Nutzer noch nicht rückgemeldet: ob die Partner sich mit dem gemeinsamen
  Ordner verbinden können und ob beim Abschluss alle Dokumente im richtigen
  Unterordner landen.

## Feste Regeln (Auszug, vollständig in CLAUDE.md)

- `Berichte/index.html` **nie von Hand** bearbeiten — immer `python Design/assemble.py`.
- Sperrzustand über `istTerminAbgeschlossen()`, nie über `!!termin.abschluss`.
- Datumsangaben nie über `toISOString()` — `heuteIso()`, `inTagenIso()`, `alsIsoDatum()`.
- Bescheinigungen nur einzeln, nie als Sammeldokument.
- Zertifikatsnummern erst beim tatsächlichen Druck vergeben.
- Firmierung **tribeta GmbH**, keine erfundenen Angaben auf Dokumenten.

## Umgebung

**Build:** `python Design/assemble.py` — reproduzierbar (byte-identisch).
**Datenprüfung:** `python Design/verify_migration_v3.py` — grün.
**Automatisierte Tests:** keine (kein Node.js).

**Prüftechniken, die sich bewährt haben:**
- Druckvorlagen mit Chrome headless rendern (`--screenshot`, `--print-to-pdf`)
  und das Bild ansehen — so wurden Layoutfehler gefunden, die reine
  DOM-Messungen nicht zeigten.
- PDFs mit `pypdf` gegenprüfen: Seitenzahl, Format, eingebettete Bilder, Text.
- Testfassungen der App **immer am letzten** `</body>` einhängen
  (`rpartition`) — ein globales `replace` trifft das `</body>` im
  Template-String von `ablageDokumentHtml` und zerlegt das Skript.
- Der Browser-Vorschaubereich zeigt Dateien außerhalb des Arbeitsverzeichnisses
  nur als statisches Abbild ohne JavaScript. Für interaktive Prüfungen eine
  Kopie ins Arbeitsverzeichnis legen und danach löschen.

**Eigenheiten:**
- Bash zeigt Umlaute falsch an, auch wenn die Datei korrekt ist — immer am
  Dateiinhalt prüfen.
- `window.print()` blockiert die Umgebung — nie aufrufen.
- PowerShell-Here-Strings kommen bei `git commit -F -` nicht an; Commit-Text in
  eine Datei schreiben und mit `-F <datei>` übergeben.
