# HANDOFF — Schulungsplaner

Stand: Cloud-Sync-Migration abgeschlossen und mit echtem Kollegen-Test
verifiziert. Hosting zusätzlich auf Cloudflare Pages umgezogen (Nutzerinwunsch,
nicht wegen eines Hosting-Problems — GitHub Pages lief die ganze Zeit
fehlerfrei; die tatsächlichen Ursachen der Login-/Sync-Probleme waren eine
fehlende OneDrive-Freigabe und zwei Code-Bugs, siehe unten). Branch
`feature/kurs-termin-buchung`, Arbeitsbaum sauber.

## Was das ist

Schulungsplanungs-Werkzeug für die **tribeta GmbH**: Kurse/Termine/Buchungen,
Trainer mit Nachweisen, Anwesenheit mit 80-%-Regel, Bescheinigungen, Abschluss
mit Festschreibung, Abschlussbericht, Anwesenheitsliste, Arbeitgebernachweis,
fällige Auffrischungen, Sammelbuchung, PDF-Erzeugung. Technisch eine einzige
`index.html` (kein Server, kein Build-Tool außer dem lokalen `assemble.py`),
aber **kein reines Einzelplatz-Werkzeug mehr** — der Datenbestand liegt
gemeinsam in der Cloud, mehrere Personen arbeiten gleichzeitig daran.

## Architektur: gehostet + Microsoft-Login + Graph API

Frühere Ansätze (lokaler `localStorage`, dann ein per `showDirectoryPicker()`
gewählter Ablageordner) sind **beide gescheitert** — Letzterer erst nach einem
echten Test mit einem Kollegen: weder sah er die vorhandenen Daten, noch kamen
neue Einträge bei der anderen Seite an. Die jetzige, dritte Lösung wurde
ebenfalls mit einem echten Kollegen-Test verifiziert und funktioniert:

1. **Code liegt öffentlich auf GitHub, ausgeliefert über Cloudflare Pages.**
   Repo: `https://github.com/R-Dreiling/schulungsplaner` (öffentlich,
   unbedenklich, da nur App-Code drin liegt, keine Nachweisdaten). Cloudflare
   Pages ist mit diesem Repo verbunden (Branch `main`, Ausgabeordner `docs`,
   kein Build-Kommando) und deployt automatisch bei jedem Push — der
   Arbeitsablauf (`git push origin HEAD:main`) bleibt unverändert.
   **Aktuelle/kanonische Live-URL: `https://schulungsplaner.pages.dev/`**
   (Cloudflare-Konto `Dreiling@tribeta-group.de`). Die frühere GitHub-Pages-URL
   `https://r-dreiling.github.io/schulungsplaner/` läuft parallel weiter (als
   Rückfallebene, nicht abgeschaltet) und bleibt daher auch als zweite
   Redirect-URI in Azure AD eingetragen. GitHub Pages unterstützt nur
   `/ (root)` oder `/docs` als Quelle — deshalb schreibt `assemble.py` die
   gebaute App **zweimal**: nach `Berichte/index.html` (der kanonische Build,
   für den lokalen/OneDrive-Gebrauch) und zusätzlich nach `docs/index.html`
   (identischer Inhalt, von beiden Hosting-Anbietern genutzt). Bei jeder
   Änderung **beide** committen und pushen — `assemble.py` erledigt das
   Schreiben automatisch, git-Add/Push bleibt manuell.
2. **Anmeldung über das tribeta-Microsoft-Konto** (Azure AD / Microsoft Entra
   ID, Tenant „HinSchG Meldungen GbR", Single-Tenant-App-Registrierung
   „Schulungsplaner", clientId `f3c14c0a-1442-4cd5-8231-692a7938ad02`,
   tenantId `473ae1a6-c24a-4f5e-a00b-1dc5ef3f4793`). MSAL.js (vendored unter
   `Design/vendor/msal-browser.min.js`) übernimmt Login/Token. Jede Person
   meldet sich mit ihrem eigenen Konto an (Single Sign-on, falls im Browser
   schon angemeldet — sonst einmalig Konto auswählen). **Beide** Live-URLs
   (Cloudflare und GitHub Pages) stehen als Redirect-URI in der
   App-Registrierung — wird eine der beiden URLs stillgelegt, die zugehörige
   Redirect-URI dort ebenfalls entfernen.
3. **Der gemeinsame Datenbestand liegt als einzelne JSON-Datei
   (`schulungsdaten.json`) im OneDrive von `info@tribeta-group.de`**, Ordner
   `Claude-tribeta-Tools/Schulungsplaner`. Zugriff läuft über Microsoft Graph
   (`Design/graph-sync.js`), `driveId`/`itemId` stehen fest in
   `Design/graph-config.js`. Kein Push/Websocket — jede Person lädt beim
   Öffnen/Neuladen (F5) den aktuellen Stand; Änderungen anderer erscheinen
   nicht von selbst, ein Neuladen reicht aber.

