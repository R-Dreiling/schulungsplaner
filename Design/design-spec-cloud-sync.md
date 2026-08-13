# Design-Spec: Gemeinsamer Zugriff über Microsoft 365 (Cloud-Sync)

> Baut auf `Design/design-spec-v3.md` auf. Diese Spec beschreibt ausschließlich die
> Umstellung der Datenhaltung von rein lokal (`localStorage`/`IndexedDB`/Ablageordner)
> auf einen automatisch geladenen Cloud-Speicher; das gesamte Datenmodell, alle
> Mutatoren, die Nachweislogik und die Druckvorlagen aus v3 gelten unverändert weiter.

## Kontext & Ziel

Der Schulungsplaner lief zunächst als reine Einzelplatz-Anwendung (Daten nur im
Browser-Speicher des einen Rechners), dann mit einer **Ablage-Lösung**
(gemeinsamer, per `showDirectoryPicker()` gewählter, OneDrive-synchronisierter
Ordner). Beides ist für den echten Praxiseinsatz bei tribeta nicht tragbar:

1. **Verlustrisiko** bei reiner Einzelplatz-Nutzung — geht der Rechner kaputt,
   sind die Daten weg.
2. **Die Ablage-Lösung wurde real getestet und hat nicht funktioniert.** Ein
   Kollege konnte die App zwar öffnen, sah aber weder den vorhandenen
   Datenstand noch tauchten von ihm angelegte Kurse auf der anderen Seite auf
   — auch nach explizitem Neuladen (F5) und komplettem Neustart der App nicht.
   Die zugrunde liegende Abhängigkeit von lokal synchronisiertem OneDrive plus
   einer manuellen, einmaligen Ordnerauswahl je Gerät erwies sich in der
   Praxis als zu fehleranfällig für den Zweck.

**Anforderung der Nutzerin, unmissverständlich:** Die App soll sich verhalten
„wie jede andere Cloud-App auch" — öffnen, aktueller Stand ist einfach da,
kein manuelles Verbinden, kein Risiko durch nicht laufende lokale
Synchronisation. Mehrere tribeta-Mitarbeitende (2–5 Personen, jede mit
eigenem tribeta-Microsoft-365-Konto) sollen die App von einem beliebigen
Rechner aus öffnen und automatisch denselben, aktuellen Datenstand sehen und
bearbeiten können — **ohne laufende Zusatzkosten** und ohne einen eigenen
Anwendungsserver, den jemand betreiben und absichern müsste.

## Architektur im Überblick

```
┌───────────────────────┐          ┌────────────────────────────────┐
│ GitHub Pages           │          │ tribeta Microsoft 365            │
│ (statischer Code,       │  Login   │ ┌──────────────────────────────┐ │
│  öffentlich, aber        │◄────────┤ │ Azure AD / Entra ID             │ │
│  ohne jede Nachweis-    │          │ │ (Anmeldung mit tribeta-Konto)   │ │
│  daten — nur HTML/CSS/JS)│          │ └──────────────────────────────┘ │
│                         │  Graph   │ ┌──────────────────────────────┐ │
│                         │  API     │ │ OneDrive-Ordner „Schulungsplaner“│ │
│                         ├─────────►│ │  - schulungsdaten.json           │ │
│                         │          │ │  - Dateien/ (Uploads)            │ │
└───────────────────────┘          │ └──────────────────────────────┘ │
                                     └────────────────────────────────┘
```

- **Code liegt öffentlich auf GitHub Pages** (kostenlos, unabhängig vom
  Cloudflare-Account der tribeta-Website). Dort liegt ausschließlich das
  Programm selbst (HTML/CSS/JS) — keine einzige Nachweis-Information. Wer die
  URL kennt, aber kein tribeta-Konto hat, sieht nur einen Anmelde-Bildschirm.
- **Alle echten Daten liegen weiterhin im OneDrive-Ordner `Schulungsplaner`**
  (derselbe Ordner wie bisher, gleiche Freigabe an die 2–4 anderen Personen —
  die Freigabe selbst war nie das Problem). Der Unterschied: Die App liest und
  schreibt diesen Ordner ab jetzt **direkt über die Microsoft-Graph-API aus
  der Cloud**, nicht mehr über eine lokal synchronisierte Kopie plus manueller
  Ordnerauswahl im Browser. Dadurch ist es unerheblich, ob OneDrive auf dem
  jeweiligen Gerät gerade synchronisiert oder überhaupt installiert ist.
- Die App bleibt **rein clientseitig** — kein eigener Anwendungsserver. Der
  einzige „Server" ist Microsoft selbst (Graph API), dessen Betrieb tribeta
  bereits bezahlt.
