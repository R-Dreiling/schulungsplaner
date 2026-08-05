# CLAUDE.md — Schulungsplaner

Projektspezifische Regeln. Die Wurzel-`CLAUDE.md` eine Ebene höher gilt zusätzlich
(tribeta-Design, Umlaut-Prüfung, Ordnerstruktur) und hat bei Konflikten Vorrang.

## Was das ist

Lokales, serverloses Einzelplatz-Werkzeug zur Planung und **Nachweisführung** von
Schulungen. Eine einzige `Berichte/index.html`, per Doppelklick lauffähig, ohne Server
und ohne Internetverbindung. Daten im `localStorage`, hochgeladene Dateien in `IndexedDB`.

Nachweisfähigkeit ist der Kern: Für Datenschutz- und Arbeitssicherheitsschulungen muss
Jahre später belegbar sein, dass Schulung X am Datum Y mit Personen Z stattfand.

## Build

```bash
python Design/assemble.py
```

Baut `Berichte/index.html` aus `shell-template.html` + `styles.css` + JS-Modulen +
Fragmenten + `Daten/schulungsdaten.json`.

- **`Berichte/index.html` niemals von Hand bearbeiten.** Immer die Quelle ändern und neu bauen.
- **Jeder Commit, der Quellen ändert, enthält die neu gebaute `Berichte/index.html`.**
- `assemble.py` ersetzt Platzhalter per naivem `str.replace` über das **ganze** Dokument.
  **Niemals** die Platzhalter-Zeichenfolge (doppelte geschweifte Klammern) in einem
  Kommentar oder String schreiben — sie wird mitersetzt und zerstört den Build.

## Prüfen

```bash
python Design/verify_migration_v3.py   # Datenintegritaet, muss gruen sein
```

Es gibt **keine automatisierten Tests**: kein Node.js auf dieser Maschine, kein
JS-Testrunner, keine CI. UI-Verifikation läuft manuell im Browser über die
Claude-Browser-Werkzeuge gegen die gebaute `Berichte/index.html`.

Die Migrationsskripte (`migrate_data*.py`) sind **Einmal-Skripte**. Nicht erneut
ausführen — sie brechen bewusst ab, wenn die Daten bereits migriert sind.

## Umgebungs-Eigenheiten

- Bash zeigt auf dieser Windows-Maschine Umlaute falsch an, **auch wenn die Datei korrekt
  ist**. Umlaute immer am Dateiinhalt prüfen (Python `repr()` oder Read-Werkzeug),
  niemals an der Terminalausgabe.
- Die Browser-Vorschau unterdrückt natives `confirm()`/`alert()`. Für Abläufe, die darauf
  warten: `window.confirm = () => true` in der Konsole setzen und das offenlegen.
- Die Vorschau liefert auf dem `file://`-Pfad manchmal veralteten In-Memory-Zustand nach
  einem Reload. Workaround: `window.STATE` aus `window.SEED_DATA` zurücksetzen.
- **`window.print()` niemals aufrufen** — es blockiert die Umgebung. Druckvorlagen prüfen,
  indem man das erzeugte HTML in `#druck-bereich` injiziert und das DOM ausliest.
- Vor jeder Browser-Verifikation `localStorage.clear()` und neu laden; danach wieder
  aufräumen.

## Datenmodell

```
Kurs (k*)      titel, kategorie, beschreibung, lernziele, voraussetzungen,
               format, minTeilnehmer, maxTeilnehmer,
               zertifikat{kuerzel, umfangUE, ueberschrift, bestaetigungstext, gueltigkeit},
               agenda[], materialien{seminarunterlagen[], vorlagen[]}, termine[]
Termin (s*|tm*) datum, trainerId, vertretungTrainerId, ort, status, checkliste[], abschluss
Teilnehmer (t*) name, firma, email, bestandskunde
Trainer (tr*)   name, email, telefon, qualifikation, notizen, dokumente[]
Buchung (b*)    teilnehmerId, terminId, anmeldestatus, gebuchtAm,
                anwesenheitProzent, fehlgrund, zertifikatNr, statusManuell
Datei (d*)      Inhalt in IndexedDB, Referenz im State
einstellungen   zertifikatStartNummer (147), bestaetigungsfristTage (7)
```

