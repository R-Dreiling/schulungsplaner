# Design-Spec v3: Schulungsplaner – Stammdaten, Durchführung und Nachweisführung

> Baut auf `Design/design-spec.md` (v2, umgesetzt und ausgeliefert) auf. Diese Spec beschreibt ausschließlich die Erweiterungen; alles in v2 Beschriebene gilt unverändert weiter, soweit hier nichts anderes steht.

## Kontext & Ziel

v2 hat aus dem Klickprototyp ein echtes Planungswerkzeug gemacht: Kurse mit mehreren Terminen, Buchungen, Verschieben zwischen Terminen, Materialien, Checklisten.

v3 schließt zwei Lücken:

1. **Stammdatenpflege** – Kategorien, Trainer und Teilnehmerzahlen sind heute teils fest verdrahtet, teils bloße Textfelder. Sie müssen frei pflegbar sein, damit das Tool mit echten Daten statt Beispieldaten betrieben werden kann.
2. **Nachweisführung** – Nach einer Schulung gibt es heute keinerlei Dokumentation. Für Datenschutz- und Arbeitssicherheitsschulungen ist der Nachweis, dass eine Schulung mit bestimmten Personen stattgefunden hat, rechtlich relevant und muss Jahre später belegbar sein.

Es bleibt bei einem lokalen, serverlosen Einzelplatz-Werkzeug (eine `index.html`, Daten im Browser). Jede Funktion muss einem konkreten Planungs- oder Nachweiszweck dienen – keine Spielereien.

## Datenmodell

### Kurs (erweitert)

Neue und geänderte Felder:

