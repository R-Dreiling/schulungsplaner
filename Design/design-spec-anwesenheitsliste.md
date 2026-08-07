# Spezifikation — Anwesenheitsliste (Präsenzliste für den Dozenten)

Stand: 2026-08-06. Ergänzung zu `design-spec-v3.md`, Phase 2.
Vom Nutzer im Gespräch abgenommen.

## Zweck

Der Dozent bekommt ein ausgedrucktes Blatt mit auf den Weg, auf dem er zu
Schulungsbeginn abhakt, wer da ist, und auf dem jede anwesende Person
unterschreibt. Zwei Zwecke in einem Dokument:

1. **Arbeitshilfe vor Ort** — wer fehlt, sieht man auf einen Blick.
2. **Nachweis** — die unterschriebene Liste ist bei Datenschutz- und
   Arbeitssicherheitsschulungen das Dokument, das man archiviert. Sie belegt die
   Anwesenheit unabhängig davon, was später in der App erfasst wird.

Sie ist damit das Gegenstück zum Abschlussbericht: Der Bericht entsteht **nach**
der Schulung aus den erfassten Daten, die Anwesenheitsliste geht **vor** der
Schulung aufs Papier.

## Aufruf

Knopf **„Anwesenheitsliste"** im Kopfbereich der Termin-Detailseite, neben
„Schulung abschließen".

Der Knopf bleibt bei **abgeschlossenen Terminen aktiv**. Drucken ist ein lesender
Vorgang; der Schreibschutz gilt für Datenänderungen, nicht für Ausdrucke. Eine
Liste wird gelegentlich auch nachträglich noch einmal gebraucht.

## Inhalt des Blattes

**Kopf**
- Logo (`window.LOGO_NORMAL`, das dunkle Logo für weißes Papier)
- Titel „Anwesenheitsliste"
- Kurstitel als Untertitel
- Metazeile: Datum · Ort · Format · Umfang in Unterrichtseinheiten
- Trainer; ist eine Vertretung eingetragen, erscheint sie zusätzlich

**Tabelle**

| Spalte | Inhalt |
|---|---|
| Nr. | laufende Nummer, beginnend bei 1 |
| Name | Name des Teilnehmers |
| Firma | Firma des Teilnehmers |
| E-Mail | Kontaktadresse des Teilnehmers |
| Anwesend | leeres Kästchen zum Abhaken |

**Korrektur nach der ersten Abnahme:** Ursprünglich hatte jede Zeile eine
Unterschriftslinie. Geschult wird überwiegend **online** — dort kann niemand
unterschreiben, die Liste füllt der Trainer aus. Die Spalte ist deshalb entfallen
und durch die **E-Mail-Adresse** ersetzt: Bei Verbindungsproblemen muss der
Trainer die Teilnehmer erreichen können. Die Unterschrift des Trainers am Fuß
des Blattes bleibt — sie trägt den Nachweis.

Sortierung **alphabetisch nach Name** (`localeCompare`, deutsche Sortierung),
damit der Dozent eine Person schnell findet. Die Buchungsreihenfolge ist auf
Papier ohne Nutzen.

**Drei Leerzeilen** am Ende mit leeren Linien für Name und Firma — für Personen,
die spontan dazukommen. Sie werden fortlaufend mitnummeriert.

**Fuß**
- Satz: „Ich bestätige, dass die Schulung wie oben angegeben durchgeführt wurde
  und die abgehakten Personen daran teilgenommen haben."
- Felder für Ort, Datum und Unterschrift des Dozenten

## Regeln

- **Abgesagte Buchungen erscheinen nicht.** Über `anwesenheitsBuchungen(terminId)`,
  dieselbe maßgebliche Menge wie bei Anwesenheitserfassung, Statistik und Bericht.
- **Rein lesend.** Keine Zertifikatsnummern, keine Statusänderung, kein
  `speichereState()`. Die Liste verändert nichts.
- **Keine Anwesenheitsdaten auf dem Blatt.** Auch wenn in der App schon Prozente
  erfasst sind: Das Blatt ist zum Ausfüllen da, vorbelegte Werte würden die
  Erhebung vor Ort entwerten.
- **Escaping** wie überall: `escHtml` für Textinhalte, `escJsArg` im Inline-Handler.
- **Seitenumbruch** bei vielen Teilnehmern zwischen Zeilen, nie innerhalb einer
  Zeile; die Kopfzeile der Tabelle wiederholt sich auf Folgeseiten.
- Termin ohne Teilnehmer: Das Blatt wird trotzdem erzeugt und enthält nur die
  Leerzeilen — ein Kurs kann auch mit Anmeldung vor Ort stattfinden.

## Technik

Zwei neue Funktionen in `Design/fragments/druck-vorlagen.js`, gebaut wie die
vorhandenen Vorlagen:

```
anwesenheitslisteHtml(terminId)   -> HTML-String
druckeAnwesenheitsliste(terminId) -> ruft druckeInhalt(html, dateiname)
```

Dateiname-Vorschlag: `Anwesenheitsliste_<Datum>_<Kurstitel>`, Leerzeichen durch
Bindestriche ersetzt — identisch zum Muster von Bescheinigung und Bericht.

Druckstile im vorhandenen `@media print`-Block in `Design/styles.css`, aufbauend
auf den bestehenden Klassen (`druck-seite`, `bericht-kopf`, `bericht-titel`,
`bericht-meta`, `druck-logo`). Neue Klassen nur für das Kästchen, die
Unterschriftslinie und den Bestätigungsblock.

Die Hilfeseite bekommt in Schritt 6 („Vor der Schulung") zwei Sätze dazu.

## Nicht Teil dieser Änderung

- Kein Rücktransport der Papierdaten in die App (die Anwesenheit wird weiterhin
  von Hand erfasst; ein Scan-/Importweg wäre ein eigenes Vorhaben).
- Keine Sammelliste über mehrere Termine.
- Keine Unterschriftserfassung am Bildschirm.