**Kursweit** (gilt für alle Termine): Beschreibung, Lernziele, Agenda, Materialien,
Format, Min/Max, Zertifikatsfelder.
**Pro Termin**: Datum, Trainer, Vertretung, Ort, Status, Checkliste, Anwesenheit,
Teilnehmer, Abschluss.

Neue IDs immer über `naechsteId(praefix, liste)`. Präfixe nicht vermischen — `t` ist
Teilnehmer, `tm` ist ein neu angelegter Termin.

## Feste Regeln

- **Sperrzustand immer über `istTerminAbgeschlossen(terminId)` prüfen, niemals über
  `!!termin.abschluss`.** Das `abschluss`-Objekt bleibt nach dem Wiederöffnen als
  Nachweisspur bestehen; nur die Kombination aus `abschluss` **und**
  `status === 'abgeschlossen'` bedeutet „gesperrt". Einzige Ausnahme: das Abschluss-Banner
  erscheint bei vorhandenem `abschluss`, damit die Historie sichtbar bleibt.
- **Mindestteilnahme 80 %** (`MINDEST_ANWESENHEIT`). Bescheinigungen erst ab diesem Wert.
- **Bescheinigungen ausschließlich einzeln erzeugen**, nie als Sammeldokument — sonst
  gingen beim Versand an eine Person die Daten aller anderen mit. Der Abschlussbericht
  ist das bewusste Gegenteil: er enthält alle Teilnehmer, ist aber ein **internes**
  Archivdokument.
- **Zertifikatsnummern erst beim tatsächlichen Druck vergeben**, nicht beim Rendern einer
  Liste. Einmal vergeben, bleiben sie stabil. Laufnummer ist das **letzte**
  Bindestrich-Segment (ein Kürzel darf selbst Bindestriche enthalten).
- **Abgesagte Buchungen zählen nie zur Auslastung, Anwesenheit oder Bescheinigung.**
- **Nachweisspuren nie überschreiben.** `wiedereroeffnungen` bleibt beim erneuten
  Abschließen erhalten.
- Änderungen laufen über die Mutatoren in `state-engine.js`; die rufen `speichereState()`,
  das persistiert und `renderAll()` auslöst. **Rendern bleibt seiteneffektfrei** — keine
  Datenänderung während des Renderns.
- Mutatoren, die bei gesperrtem Termin werfen können, in der Oberfläche über
  `detailVersuche(...)` aufrufen, damit die Nutzerin die Meldung sieht.

## Escaping

Drei Helfer in `Design/ui-helpers.js`, nicht verwechseln:

| Kontext | Helfer |
|---|---|
| Text als HTML-Inhalt | `escHtml()` |
| Attributwert | `escAttr()` |
| JS-String-Argument in einem Inline-Handler | `escJsArg()` |

Bei Vorlagen mit Platzhaltern: **erst die Vorlage escapen, dann die bereits escapten
Werte einsetzen.** Geschweifte Klammern überstehen `escHtml` unverändert.

## Design

Tokens ausschließlich aus `Design/styles.css` (Poppins/Mulish, Teal `#2BD5D8`/`#0B8A8D`,
Indigo `#6C7BFF`/`#4D5EE6`, Lime `#BFF247`/`#7FAE13`, Ink `#0A1028`). Keine neuen
Akzentfarben, keine hartkodierten Hex-Werte.

Status-Farben app-weit einheitlich:
Grün = bestätigt/aktiv/laufend/erfüllt · Amber = angemeldet/geplant/unterbesetzt ·
Grau = abgeschlossen/neutral · Rot = abgesagt/Fehler/unter Mindestteilnahme ·
Indigo = ausgebucht/voll

Zwei Logos, nicht vertauschen: `logo-invers.b64.txt` (weiß, dunkle Titelleiste) und
`logo.b64.txt` (dunkel, Druck auf weißem Papier).

Destruktive oder folgenreiche Aktionen über natives `confirm()` bestätigen.

## Sprache

Deutsch durchgehend — Oberfläche, Funktions- und Variablennamen, Commit-Nachrichten.
Umlaute korrekt als UTF-8 in allen ausgelieferten Dateien.

## Arbeitsweise

Jede Funktion muss einem konkreten Planungs- oder Nachweiszweck dienen — keine
dekorativen Spielereien. Vor größeren Änderungen die Spezifikation lesen
(`Design/design-spec-v3.md`) und den zugehörigen Plan
(`Design/implementation-plan-v3-phase*.md`), die den vollständigen Code je Arbeitsschritt
enthalten.