- Das bestehende Architekturprinzip bleibt erhalten: Mutatoren in
  `state-engine.js` ändern `window.STATE` und rufen `speichereState()`;
  Rendern bleibt seiteneffektfrei. `speichereState()` bekommt zusätzlich die
  Aufgabe, den neuen Stand in die Cloud zu schreiben (siehe „Speichern &
  Laden"). Die bisherige Ablage-Anbindung (`Design/fragments/ablage.js`,
  `showDirectoryPicker()`) entfällt vollständig und wird durch die
  Graph-API-Anbindung ersetzt.

## Anmeldung

- **MSAL.js** (Microsoft Authentication Library), delegierte Anmeldung mit dem
  jeweils eigenen tribeta-Konto.
- **Azure-AD-App-Registrierung** im tribeta-Tenant, **Single-Tenant** (nur
  Konten aus dem tribeta-Tenant können sich überhaupt anmelden — kein
  Fremdzugriff, selbst wenn jemand die GitHub-Pages-URL kennt). Einmalige
  Einrichtung mit Admin-Zugriff.
- Berechtigung (Scope): `Files.ReadWrite`, delegiert. Kein
  Application-Permission, keine tenant-weite Admin-Zustimmung über einzelne
  Nutzerfreigabe hinaus nötig, solange die Tenant-Richtlinien
  Nutzer-Zustimmung erlauben (Prüfung Teil der Einrichtung).
- Beim Öffnen der App **automatischer** Anmeldeversuch (Silent-Login, falls im
  Browser schon ein tribeta-Konto angemeldet ist); nur wenn das fehlschlägt,
  erscheint ein Anmelde-Bildschirm. Ohne gültige Anmeldung: ausschließlich der
  Anmelde-Bildschirm, keine Daten, keine Formulare.

## Speichern & Laden

- **Laden:** Beim Öffnen lädt die App **automatisch und ohne Zutun** die
  `schulungsdaten.json` aus dem OneDrive-Ordner per Graph API und baut
  `window.STATE` daraus auf. Kein Ordner-Auswahldialog, kein manueller
  Schritt. `localStorage` dient nur noch als **lokaler Zwischenspeicher** für
  den Fall einer kurzen Netzwerkunterbrechung mitten in der Sitzung, nicht
  mehr als primäre Quelle.
- **Speichern:** `speichereState()` bleibt der einzige Ort, an dem
  geschrieben wird. Sie stößt ein **verzögertes (debounced)** Hochladen der
  aktuellen `schulungsdaten.json` in die Cloud an (wenige Sekunden nach der
  letzten Änderung).
- Der Speicherstatus wird sichtbar gemacht, an der Stelle, an der heute der
  Ablage-Status stand: „Gespeichert um 14:32 Uhr" / „Speichert …" / „Nicht
  gespeichert seit 14:28 Uhr — erneut versuchen".
- Schlägt ein Speicherversuch fehl (z. B. Netz weg), bleibt die Änderung im
  lokalen Zwischenspeicher erhalten und wird automatisch erneut versucht,
  sobald die Verbindung wieder da ist.

## Konflikterkennung beim Speichern

Die Nutzung ist überwiegend **nacheinander**, nicht zeitgleich — eine
vollständige Mehrbenutzer-Zusammenführung (wie bei einer echten Datenbank) ist
bewusst nicht das Ziel. Stattdessen:

- Beim Laden merkt sich die App den `eTag` (Versionskennung) der Datei.
- Vor jedem Speichern prüft sie, ob sich der `eTag` auf dem Server seitdem
  geändert hat (jemand anderes hat zwischenzeitlich gespeichert).
- Ist das der Fall: **kein stilles Überschreiben.** Dialog: „Jemand anderes
  hat zwischenzeitlich gespeichert. Jetzt neu laden (eigene ungespeicherte
  Änderungen gehen dabei verloren) oder trotzdem überschreiben?" — die zweite
  Option verlangt eine native `confirm()`-Bestätigung.

Das ist dieselbe Grundhaltung wie die bestehende Regel „Nachweisspuren nie
überschreiben" — nur auf die Mehrbenutzer-Situation angewandt.

## Hochgeladene Dateien

Seminarunterlagen, Vorlagen und Trainer-Nachweise liegen heute in
`IndexedDB`, also nur im Browser des jeweiligen Rechners — für gemeinsamen
Zugriff unbrauchbar. Sie wandern in einen Unterordner `Dateien/` desselben
OneDrive-Ordners:

- Hochladen: Datei per Graph API in `Dateien/` ablegen, die zurückgegebene
  DriveItem-ID + Dateiname im jeweiligen State-Objekt referenzieren (ersetzt
  den bisherigen IndexedDB-Schlüssel).