### Wichtige Stolperfalle, die beim erstmaligen Aufsetzen aufgetreten ist

`Files.ReadWrite.All` als Graph-Berechtigung (auch mit Tenant-weitem Admin-
Consent) reicht **allein nicht**, damit eine andere Person als der Ordner-
Eigentümer die Datei lesen/schreiben kann — das ist nur die App-Berechtigung,
Graph prüft zusätzlich die tatsächliche OneDrive-**Freigabe** des Ordners.
Ohne explizite Freigabe bekommt jede andere Person ein `403 Forbidden`, auch
mit gültigem Login und korrekt gesetzter App-Berechtigung.

Behoben durch: Ordner `Schulungsplaner` in `info@tribeta-group.de`s OneDrive
→ „Freigeben" → Link-Bereich **„Personen in [Organisation]"**, Rolle **„Kann
bearbeiten"**. Zweite Falle dabei: Bei einer neu erstellten organisationsweiten
Freigabe bleibt `grantedToIdentitiesV2` leer, bis eine Person den Freigabe-
**Link tatsächlich einmal im Browser öffnet** — erst danach funktioniert der
direkte Graph-API-Zugriff (also NICHT über den Link, sondern direkt per
Item-ID, wie es die App tut) auch für diese Person. Bei künftigen neuen
Kolleg:innen: einmalig den Freigabe-Link öffnen lassen, bevor sie die App
benutzen — sonst bekommen sie denselben 403-Fehler.

## Einmalige Einrichtung (bereits erledigt, hier nur als Referenz)

- GitHub-Repo + Pages-Quelle `main`/`docs` — siehe oben.
- Azure-AD-App-Registrierung: Single-Tenant, Plattform „Single-Page
  Application (SPA)", Redirect-URI = exakt die GitHub-Pages-URL (inkl.
  abschließendem `/`, sonst schlägt der Login fehl). API-Berechtigung
  Microsoft Graph → Delegiert → `Files.ReadWrite.All` → Admin-Zustimmung für
  den ganzen Tenant erteilt.
- `driveId`/`itemId` in `Design/graph-config.js` über Graph Explorer
  aufgelöst (Endpunkt `/users/info@tribeta-group.de/drive/root:/<Pfad>` bzw.
  `/users/info@tribeta-group.de/drive?$select=id`).
- OneDrive-Ordner-Freigabe wie oben beschrieben.
- Desktop-Verknüpfung `Schulungsplaner.lnk` (auf dem Rechner der Nutzerin)
  zeigt jetzt auf die Cloudflare-URL statt auf die lokale Datei (Chrome im
  App-Modus: `--app="https://schulungsplaner.pages.dev/"`) — die Anmeldung
  ist an eine feste, registrierte Web-Adresse gebunden, `file://`
  funktioniert dafür nicht. Kolleg:innen richten sich das über Chromes
  eigene Funktion „Als App installieren" ein (Adressleiste bzw.
  Drei-Punkte-Menü), sobald sie auf der Live-URL angemeldet sind.

## Bekannte Bugs, die in dieser Session gefunden und behoben wurden

- **Fehlendes Status-Element** (`692dd7f`): `graph-sync.js` aktualisierte seit
  dem Cloud-Umbau ein Element mit der ID `graph-sync-status`, das es in
  `shell-template.html` nie gab — der Speicherstatus („Speichert …",
  „Gespeichert um HH:MM Uhr", „Nicht gespeichert — erneut versuchen") wurde
  dadurch nirgends angezeigt, stattdessen blieb die alte, statische
  Vor-Cloud-Meldung „Lokal gespeichert im Browser" stehen. Das hatte den
  ersten Kollegen-Test unnötig erschwert, weil nicht erkennbar war, ob ein
  Speichern erfolgreich war oder fehlschlug.
