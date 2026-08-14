# Design-Spec: Cloudflare-natives Hosting mit E-Mail-Zugriffsliste

Stand: 2026-08-14. Löst die Microsoft-Login-/Graph-API-Architektur aus
`design-spec-cloud-sync.md` vollständig ab. Grund: Der Wunsch der Nutzerin
nach voller, selbst kontrollierter Zugriffsliste — unabhängig davon, wer sonst
noch Administratorrechte im tribeta-Microsoft-Tenant hat.

## Ziel

Der Schulungsplaner soll weiterhin ein gemeinsamer Datenbestand für mehrere
Personen sein, aber:

- Zugriff wird über eine **E-Mail-Liste** gesteuert, die ausschließlich die
  Nutzerin selbst im eigenen Cloudflare-Konto pflegt.
- **Kein Microsoft-Konto mehr nötig** — jede zugelassene E-Mail-Adresse
  funktioniert, unabhängig vom tribeta-Tenant.
- Genau wie bisher: kein spürbares Risiko, dass "man zittern muss, ob es
  läuft" — die Lösung soll mindestens so zuverlässig sein wie die jetzige.

## Architektur

```
Browser --> Cloudflare Access (Login-Gate, E-Mail + Code)
        --> Cloudflare Pages (statische index.html, unverändert sonst)
        --> Pages Function /api/daten (GET/PUT)
        --> Cloudflare R2 (schulungsdaten.json als Objekt, mit ETag)
```

**Cloudflare Access** (Zero Trust, kostenlos bis 50 Nutzer:innen) schützt die
gesamte Pages-Domain (`schulungsplaner.pages.dev` bzw. später eine eigene
Domain). Es gibt eine Positivliste mit E-Mail-Adressen (Access Policy,
"Allow" mit `email in {...}`). Beim ersten Aufruf schickt Cloudflare einen
Einmal-Code an die eingegebene Adresse; nach Eingabe ist die Sitzung für einen
konfigurierbaren Zeitraum (Vorschlag: 24 Stunden) gültig. Zugriff verwalten
= E-Mail-Adressen in dieser Liste hinzufügen/entfernen, direkt im
Cloudflare-Dashboard der Nutzerin, ohne Codeänderung.

**Datenhaltung:** Ein Cloudflare-R2-Bucket (`schulungsplaner-daten`) enthält
genau ein Objekt, `schulungsdaten.json` — funktional identisch zur heutigen
Datei im OneDrive. R2 unterstützt bedingte Schreibzugriffe über ETags
(`If-Match`), genau wie Microsoft Graph es tut — die bestehende
Konflikterkennung aus `graph-sync.js` lässt sich fast unverändert auf R2
übertragen.

**Vermittlungsschicht:** Da der Browser R2 nicht direkt ansprechen kann (kein
öffentlicher Schreibzugriff auf einen Bucket), übernimmt eine **Cloudflare
Pages Function** (`functions/api/daten.js`, läuft automatisch neben der
statischen Seite, kein separates Deployment) zwei Endpunkte:

- `GET /api/daten` — liest das Objekt aus R2, gibt Inhalt + ETag zurück.
- `PUT /api/daten` — schreibt das Objekt, mit `If-Match` auf den zuletzt
  gelesenen ETag (Header `If-Match` vom Client mitgeschickt). Bei ETag-
  Konflikt: HTTP 412, die App zeigt denselben Konfliktdialog wie heute.

Die Function braucht keine eigene Authentifizierung zu prüfen — das erledigt
Cloudflare Access bereits davor auf Ebene der gesamten Domain. Ein Aufruf,
der die Function erreicht, kommt zwangsläufig von einer zugelassenen
E-Mail-Adresse.

## Code-Änderungen

**Entfernt:** `Design/graph-auth.js`, `Design/graph-config.js`,
`Design/graph-sync.js`, `Design/vendor/msal-browser.min.js`, der
Anmelde-Bildschirm (`#anmelde-bildschirm` samt zugehöriger Funktionen in
`shell-template.html`) — wird nicht mehr gebraucht, weil Cloudflare Access
das Gate bereits vor jeder Zeile App-Code übernimmt.

**Neu:** `Design/cf-sync.js` — ersetzt `graph-sync.js` 1:1 in seiner Rolle
(`cfDatenLesen()`, `cfDatenSchreiben()`, `cfBeimStartLaden()`,
`cfDatenSpaeterSchreiben()`, `cfKonfliktDialog()`), spricht aber mit
`/api/daten` statt mit `graph.microsoft.com`. Kein Login/Token nötig — die
Function ist ja bereits hinter Access geschützt.

**Neu:** `functions/api/daten.js` — die Pages Function mit GET/PUT wie oben
beschrieben. Läuft in Cloudflares JavaScript-Laufzeitumgebung (keine
Node-spezifischen APIs), braucht eine R2-Bindung (`env.SCHULUNGSDATEN`), die
beim Einrichten im Cloudflare-Dashboard verknüpft wird.

**`state-engine.js`:** `speichereState()` ruft künftig `cfDatenSpaeterSchreiben()`
statt `graphDatenSpaeterSchreiben()`.

**`shell-template.html`:** Lädt beim Start direkt `cfBeimStartLaden()` statt
über den Anmelde-Ablauf — kein Login-Zustand mehr zu verwalten.

## Migration der bestehenden Daten

Einmaliger Schritt: aktuelle `schulungsdaten.json` aus dem OneDrive-Pfad
lesen und als Startinhalt in den neuen R2-Bucket hochladen (über die
Cloudflare-Weboberfläche oder `wrangler`). Reihenfolge wichtig: **erst**
migrieren, **dann** den Code umstellen und veröffentlichen — sonst startet
die neue Version mit leerem Datenbestand.

## Fehlerbehandlung

- Netzwerkfehler beim Lesen/Schreiben: gleiche Statusanzeige wie heute
  ("Nicht gespeichert — erneut versuchen").
- ETag-Konflikt (412): gleicher Dialog wie heute (neu laden vs. überschreiben).
- Nicht auf der Zugriffsliste: Cloudflare Access zeigt eine eigene
  Fehlerseite, die App-Ebene sieht diesen Fall nie.

## Testen

Kein automatisierter Testrunner (unverändert gegenüber dem restlichen
Projekt). Verifikation manuell:

1. Solo-Test: Zugriffsliste enthält die eigene Adresse, Login über
   Cloudflare Access, Kurs anlegen, direkt im R2-Bucket (Cloudflare-Dashboard)
   prüfen, dass die Datei den neuen Eintrag enthält.
2. Konflikttest: zwei Browserfenster/-profile, gleichzeitig ändern, prüfen
   dass der Konfliktdialog erscheint statt stillschweigend zu überschreiben.
3. Gemeinsamer Test mit einer zweiten zugelassenen Adresse (analog zum
   heutigen Kollegen-Test).
4. Negativtest: eine NICHT zugelassene Adresse versuchen — muss von
   Cloudflare Access abgewiesen werden, bevor die App überhaupt lädt.

## Anfängliche Zugriffsliste

- dreiling@tribeta-group.de
- fuetterer@tribeta-group.de
- finocchietti@tribeta-group.de

## Aus dem Scope ausgeschlossen

- Datei-Uploads (Materialien/Nachweise) bleiben wie bisher nur lokal in
  IndexedDB — unverändert gegenüber der aktuellen Situation, keine
  Verschlechterung, aber auch keine Verbesserung durch diesen Umbau.
- Eigene Domain statt `*.pages.dev` — optional, später bei Bedarf.