- Anzeigen/Herunterladen: Inhalt bei Bedarf per Graph API über die
  DriveItem-ID nachladen.
- **Unterschrift- und Stempelbild bleiben wie bisher als Data-URL direkt im
  `einstellungen`-Objekt** (die Bescheinigung wird synchron gebaut und kann
  nicht auf einen weiteren Netzwerk-Roundtrip warten) — sie wandern also
  automatisch mit der `schulungsdaten.json` selbst mit.
- Für die Nutzerin ändert sich am Ablauf nichts: Hochladen bleibt ein
  normales Datei-Auswahlfeld in der App.

## Fehlerbehandlung

| Situation | Verhalten |
|---|---|
| Kein Netz beim Öffnen | Hinweis „Keine Verbindung", Wiederholen-Knopf. Keine Daten, keine Formulare, solange nicht geladen werden konnte. |
| Nicht angemeldet / falscher Tenant | Nur Anmelde-Bildschirm, keine Fehlermeldung mit technischen Details. |
| Speichern schlägt fehl (Netz weg während der Arbeit) | Änderung bleibt im lokalen Zwischenspeicher, Status zeigt „Nicht gespeichert seit …", automatischer Retry im Hintergrund. |
| Konflikt beim Speichern | Siehe „Konflikterkennung beim Speichern" — Dialog statt stillem Überschreiben. |
| Datei-Upload schlägt fehl | Fehlermeldung an der Stelle, an der heute schon Upload-Fehler (z. B. >400 KB bei Unterschrift/Stempel) gemeldet werden. |

## Einmalige Einrichtung

Gemeinsam mit der Nutzerin, die über Admin-Zugriff auf das
tribeta-Microsoft-365-Tenant verfügt:

1. Azure-AD-App-Registrierung anlegen (Single-Tenant, Redirect-URI = die
   spätere GitHub-Pages-URL, Scope `Files.ReadWrite`).
2. Der bestehende, bereits geteilte OneDrive-Ordner „Schulungsplaner" wird
   weiterverwendet — keine neue Freigabe nötig.
3. GitHub-Repository + GitHub-Pages-Seite für den Code einrichten
   (öffentlich, kostenlos).
4. Umstellung der bestehenden `schulungsdaten.json` im Ordner (aktuell leer)
   auf den neuen Zugriffsweg — keine inhaltliche Migration nötig, da noch
   keine echten Daten dort verlässlich angekommen sind (siehe Kontext:
   genau das hat mit der Ablage-Lösung nicht funktioniert).

## Nicht-Ziele (bewusst außen vor)

- **Kein Echtzeit-Zusammenarbeiten** (mehrere Personen tippen gleichzeitig im
  selben Termin) — laut Klärung nicht der tatsächliche Nutzungsfall.
- **Kein eigener Anwendungsserver, keine eigene Datenbank** — würde einen
  laufenden Kostenpunkt und zusätzlichen Betriebsaufwand bedeuten, den
  Microsoft 365 (bereits bezahlt) und GitHub Pages (kostenlos) beide unnötig
  machen.
- **Kein Zugriff für Personen ohne tribeta-Konto** (z. B. externe Trainer
  oder Kunden) — außerhalb des aktuellen Bedarfs.
- **Keine Änderung an Datenmodell, Mutatoren, Druckvorlagen oder der
  Nachweislogik aus v3** — diese Umstellung betrifft ausschließlich, *woher*
  der State geladen und *wohin* er gespeichert wird.

## Testgrenzen dieser Umsetzung

Der Microsoft-Login und das Zusammenspiel mit dem echten tribeta-OneDrive
lassen sich in der Entwicklungsumgebung nicht simulieren (kein echtes
tribeta-Konto verfügbar). Die Umsetzung wird so weit wie möglich gegen die
App-Logik selbst geprüft (Konflikterkennung, Debounce-Verhalten, Fehlerpfade
mit simulierten/mockbaren Antworten); der abschließende Test mit echtem
Login und echtem OneDrive-Ordner muss einmal mit dem echten tribeta-Konto der
Nutzerin **und** eines Kollegen gemeinsam erfolgen, bevor die Umstellung als
abgeschlossen gilt — die Ablage-Lösung ist genau daran zuvor gescheitert, ein
rein isolierter Test genügt also nicht.

## Offene Punkte für die Einrichtung

- Ob die Tenant-Richtlinien von tribeta Nutzer-Zustimmung (User Consent) für
  die Azure-AD-App ohne zusätzliche Admin-Freigabe pro Person erlauben, oder
  ob eine einmalige Admin-Zustimmung für alle Nutzenden nötig ist — wird bei
  der Einrichtung in der Praxis sichtbar und dort geklärt.