- **Dialoge schlossen sich beim Klick daneben oder mit Esc** (`347b024`),
  ohne Rückfrage — alle eingetragenen Werte gingen dabei verloren. Betraf
  jedes Formular in der App (Kurs/Termin/Trainer/Buchung anlegen usw.), nicht
  nur eines. Ursache war ein globaler Klick-/Keydown-Listener in
  `ui-helpers.js`, der ersatzlos entfernt wurde. Dialoge schließen sich jetzt
  nur noch über die expliziten Knöpfe (✕ / „Abbrechen").

## Verifiziert (diese Session)

- Solo-Test: Login, Kurs angelegt, Datei direkt im synchronisierten
  OneDrive-Pfad geprüft — Eintrag korrekt angekommen.
- Gemeinsamer Test mit Kollegen: nach Beheben der Freigabe-Stolperfalle hat
  der Kollege erfolgreich einen Eintrag angelegt, die Nutzerin sah ihn nach
  F5. Umgekehrte Richtung ebenfalls bestätigt.
- Dialog-Fix vom Kollegen bzw. der Nutzerin selbst nach hartem Neuladen
  gegengetestet und bestätigt.

## Offen

- **Datei-Uploads** (Materialien bei Kursen, Nachweise bei Trainern) liegen
  weiterhin nur in `IndexedDB` des jeweiligen Browsers — **nicht** Teil
  dieser Migration, bewusst ausgeklammert (siehe
  `Design/implementation-plan-cloud-sync.md`, Abschnitt „Nicht im Scope").
  Diese Dateien sind also weiterhin nicht zwischen den Rechnern geteilt.
  Braucht eine eigene Folgeplanung (Graph-Upload in denselben OneDrive-Ordner
  wäre der naheliegende nächste Schritt).
- **Kein Live-Push**: Änderungen anderer Personen erscheinen erst nach
  Neuladen (F5) der Seite, nicht automatisch während die App offen bleibt.
  Bewusst einfach gehalten (kein Server im Hintergrund). Falls das im Alltag
  stört, wäre ein Auto-Refresh-Intervall (z. B. alle 30 s) eine kleine
  spätere Ergänzung.
- Temporärer Admin-Zugriff, den `dreiling@tribeta-group.de` sich zur
  Diagnose über das M365 Admin Center auf das OneDrive von
  `info@tribeta-group.de` gegeben hat, ist noch nicht wieder entfernt (reine
  Aufräumarbeit, kein Blocker).
- Handelsregisternummer und USt-IdNr. fehlen weiterhin im Fuß der
  Bescheinigung — sobald die Eintragung durch ist, im Dialog „Unterschrift &
  Stempel" ergänzen.

## Feste Regeln (Auszug, vollständig in `Design/design-spec-cloud-sync.md` und
## den älteren `design-spec*.md`)

- `Berichte/index.html` **und** `docs/index.html` **nie von Hand**
  bearbeiten — immer `python Design/assemble.py` (schreibt beide).
- Sperrzustand über `istTerminAbgeschlossen()`, nie über `!!termin.abschluss`.
- Datumsangaben nie über `toISOString()` — `heuteIso()`, `inTagenIso()`,
  `alsIsoDatum()`.
- Bescheinigungen nur einzeln, nie als Sammeldokument.
- Zertifikatsnummern erst beim tatsächlichen Druck vergeben.
- Firmierung **tribeta GmbH**, keine erfundenen Angaben auf Dokumenten.

## Umgebung

**Build:** `python Design/assemble.py` — reproduzierbar, schreibt
`Berichte/index.html` und `docs/index.html`.
**Datenprüfung:** `python Design/verify_migration_v3.py` — grün.
**Automatisierte Tests:** keine (kein Node.js in dieser Umgebung).
**Veröffentlichen:** `git push origin HEAD:main` — braucht interaktive
GitHub-Anmeldung (Browser-Popup), lief in dieser Session nur über die
Nutzerin selbst im Terminal, nicht automatisiert (Sandbox-Einschränkung).

**Prüftechniken, die sich bewährt haben:**
- Graph-Explorer-Abfragen: nach dem Eintippen der URL **zweimal** auf
  „Run query" klicken bzw. sicherstellen, dass kein Autovervollständigen-
  Vorschlag den eingetippten Text überschrieben hat — das Tool läuft sonst
  eine völlig andere, zuletzt aktive Beispielabfrage. Im Zweifel den
  tatsächlichen Wert des Adressfelds per `document.querySelector('[aria-
  label="Query sample input"]').value` gegenprüfen, nicht per Screenshot
  ablesen (lange IDs wie `driveId`/`itemId` sind per Bildschirmfoto sehr
  fehleranfällig zu lesen — `0`/`O`, `1`/`l`/`I`, `3`/`8` etc.).
- Der sandboxed Browser dieser Umgebung kann grundsätzlich keine lokalen
  Dateien öffnen (auch nicht aus dem Scratchpad) — Verifikation von
  UI-Änderungen lief deshalb strukturell (grep/Python gegen die gebaute
  `index.html`), nicht per Live-Browsertest. Live-Tests liefen über
  Screenshots, die die Nutzerin bzw. ihr Kollege im echten Browser gemacht
  haben.
- Bash zeigt Umlaute falsch an, auch wenn die Datei korrekt ist — immer am
  Dateiinhalt prüfen.
- `window.print()` blockiert die Umgebung — nie aufrufen.