- `format` – `"Vor Ort" | "Online" | "Hybrid"` – **verschoben vom Termin**, da das Format eine Eigenschaft des Kurses ist (eine Ausbildung ist entweder Präsenz oder online, nicht je Durchführung anders)
- `minTeilnehmer` – Zahl, Vorgabe 5 – Mindestteilnehmerzahl, ab der sich der Kurs lohnt
- `maxTeilnehmer` – Zahl, Vorgabe 30 – **ersetzt `Termin.kapazitaet`**
- `zielgruppe` – **entfällt ersatzlos** (durch min/max abgelöst)
- `voraussetzungen` – bleibt
- `zertifikat` – neues Unterobjekt für die Teilnahmebescheinigung:
  - `kuerzel` – z. B. `"DSB"`, für die Zertifikatsnummer; wird aus dem Titel vorgeschlagen
  - `umfangUE` – Zahl, Unterrichtseinheiten (z. B. 40)
  - `ueberschrift` – z. B. `"Zertifizierungslehrgang Datenschutzbeauftragte:r"`
  - `bestaetigungstext` – Fließtext mit Platzhaltern (siehe Abschnitt „Teilnahmebescheinigung")
  - `gueltigkeit` – Freitext, z. B. `"unbefristet"` oder `"3 Jahre"`

`kategorie` bleibt technisch ein String; neu ist ausschließlich die Eingabe (Freitext mit Vorschlagsliste, siehe unten).

### Termin (angepasst)

- `format` – **entfällt** (kommt vom Kurs)
- `kapazitaet` – **entfällt** (kommt aus `kurs.maxTeilnehmer`)
- `trainer` (String) – **ersetzt durch** `trainerId` (Referenz auf Trainer)
- `vertretungTrainerId` – neu, optional, Referenz auf Trainer – Vertretungsdozent für den Krankheitsfall
- `abschluss` – neu, `null` solange nicht abgeschlossen, sonst:
  - `abgeschlossenAm` – ISO-Datum
  - `vorkommnisse` – Freitext, besondere Vorkommnisse
  - `wiedereroeffnungen` – Liste von ISO-Daten, jede Wiederöffnung nach Abschluss
- `datum`, `ort`, `status`, `checkliste` – unverändert

### Trainer (neu)

- `id`, `name`, `email`, `telefon`
- `qualifikation` – Freitext (Schwerpunkte, Fachkunde)
- `notizen` – Freitext
- `dokumente` – Liste von `{ id, name, typ, groesse, gueltigBis }`; `gueltigBis` ist optional (ISO-Datum), Dateiinhalt liegt wie die Kursmaterialien in IndexedDB

### Buchung (erweitert)

- `anwesenheitProzent` – Zahl 0–100 oder `null` (noch nicht erfasst)
- `fehlgrund` – `"krank" | "entschuldigt" | "unentschuldigt" | null`, nur relevant bei < 100 %
- `zertifikatNr` – String oder `null`; wird bei der ersten Erzeugung der Bescheinigung fest geschrieben und ändert sich danach nicht
- `statusManuell` – Boolean, Vorgabe `false`; wird `true`, sobald der Anmeldestatus von Hand geändert wurde (siehe Status-Automatik)

### Einstellungen (neu, global)

Ein einzelnes Objekt im State:

- `zertifikatStartNummer` – Zahl, Vorgabe 147 – Startwert des fortlaufenden Zertifikatszählers
- `bestaetigungsfristTage` – Zahl, Vorgabe 7 – Frist für die automatische Bestätigung

## Migration der Bestandsdaten

Die vorhandenen Daten sind für den Umbau vollständig konsistent (jeder Kurs hat über alle seine Termine dasselbe Format und dieselbe Kapazität), die Migration ist daher verlustfrei:

- `kurs.format` ← Format seiner Termine
- `kurs.maxTeilnehmer` ← Kapazität seiner Termine
- `kurs.minTeilnehmer` ← 5 (Vorgabe)
- `kurs.zertifikat` ← Vorgabewerte; `kuerzel` aus den Anfangsbuchstaben des Titels abgeleitet, `bestaetigungstext` mit dem Wortlaut der tribeta-Vorlage vorbelegt
- Trainer-Datensätze ← die fünf vorhandenen eindeutigen Namen; `termin.trainerId` zeigt auf den passenden Datensatz
- `buchung.anwesenheitProzent`/`fehlgrund`/`zertifikatNr` ← `null`, `buchung.statusManuell` ← `false`
- `termin.abschluss` ← `null` (auch bei bereits „abgeschlossenen" Beispielterminen, da für diese keine Anwesenheitsdaten existieren)

## Funktionen

### 1. Kategorien

Kategorie wird ein Freitextfeld mit Vorschlagsliste (`<datalist>`), gespeist aus allen aktuell im Bestand verwendeten Kategorien. Vorhandene Kategorien sind auswählbar, neue entstehen durch Eingabe. Gilt gleichermaßen für „Neuer Kurs" und „Kurs bearbeiten". Der Kategorie-Filter auf der Schulungen-Seite wird ebenfalls aus dem Bestand abgeleitet statt hart verdrahtet.

### 2. Teilnehmerzahlen und Unterbesetzung

Min-/Maxteilnehmerzahl werden beim Kurs gepflegt. Die Auslastung eines Termins rechnet weiterhin gegen `kurs.maxTeilnehmer` (abgesagte Buchungen zählen nicht mit).

Neu in der **Übersicht**: Ein Termin, dessen aktive Buchungen unter `kurs.minTeilnehmer` liegen, wird mit **„Unterbesetzt (3 von mind. 5)"** in Amber gekennzeichnet – an derselben Stelle, an der sonst „X Plätze frei" bzw. „Ausgebucht" steht. Damit ist der Handlungsbedarf (Teilnehmer ansprechen, ggf. auf den Folgetermin verschieben) direkt neben dem bereits sichtbaren Folgetermin erkennbar.

### 3. Trainer-Bereich

Neuer, vierter Punkt in der Seitenleiste.

**Trainerliste:** alle Trainer mit Anzahl zugeordneter Termine und Warnhinweis, wenn Nachweise abgelaufen sind oder innerhalb der nächsten 60 Tage ablaufen.

**Trainer-Detailseite:** Stammdaten (bearbeitbar), Dokumentenliste mit Datei-Upload/Download/Entfernen und optionalem „gültig bis" je Dokument, sowie eine Liste aller Termine, für die diese Person als Haupttrainer oder Vertretung eingeplant ist.

**Termin-Verknüpfung:** Das Trainer-Textfeld beim Termin wird zur Auswahlliste aus den angelegten Trainern; zusätzlich ein optionales Feld „Vertretung". Ist eine Vertretung hinterlegt, wird sie in der Terminliste und auf der Schulungsdetailseite mit angezeigt.

**Löschen:** Ein Trainer, der noch Terminen zugeordnet ist, wird mit Rückfrage gelöscht („ist noch bei 3 Terminen eingetragen – trotzdem löschen?"). Bei betroffenen Terminen wird `trainerId` bzw. `vertretungTrainerId` auf `null` gesetzt; solche Termine zeigen an der Trainer-Stelle „Kein Trainer zugeordnet" in Rot – in der Terminliste, auf der Schulungsdetailseite und in der Vollständigkeitsprüfung beim Schulungsabschluss.

### 4. Anwesenheitserfassung

Neuer Abschnitt **„Anwesenheit"** auf der Schulungsdetailseite (zwischen Checkliste und Teilnehmer). Zeigt nur Buchungen mit Status ungleich „abgesagt".

Je Teilnehmer: **Anwesenheit in Prozent** (Vorgabe 100) und – nur bei unter 100 % – ein **Fehlgrund** (krank / entschuldigt / unentschuldigt).

- Teilnehmer unter **80 %** werden rot markiert („unter Mindestteilnahme")
- Die Abschnittsüberschrift zeigt eine Zusammenfassung: „12 von 14 erfüllen die Mindestteilnahme"
- Schnellzugriff „Alle auf 100 % setzen" über der Liste, da der Normalfall vollständige Anwesenheit ist und nur Ausnahmen korrigiert werden müssen

### 5. Teilnahmebescheinigung

**Layout:** Nachbau der tribeta-Vorlage (`09_Zertifikat_Vorlage.pdf`) als HTML/CSS – Logo, Teal-Rahmen, Poppins/Mulish, identische Struktur. Ausgabe über die Browser-Druckfunktion („Als PDF speichern"), damit offline und ohne Zusatzbibliothek.

**Erzeugung ausschließlich einzeln**, nie als Sammeldokument: In jeder Zeile des Anwesenheits-Abschnitts ein Button „Bescheinigung", der nur die Bescheinigung dieser Person öffnet. Grund ist der Datenschutz – ein Sammel-PDF würde beim Versand an eine Person die Daten aller anderen mitliefern. Der Dokumenttitel (und damit der vorgeschlagene Dateiname) lautet `Zertifikat_<Nr>_<Name>`.

Der Button ist deaktiviert, solange die Anwesenheit noch nicht erfasst ist (`anwesenheitProzent` ist `null`) sowie bei Teilnehmern unter 80 % Anwesenheit – jeweils mit Hinweis auf den Grund („Anwesenheit noch nicht erfasst" bzw. „unter Mindestteilnahme von 80 %").

**Platzhalter im `bestaetigungstext`:** `{teilnehmer}`, `{kurs}`, `{umfang}`, `{datum}`, `{ort}`, `{trainer}`. Vorbelegung mit dem Wortlaut der bestehenden Vorlage.

**Zertifikatsnummer:** Schema `JAHR-KÜRZEL-LAUFNUMMER`, z. B. `2026-DSB-0147`. Der Zähler ist global über alle Kurse fortlaufend und startet bei `einstellungen.zertifikatStartNummer` (Vorgabe 147), damit der ersten ausgestellten Bescheinigung nicht anzusehen ist, dass sie die erste ist.

Die nächste Nummer ergibt sich als „höchste bereits vergebene Laufnummer über alle Buchungen + 1", andernfalls `zertifikatStartNummer`. Jahr und Kürzel kommen aus dem Termin bzw. Kurs, die Laufnummer wird vierstellig mit führenden Nullen dargestellt. Die Nummer wird bei der ersten Erzeugung in `buchung.zertifikatNr` geschrieben; erneutes Drucken ergibt dieselbe Nummer.

### 6. Schulungsabschluss

**Grundsatz: Abschluss bedeutet Festschreibung.** Eine nachträglich beliebig änderbare Anwesenheitsliste ist als Nachweis wertlos.

**Ablauf** über einen Button „Schulung abschließen" auf der Schulungsdetailseite:

1. Vollständigkeitsprüfung: Ist bei allen Teilnehmern die Anwesenheit erfasst, ist die Checkliste abgearbeitet? Fehlendes wird angezeigt, blockiert den Abschluss aber nicht.
2. Eingabe besonderer Vorkommnisse (Freitext, optional).
3. Nach Bestätigung: Status auf „abgeschlossen", `abschluss.abgeschlossenAm` gesetzt, und **Schreibschutz** auf diesen Termin.

Der Schreibschutz sperrt konkret: Anwesenheit ändern, Teilnehmer hinzufügen/entfernen/verschieben, Anmeldestatus ändern, Checkliste ändern sowie Termindaten bearbeiten. Nicht gesperrt sind: Bescheinigungen drucken, Abschlussbericht drucken, und die kursweiten Inhalte (Beschreibung, Agenda, Materialien) – diese gehören dem Kurs, nicht dem Termin, und dürfen für künftige Termine weiter gepflegt werden. Gesperrte Aktionen werden ausgegraut mit Hinweis „Termin ist abgeschlossen".

Bescheinigungen bleiben jederzeit erneut druckbar (mit unveränderten Nummern).

**Wiederöffnen** ist möglich (Korrekturen sind praxisnotwendig), wird aber in `abschluss.wiedereroeffnungen` protokolliert und im Abschlussbericht ausgewiesen. Nicht verhindern, aber sichtbar machen.

### 7. Abschlussbericht

Druckbares Protokoll je Termin im tribeta-Layout, erreichbar über abgeschlossene Termine. Inhalt:

- Kurs, Kategorie, Datum, Ort, Format, Umfang in Unterrichtseinheiten
- Durchführender Trainer und Vertretung (falls eingesprungen)
- Durchgeführte Agenda
- Teilnehmerliste mit Firma, Anwesenheit in %, Fehlgrund, Bescheinigung ja/nein inkl. Zertifikatsnummer
- Kennzahlen: X von Y Teilnehmern anwesend, Z Bescheinigungen ausgestellt, Ø Anwesenheit
- Besondere Vorkommnisse
- Abschlussdatum, ggf. Hinweis auf Wiederöffnungen, Unterschriftszeile für den Trainer

Anders als die Bescheinigung enthält der Bericht bewusst alle Teilnehmer – er ist ein internes Archivdokument, kein Teilnehmerdokument.

**Wiederfinden:** Kein eigener Menüpunkt, sondern ein Filter „Nur abgeschlossene" auf der Schulungen-Seite sowie eine Kennzeichnung abgeschlossener Termine mit direktem Button „Abschlussbericht".

### 8. Status-Automatik

Eine Buchung startet als „angemeldet". Liegt der zugehörige Termin höchstens `einstellungen.bestaetigungsfristTage` (Vorgabe 7) Tage in der Zukunft, wird sie automatisch auf „bestätigt" gesetzt – sofern `statusManuell` `false` ist.

Die Automatik läuft als eigener, klar abgegrenzter Schritt **einmal beim Laden der Anwendung** und **nach jedem Anlegen einer Buchung**, nicht während des Renderns (Rendern bleibt frei von Seiteneffekten). Sie überspringt Buchungen zu bereits abgeschlossenen Terminen.

Jede manuelle Statusänderung setzt `statusManuell` auf `true`; solche Buchungen werden von der Automatik nie wieder angefasst. Manuell hat immer Vorrang.

In der Buchungsliste kennzeichnet ein kleines Uhr-Symbol automatisch gesetzte Status, damit erkennbar bleibt, wo manuell eingegriffen wurde.

### 9. Hilfebereich

Neuer Punkt „Hilfe" am Ende der Seitenleiste, der die Funktionsweise des Systems in einfacher Sprache erklärt:

- Wie die Auslastung gerechnet wird (abgesagte Buchungen zählen nicht mit)
- Wann „Unterbesetzt" erscheint und was dann zu tun ist
- Wie die Status-Automatik funktioniert und wie man sie übersteuert
- Was kursweit gilt (Beschreibung, Agenda, Materialien) und was pro Termin (Checkliste, Anwesenheit, Teilnehmer)
- Wie die 80-%-Regel, die Bescheinigungen und der Abschluss zusammenhängen
- Was Abschluss und Wiederöffnen bedeuten
- Wo die Daten liegen (lokal im Browser) und was Export, Import, Zurücksetzen und Leeren jeweils tun

### 10. Daten leeren

Neben „Zurücksetzen" (auf Beispieldaten) eine Aktion **„Alle Daten leeren"** in der Seitenleiste: leert Kurse, Termine, Buchungen, Teilnehmer und Trainer vollständig, damit mit echten Daten produktiv gestartet werden kann. Mit deutlicher, nicht umkehrbarer Sicherheitsabfrage; hochgeladene Dateien in IndexedDB werden mitgelöscht.

## Umsetzung in zwei Phasen

Beide Phasen ergeben jeweils für sich ein vollständig nutzbares Werkzeug.

**Phase 1 – Stammdaten & Planung**
Datenmodell-Migration, Kategorien, Format/Min/Max am Kurs, Zertifikatsfelder am Kurs, Trainer-Bereich inkl. Dokumenten und Vertretung, „Unterbesetzt"-Kennzeichnung, Status-Automatik, Hilfebereich, „Alle Daten leeren".

**Phase 2 – Durchführung & Nachweis**
Anwesenheitserfassung, Teilnahmebescheinigungen, Schulungsabschluss mit Festschreibung und Wiederöffnungs-Protokoll, Abschlussbericht, Filter „Nur abgeschlossene".

Phase 2 setzt Phase 1 voraus: Die Bescheinigung braucht Trainer-Datensätze und die Zertifikatsfelder am Kurs, der Abschlussbericht braucht die Anwesenheitsdaten.

Vorgehen je Phase wie in v2: Spezifikation → Implementierungsplan → Umsetzung durch Subagents mit Review nach jedem Arbeitsschritt.

## Aus dem Scope ausgeschlossen (bewusst)

- **Alles, was einen Server braucht** – QR-Code-Feedback durch Teilnehmer, Teilnehmer-Login mit digitalem Schulungsraum, Bewertungsauswertung und Website-Reviews. Diese Funktionen setzen einen von außen erreichbaren Dienst voraus und sind damit ein eigenständiges Projekt mit eigener Architektur-, Hosting- und Betriebsentscheidung. Zurückgestellt, nicht verworfen.
- Mehrbenutzerbetrieb, Rollen und Rechte – das Werkzeug bleibt Einzelplatz.
- Automatischer E-Mail-Versand von Bescheinigungen – Versand erfolgt manuell durch die Nutzerin bzw. den Nutzer.
