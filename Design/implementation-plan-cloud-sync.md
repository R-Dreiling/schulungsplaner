# Cloud-Sync (Microsoft-Login + automatisches Laden/Speichern) Implementation Plan

> **Für agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die App meldet sich beim Öffnen automatisch mit dem tribeta-Microsoft-Konto
an und lädt/speichert `schulungsdaten.json` direkt aus dem gemeinsamen
OneDrive-Ordner über Microsoft Graph — ohne lokale Ordnerauswahl, unabhängig davon,
ob OneDrive auf dem jeweiligen Gerät synchronisiert.

**Architecture:** Rein clientseitig, kein eigener Server. MSAL.js übernimmt die
Anmeldung (Azure AD, Single-Tenant), Microsoft Graph liefert Lesen/Schreiben der
einen gemeinsamen JSON-Datei per HTTP. `speichereState()` bleibt der zentrale
Mutator-Ausgang; sie stößt jetzt einen debounced Graph-Upload statt des bisherigen
Ablage-Schreibvorgangs an. Die alte `Design/fragments/ablage.js`
(`showDirectoryPicker()`) entfällt vollständig.

**Tech Stack:** MSAL.js (Browser-Bundle, vendored, kein npm/Build-Schritt),
`fetch()` gegen `https://graph.microsoft.com/v1.0/...`, sonst reines Vanilla-JS
wie der Rest der App.

**Scope-Abgrenzung:** Dieser Plan deckt ausschließlich die `schulungsdaten.json`
(Kurse, Termine, Buchungen, Teilnehmer, Trainer, Einstellungen) ab — genau das,
was der reale Test mit dem Kollegen als dringend gebraucht gezeigt hat. Der in
`design-spec-cloud-sync.md`, Abschnitt „Hochgeladene Dateien", beschriebene
Umzug von Materialien/Nachweisen aus `IndexedDB` zu Graph-API-Uploads ist
**bewusst nicht Teil dieses Plans** (YAGNI — der Kernbedarf ist der gemeinsame
Datenbestand, nicht die Dateiablage) und folgt bei Bedarf als eigener,
späterer Plan. Bis dahin bleiben hochgeladene Dateien wie bisher rein lokal
im Browser der jeweiligen Person.

## Global Constraints

- `Berichte/index.html` **niemals von Hand bearbeiten** — immer `python Design/assemble.py`.
- **Keine automatisierten Tests in diesem Projekt** (kein Node.js installiert). Jede
  "Verifikation" in diesem Plan ist eine strukturelle Prüfung des gebauten
  `Berichte/index.html` per Python-Skript (`grep`/String-Assertions) oder eine
  bewusst manuell zu erledigende Prüfung — beides ist explizit gekennzeichnet.
- Platzhalter-Zeichenfolgen (doppelte geschweifte Klammern wie `{{X}}`) **niemals**
  in einem Kommentar oder String schreiben — `assemble.py` ersetzt sie per naivem
  `str.replace` über das ganze Dokument.
- Sprache durchgehend Deutsch (Oberfläche, Funktions-/Variablennamen, Commits).
  Escaping: `escHtml()` für Text als HTML, `escAttr()` für Attributwerte,
  `escJsArg()` für JS-Stringargumente in Inline-Handlern (siehe `Design/ui-helpers.js`).
- Design-Tokens ausschließlich aus `Design/styles.css` (`--teal`, `--ink`, `--card`,
  `--line`, vorhandene `.btn`/`.btn-primary`-Klassen) — keine neuen Hex-Werte.
- Jeder Commit, der Quellen ändert, enthält die neu gebaute `Berichte/index.html`.
- `Design/design-spec-cloud-sync.md` ist die maßgebliche Spezifikation für dieses
  Vorhaben — bei Widersprüchen zwischen diesem Plan und der Spec gilt die Spec.

---

## Datei-Übersicht

| Datei | Status | Zweck |
|---|---|---|
| `Design/vendor/msal-browser.min.js` | neu | Vendored MSAL.js-Browserbundle |
| `Design/graph-config.js` | neu | Nicht-geheime Konfigurationswerte (Client-ID, Tenant-ID, Laufwerks-/Ordner-ID) |
| `Design/graph-auth.js` | neu | Anmeldung (still + interaktiv), Token-Beschaffung |
| `Design/graph-sync.js` | neu | Laden/Speichern der gemeinsamen JSON-Datei, Konflikterkennung, Statusanzeige |
| `Design/fragments/ablage.js` | **gelöscht** | Alte, nicht funktionierende Ordner-Sync-Lösung |
| `Design/state-engine.js` | geändert | `speichereState()` ruft `graphDatenSpaeterSchreiben()` statt `ablageDatenSpaeterSchreiben()` |
| `Design/shell-template.html` | geändert | Anmelde-Bildschirm, MSAL-Skript eingebunden, Start-Ablauf umgestellt |
| `Design/fragments/einstellungen.js` | geändert | Ablageordner-Feld raus, Anmeldestatus + Abmelden-Knopf rein |
| `Design/fragments/page-hilfe.html` | geändert | "Wo die Daten liegen" korrigiert, Ablage-Erwähnungen entfernt |
| `Design/assemble.py` | geändert | Neue Dateien einbinden, `ablage` aus der Extras-Liste entfernen |

---

## Task 1: MSAL.js-Bibliothek vendoren

**Files:**
- Create: `Design/vendor/msal-browser.min.js`
- Modify: `Design/assemble.py`
- Modify: `Design/shell-template.html:107-109` (vor dem bestehenden `{{DATA_JSON}}`-Script-Block)

**Interfaces:**
- Produces: globales `msal`-Objekt (aus dem MSAL-Bundle), das `Design/graph-auth.js` in Task 4 nutzt.

- [ ] **Step 1: MSAL-Browser-Bundle herunterladen**

Mit dem WebFetch-Werkzeug (oder `curl`, falls verfügbar) die aktuelle stabile
`msal-browser`-UMD-Datei laden, z. B. von
`https://cdn.jsdelivr.net/npm/@azure/msal-browser@3/lib/msal-browser.min.js`
und den Inhalt unverändert speichern unter:

```
Design/vendor/msal-browser.min.js
```

`Design/vendor/` vorher anlegen, falls es noch nicht existiert.

- [ ] **Step 2: In assemble.py einbinden**

In `Design/assemble.py`, nach der Zeile mit `stempel_b64 = read(...)`, ergänzen:

```python
msal_js = read(BASE / "vendor" / "msal-browser.min.js")
```

Nach der Zeile `html = html.replace("{{STEMPEL_B64}}", stempel_b64)` ergänzen:

```python
html = html.replace("{{MSAL_JS}}", msal_js)
```

- [ ] **Step 3: Platzhalter im Template ergänzen**

In `Design/shell-template.html`, direkt **vor** dem bestehenden Block

```html
<script>
window.SEED_DATA = {{DATA_JSON}};
</script>
```

folgenden neuen Block einfügen:

```html
<script>
{{MSAL_JS}}
</script>
```

- [ ] **Step 4: Bauen**

```bash
python Design/assemble.py
```

- [ ] **Step 5: Verifikation (strukturell, kein Testrunner)**

```bash
python -c "
html = open('Berichte/index.html', encoding='utf-8').read()
assert 'PublicClientApplication' in html, 'MSAL-Bundle fehlt im Build'
print('OK: MSAL-Bundle eingebunden,', html.count('PublicClientApplication'), 'Fundstellen')
"
```

Erwartet: `OK: MSAL-Bundle eingebunden, N Fundstellen` (N ≥ 1), kein `AssertionError`.

- [ ] **Step 6: Commit**

```bash
git add Design/vendor/msal-browser.min.js Design/assemble.py Design/shell-template.html Berichte/index.html
git commit -m "feat: MSAL.js-Bibliothek fuer Microsoft-Anmeldung einbinden"
```

---

## Task 2: Konfigurationsdatei anlegen

**Files:**
- Create: `Design/graph-config.js`
- Modify: `Design/assemble.py`

**Interfaces:**
- Produces: `window.GRAPH_CONFIG` mit den Feldern `clientId`, `tenantId`,
  `redirectUri`, `driveId`, `itemId`, `dateiname` — von `graph-auth.js` (Task 4)
  und `graph-sync.js` (Task 5) gelesen.

- [ ] **Step 1: Datei anlegen**

```js
// Design/graph-config.js
// Werte werden bei der einmaligen Einrichtung eingetragen (siehe HANDOFF.md,
// Abschnitt "Einmalige Einrichtung"). Keine davon ist geheim: die clientId
// einer Public-Client-SPA ist nicht vertraulich, das Deployment ist bewusst
// oeffentlich (siehe design-spec-cloud-sync.md, Abschnitt "Architektur").
window.GRAPH_CONFIG = {
  clientId: '',    // Anwendungs-ID (Client) aus der Azure-AD-App-Registrierung
  tenantId: '',    // Verzeichnis-ID (Mandant) aus der Azure-AD-App-Registrierung
  redirectUri: window.location.origin + window.location.pathname,
  driveId: '',     // OneDrive-Laufwerks-ID des freigegebenen Ordners (Task 10)
  itemId: '',      // Element-ID des Ordners "Schulungsplaner" in diesem Laufwerk (Task 10)
  dateiname: 'schulungsdaten.json',
};
```

- [ ] **Step 2: In assemble.py core_js_parts aufnehmen**

In `Design/assemble.py` die Zeile

```python
for name in ["state-engine", "file-store", "ui-helpers"]:
```

ersetzen durch:

```python
for name in ["graph-config", "graph-auth", "graph-sync", "state-engine", "file-store", "ui-helpers"]:
```

(`graph-auth` und `graph-sync` existieren als leere/fehlende Dateien noch nicht —
das ist für diesen Task in Ordnung, `read()` liefert dann `""` als Vorgabewert.
Sie entstehen in Task 4 und 5.)

- [ ] **Step 3: Bauen**

```bash
python Design/assemble.py
```

- [ ] **Step 4: Verifikation**

```bash
python -c "
html = open('Berichte/index.html', encoding='utf-8').read()
assert 'window.GRAPH_CONFIG' in html, 'GRAPH_CONFIG fehlt im Build'
assert \"clientId: ''\" in html
print('OK: graph-config.js eingebunden')
"
```

- [ ] **Step 5: Commit**

```bash
git add Design/graph-config.js Design/assemble.py Berichte/index.html
git commit -m "feat: Konfigurationsgeruest fuer Microsoft-Anmeldung anlegen"
```

---

## Task 3: GitHub-Repository anlegen (geführt, Nutzerin führt aus)

Kein Code-Task. Ziel: eine feste, vorhersagbare URL bekommen, **bevor** die
Azure-AD-Registrierung (Task 4) sie als Redirect-URI braucht.

- [ ] **Step 1:** Nutzerin legt (falls noch nicht vorhanden) einen GitHub-Account
  für tribeta an oder nutzt einen vorhandenen.
- [ ] **Step 2:** Neues **öffentliches** Repository anlegen, z. B. `schulungsplaner`.
  Öffentlich ist hier unbedenklich — im Repo landet ausschließlich der App-Code,
  keine Nachweisdaten (siehe `design-spec-cloud-sync.md`, Abschnitt "Architektur").
- [ ] **Step 3:** Unter Repository → Settings → Pages: Quelle auf den Branch
  `main`, Ordner `/ (root)` oder `/docs` stellen (wird in Task 12 final
  konfiguriert, sobald der Code da ist).
- [ ] **Step 4:** Die resultierende URL notieren, Muster:
  `https://<github-nutzername>.github.io/schulungsplaner/` — diese URL wird in
  Task 4 als Redirect-URI gebraucht.

**Kein Commit in diesem Task** (reine Vorbereitung, kein Code geändert).

---

## Task 4: Azure-AD-App-Registrierung (geführt, Nutzerin führt aus)

Kein Code-Task, braucht den Admin-Zugriff der Nutzerin im Microsoft-365-Tenant.

- [ ] **Step 1:** [entra.microsoft.com](https://entra.microsoft.com) öffnen, mit
  dem tribeta-Admin-Konto anmelden.
- [ ] **Step 2:** App-Registrierungen → Neue Registrierung.
  - Name: `Schulungsplaner`
  - Unterstützte Kontotypen: **Nur Konten in diesem Organisationsverzeichnis**
    (Single-Tenant — das ist die Absicherung gegen Fremdzugriff aus der Spec)
  - Redirect-URI: Plattform **Single-Page Application (SPA)**, URL =
    die in Task 3 notierte GitHub-Pages-URL
- [ ] **Step 3:** Nach dem Anlegen: **Übersicht**-Seite notieren:
  - „Anwendungs-ID (Client)" → das ist `clientId`
  - „Verzeichnis-ID (Mandant)" → das ist `tenantId`
- [ ] **Step 4:** API-Berechtigungen → Berechtigung hinzufügen → Microsoft Graph
  → Delegierte Berechtigungen → `Files.ReadWrite` auswählen → Hinzufügen.
- [ ] **Step 5:** Diese beiden Werte (Client-ID, Tenant-ID) für Task 6 bereithalten.

**Kein Commit in diesem Task.**

---

## Task 5: `graph-config.js` mit echten Werten befüllen

**Files:**
- Modify: `Design/graph-config.js`

- [ ] **Step 1:** Die in Task 4 notierten Werte eintragen:

```js
window.GRAPH_CONFIG = {
  clientId: '<Anwendungs-ID aus Task 4>',
  tenantId: '<Verzeichnis-ID aus Task 4>',
  redirectUri: window.location.origin + window.location.pathname,
  driveId: '',     // folgt in Task 10
  itemId: '',      // folgt in Task 10
  dateiname: 'schulungsdaten.json',
};
```

- [ ] **Step 2: Bauen**

```bash
python Design/assemble.py
```

- [ ] **Step 3: Verifikation**

```bash
python -c "
html = open('Berichte/index.html', encoding='utf-8').read()
import re
m = re.search(r\"clientId: '([^']*)'\", html)
assert m and len(m.group(1)) > 10, 'clientId scheint nicht gesetzt'
print('OK: clientId gesetzt, Laenge', len(m.group(1)))
"
```

- [ ] **Step 4: Commit**

```bash
git add Design/graph-config.js Berichte/index.html
git commit -m "feat: Azure-AD-App-Registrierung in graph-config.js eintragen"
```

---

## Task 6: `graph-auth.js` — Anmeldelogik

**Files:**
- Create: `Design/graph-auth.js`

**Interfaces:**
- Consumes: `window.GRAPH_CONFIG` (Task 2/5), globales `msal` (Task 1).
- Produces: `graphSilentAnmeldung(): Promise<AuthResult|null>`,
  `graphInteraktiveAnmeldung(): Promise<AuthResult>`,
  `graphToken(): Promise<string>`, `graphAngemeldeterName(): string|null`,
  `graphAbmelden(): Promise<void>` — von `graph-sync.js` (Task 7) und
  `shell-template.html` (Task 8) sowie `einstellungen.js` (Task 11) genutzt.

- [ ] **Step 1: Datei schreiben**

```js
// Design/graph-auth.js
// Anmeldung mit dem tribeta-Microsoft-Konto per MSAL.js. Zwei getrennte
// Einstiege, weil Popups nur direkt aus einem Klick heraus funktionieren:
// graphSilentAnmeldung() beim Start (kein Popup, meldet nur ein vorhandenes
// Konto an), graphInteraktiveAnmeldung() nur aus einem Knopf-Klick heraus.

const GRAPH_SCOPES = ['Files.ReadWrite'];

let msalApp = null;

async function graphAuthKonfigurieren() {
  if (msalApp) return msalApp;
  msalApp = new msal.PublicClientApplication({
    auth: {
      clientId: window.GRAPH_CONFIG.clientId,
      authority: 'https://login.microsoftonline.com/' + window.GRAPH_CONFIG.tenantId,
      redirectUri: window.GRAPH_CONFIG.redirectUri,
    },
    cache: {
      cacheLocation: 'localStorage',
    },
  });
  await msalApp.initialize();
  return msalApp;
}

// Kein Popup: nutzt ein bereits im Browser vorhandenes Microsoft-Konto.
// Gibt null zurueck, wenn niemand angemeldet ist - dann muss
// graphInteraktiveAnmeldung() aus einem Knopf-Klick heraus folgen.
async function graphSilentAnmeldung() {
  const app = await graphAuthKonfigurieren();
  const konten = app.getAllAccounts();
  if (konten.length === 0) return null;
  app.setActiveAccount(konten[0]);
  try {
    return await app.acquireTokenSilent({ scopes: GRAPH_SCOPES, account: konten[0] });
  } catch (e) {
    return null;
  }
}

// Nur aus einem Klick-Handler aufrufen - der Browser blockiert Popups ohne
// direkte Nutzeraktion.
async function graphInteraktiveAnmeldung() {
  const app = await graphAuthKonfigurieren();
  const ergebnis = await app.loginPopup({ scopes: GRAPH_SCOPES });
  app.setActiveAccount(ergebnis.account);
  return ergebnis;
}

// Token fuer einen Graph-Aufruf nach erfolgreicher Anmeldung. Wirft, wenn
// niemand angemeldet ist - der Aufrufer zeigt dann den Anmelde-Bildschirm.
async function graphToken() {
  const app = await graphAuthKonfigurieren();
  const konto = app.getActiveAccount();
  if (!konto) throw new Error('Nicht angemeldet');
  const ergebnis = await app.acquireTokenSilent({ scopes: GRAPH_SCOPES, account: konto });
  return ergebnis.accessToken;
}

function graphAngemeldeterName() {
  if (!msalApp) return null;
  const konto = msalApp.getActiveAccount();
  return konto ? (konto.name || konto.username) : null;
}

async function graphAbmelden() {
  const app = await graphAuthKonfigurieren();
  const konto = app.getActiveAccount();
  return app.logoutPopup({ account: konto });
}
```

- [ ] **Step 2: Bauen**

```bash
python Design/assemble.py
```

- [ ] **Step 3: Verifikation**

```bash
python -c "
html = open('Berichte/index.html', encoding='utf-8').read()
for fn in ['graphSilentAnmeldung', 'graphInteraktiveAnmeldung', 'graphToken', 'graphAngemeldeterName', 'graphAbmelden']:
    assert ('function ' + fn) in html, fn + ' fehlt im Build'
print('OK: alle graph-auth-Funktionen im Build vorhanden')
"
```

- [ ] **Step 4: Commit**

```bash
git add Design/graph-auth.js Berichte/index.html
git commit -m "feat: Anmeldelogik fuer Microsoft-Login (graph-auth.js)"
```

---

## Task 7: `graph-sync.js` — Laden, Speichern, Konflikterkennung

**Files:**
- Create: `Design/graph-sync.js`

**Interfaces:**
- Consumes: `graphToken()` (Task 6), `window.STATE`, `speichereState()`,
  `pruefeImportStruktur()` (alle aus `state-engine.js`), `window.GRAPH_CONFIG`.
- Produces: `graphBeimStartLaden(): Promise<{geladen: boolean}>`,
  `graphDatenSpaeterSchreiben(): void` — von `state-engine.js` (Task 8) und
  `shell-template.html` (Task 9) genutzt.

- [ ] **Step 1: Datei schreiben**

```js
// Design/graph-sync.js
// Laedt und speichert schulungsdaten.json direkt im gemeinsamen
// OneDrive-Ordner ueber Microsoft Graph - ersetzt die fruehere
// Ablage-Loesung (Design/fragments/ablage.js, entfernt in Task 10), die sich
// im echten Einsatz als nicht zuverlaessig herausgestellt hat.
//
// Konfliktschutz: der zuletzt gelesene ETag wird gemerkt und beim Speichern
// per If-Match mitgeschickt. Hat sich die Datei seitdem geaendert, antwortet
// Graph mit 412 - dann wird NICHT ueberschrieben, sondern nachgefragt (siehe
// design-spec-cloud-sync.md, Abschnitt "Konflikterkennung beim Speichern").

window.GRAPH_STAND = { etag: null };

function graphDateiUrl() {
  const c = window.GRAPH_CONFIG;
  return `https://graph.microsoft.com/v1.0/drives/${c.driveId}/items/${c.itemId}:/${c.dateiname}:/content`;
}

async function graphDatenLesen() {
  const token = await graphToken();
  const antwort = await fetch(graphDateiUrl(), {
    headers: { Authorization: 'Bearer ' + token },
  });
  if (antwort.status === 404) return null;
  if (!antwort.ok) throw new Error('Laden fehlgeschlagen: ' + antwort.status);
  window.GRAPH_STAND.etag = antwort.headers.get('ETag');
  const text = await antwort.text();
  if (!text) return null;
  return JSON.parse(text);
}

// erzwingen=true ueberschreibt ohne ETag-Pruefung (Nutzerin hat den
// Konfliktdialog bewusst mit "trotzdem ueberschreiben" bestaetigt).
async function graphDatenSchreiben(erzwingen) {
  const token = await graphToken();
  const kopfzeilen = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  if (!erzwingen && window.GRAPH_STAND.etag) {
    kopfzeilen['If-Match'] = window.GRAPH_STAND.etag;
  }
  const antwort = await fetch(graphDateiUrl(), {
    method: 'PUT',
    headers: kopfzeilen,
    body: JSON.stringify(window.STATE, null, 2),
  });
  if (antwort.status === 412) {
    return { gespeichert: false, konflikt: true };
  }
  if (!antwort.ok) {
    return { gespeichert: false, konflikt: false, fehler: antwort.status };
  }
  window.GRAPH_STAND.etag = antwort.headers.get('ETag');
  return { gespeichert: true };
}

function graphUhrzeit() {
  const jetzt = new Date();
  return String(jetzt.getHours()).padStart(2, '0') + ':' + String(jetzt.getMinutes()).padStart(2, '0') + ' Uhr';
}

function graphStatusAnzeigen(text) {
  const feld = document.getElementById('graph-sync-status');
  if (feld) feld.textContent = text;
}

// Wird beim Start einmal aufgerufen (siehe shell-template.html) und beim
// erneuten Laden aus dem Konfliktdialog.
async function graphBeimStartLaden() {
  try {
    graphStatusAnzeigen('Lädt …');
    const daten = await graphDatenLesen();
    if (daten) {
      if (typeof pruefeImportStruktur === 'function') pruefeImportStruktur(daten);
      window.STATE = daten;
      speichereState(false);
    }
    graphStatusAnzeigen('Gespeichert um ' + graphUhrzeit());
    return { geladen: !!daten };
  } catch (e) {
    graphStatusAnzeigen('Laden fehlgeschlagen — bitte Seite neu laden');
    console.warn('Gemeinsamer Datenbestand nicht ladbar:', e);
    return { geladen: false, grund: e.message };
  }
}

// Nach jeder Aenderung schreiben - gebuendelt (debounced), damit nicht jede
// Eingabe einzeln ueber das Netz geht.
let graphSchreibTimer = null;
function graphDatenSpaeterSchreiben() {
  graphStatusAnzeigen('Speichert …');
  if (graphSchreibTimer) clearTimeout(graphSchreibTimer);
  graphSchreibTimer = setTimeout(() => {
    graphSchreibTimer = null;
    graphDatenSchreiben(false).then(r => {
      if (r.gespeichert) {
        graphStatusAnzeigen('Gespeichert um ' + graphUhrzeit());
        return;
      }
      if (r.konflikt) {
        graphKonfliktDialog();
        return;
      }
      graphStatusAnzeigen('Nicht gespeichert — erneut versuchen');
    }).catch(e => {
      graphStatusAnzeigen('Nicht gespeichert — erneut versuchen');
      console.warn('Speichern fehlgeschlagen:', e);
    });
  }, 2000);
}

function graphKonfliktDialog() {
  const neuLaden = confirm(
    'Jemand anderes hat zwischenzeitlich gespeichert.\n\n'
    + 'OK = jetzt neu laden (eigene ungespeicherte Änderungen gehen verloren)\n'
    + 'Abbrechen = trotzdem mit dem eigenen Stand überschreiben'
  );
  if (neuLaden) {
    graphBeimStartLaden().then(() => { if (typeof renderAll === 'function') renderAll(); });
  } else {
    graphDatenSchreiben(true).then(r => {
      graphStatusAnzeigen(r.gespeichert ? 'Gespeichert um ' + graphUhrzeit() : 'Nicht gespeichert — erneut versuchen');
    });
  }
}
```

- [ ] **Step 2: Bauen**

```bash
python Design/assemble.py
```

- [ ] **Step 3: Verifikation**

```bash
python -c "
html = open('Berichte/index.html', encoding='utf-8').read()
for fn in ['graphBeimStartLaden', 'graphDatenSpaeterSchreiben', 'graphDatenSchreiben', 'graphKonfliktDialog']:
    assert ('function ' + fn) in html, fn + ' fehlt im Build'
assert 'If-Match' in html, 'ETag-Konfliktpruefung fehlt'
print('OK: graph-sync.js vollstaendig im Build, ETag-Pruefung vorhanden')
"
```

- [ ] **Step 4: Commit**

```bash
git add Design/graph-sync.js Berichte/index.html
git commit -m "feat: Laden/Speichern der gemeinsamen Daten ueber Microsoft Graph (graph-sync.js)"
```

---

## Task 8: `state-engine.js` auf Graph-Sync umstellen

**Files:**
- Modify: `Design/state-engine.js:35-37`

**Interfaces:**
- Consumes: `graphDatenSpaeterSchreiben()` (Task 7).

- [ ] **Step 1: Ablage-Aufruf ersetzen**

In `Design/state-engine.js`, den bestehenden Block

```js
  // Ist ein Ablageordner eingerichtet, ist die Datei dort der gemeinsame
  // Stand; der localStorage bleibt die schnelle lokale Kopie.
  if (zaehlen && typeof ablageDatenSpaeterSchreiben === 'function') {
    ablageDatenSpaeterSchreiben();
  }
```

ersetzen durch:

```js
  // Der gemeinsame Datenbestand liegt in der Cloud (siehe graph-sync.js);
  // localStorage bleibt die schnelle lokale Zwischenkopie.
  if (zaehlen && typeof graphDatenSpaeterSchreiben === 'function') {
    graphDatenSpaeterSchreiben();
  }
```

- [ ] **Step 2: Bauen**

```bash
python Design/assemble.py
```

- [ ] **Step 3: Verifikation**

```bash
python -c "
html = open('Berichte/index.html', encoding='utf-8').read()
# Nur der Aufruf, nicht die Funktionsdefinition selbst - die steht bis
# Task 10 (ablage.js loeschen) noch im Build, nur ungenutzt.
assert 'ablageDatenSpaeterSchreiben();' not in html, 'alter Ablage-Aufruf noch vorhanden'
assert 'graphDatenSpaeterSchreiben()' in html
print('OK: speichereState() ruft graphDatenSpaeterSchreiben(), kein Aufruf von ablageDatenSpaeterSchreiben() mehr')
"
```

- [ ] **Step 4: Commit**

```bash
git add Design/state-engine.js Berichte/index.html
git commit -m "feat: speichereState() auf Graph-Sync umstellen"
```

---

## Task 9: Anmelde-Bildschirm in `shell-template.html`

**Files:**
- Modify: `Design/shell-template.html:98-100` (HTML, neuer Block nach `dialog-overlay`)
- Modify: `Design/shell-template.html:204-215` (bisheriger Ablage-Block wird ersetzt)
- Modify: `Design/styles.css` (neue Klassen `.anmelde-bildschirm`, `.anmelde-karte`)

**Interfaces:**
- Consumes: `graphSilentAnmeldung()`, `graphInteraktiveAnmeldung()` (Task 6),
  `graphBeimStartLaden()` (Task 7), `statusAutomatikAnwenden()`, `renderAll()`
  (beide bereits vorhanden).

- [ ] **Step 1: Overlay-HTML einfügen**

In `Design/shell-template.html`, direkt nach dem bestehenden Block

```html
<div id="dialog-overlay" class="dialog-overlay" style="display:none">
  <div id="dialog-container" class="dialog"></div>
</div>
```

folgenden neuen Block einfügen:

```html
<div id="anmelde-bildschirm" class="anmelde-bildschirm">
  <div class="anmelde-karte">
    <h1>Schulungsplaner</h1>
    <p id="anmelde-text">Anmeldung wird geprüft …</p>
    <button id="anmelde-knopf" class="btn btn-primary" style="display:none" onclick="anmeldeStarten()">Mit Microsoft anmelden</button>
  </div>
</div>
```

- [ ] **Step 2: CSS ergänzen**

Am Ende von `Design/styles.css` anfügen:

```css
/* ---- Anmelde-Bildschirm (Microsoft-Login) ---- */
.anmelde-bildschirm {
  position: fixed;
  inset: 0;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}
.anmelde-karte {
  background: var(--card-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-pop);
  padding: 40px 48px;
  text-align: center;
  max-width: 360px;
}
.anmelde-karte h1 {
  font-family: var(--font-display);
  color: var(--ink);
  font-size: 22px;
  margin: 0 0 12px;
}
.anmelde-karte p {
  font-family: var(--font-body);
  color: var(--text);
  margin: 0 0 20px;
}
```

- [ ] **Step 3: Alten Ablage-Startblock ersetzen**

Den bestehenden Block

```js
renderAll();

// Ist ein Ablageordner eingerichtet, ist die Datei dort der gemeinsame Stand.
// Sie wird nach dem ersten Zeichnen geladen (der Zugriff ist asynchron und
// braucht ggf. eine Bestaetigung) und ersetzt dann die lokale Kopie.
if (typeof ablageBeimStartLaden === 'function') {
  ablageBeimStartLaden().then(function (r) {
    if (r.geladen) {
      statusAutomatikAnwenden();
      renderAll();
      console.info('Gemeinsamer Datenbestand aus dem Ablageordner geladen.');
    }
  });
}
```

ersetzen durch:

```js
// Erst anmelden und den gemeinsamen Stand laden, dann rendern - vorher
// zeigt die App bewusst nichts (siehe design-spec-cloud-sync.md, Abschnitt
// "Anmeldung": "Ohne gueltige Anmeldung: ausschliesslich der
// Anmelde-Bildschirm, keine Daten, keine Formulare").
async function anmeldeLadeUndZeige() {
  document.getElementById('anmelde-text').textContent = 'Daten werden geladen …';
  await graphBeimStartLaden();
  if (typeof statusAutomatikAnwenden === 'function') statusAutomatikAnwenden();
  renderAll();
  document.getElementById('anmelde-bildschirm').style.display = 'none';
}

async function anmeldeAblauf() {
  const text = document.getElementById('anmelde-text');
  const knopf = document.getElementById('anmelde-knopf');
  text.textContent = 'Anmeldung wird geprüft …';
  const still = await graphSilentAnmeldung().catch(() => null);
  if (!still) {
    text.textContent = 'Bitte mit dem tribeta-Microsoft-Konto anmelden.';
    knopf.style.display = '';
    return;
  }
  await anmeldeLadeUndZeige();
}

// Nur aus diesem Klick-Handler heraus interaktiv anmelden - Popups ohne
// direkte Nutzeraktion werden vom Browser blockiert.
async function anmeldeStarten() {
  const text = document.getElementById('anmelde-text');
  const knopf = document.getElementById('anmelde-knopf');
  knopf.style.display = 'none';
  text.textContent = 'Anmeldung läuft …';
  try {
    await graphInteraktiveAnmeldung();
    await anmeldeLadeUndZeige();
  } catch (e) {
    console.warn('Anmeldung fehlgeschlagen:', e);
    text.textContent = 'Anmeldung fehlgeschlagen oder abgebrochen.';
    knopf.style.display = '';
  }
}

anmeldeAblauf();
```

Die vorherige, unbedingte `renderAll();`-Zeile entfällt damit — das erste
Rendern passiert jetzt ausschließlich innerhalb von `anmeldeLadeUndZeige()`,
nachdem Anmeldung und Laden erfolgreich waren.

- [ ] **Step 4: Bauen**

```bash
python Design/assemble.py
```

- [ ] **Step 5: Verifikation**

```bash
python -c "
html = open('Berichte/index.html', encoding='utf-8').read()
assert 'id=\"anmelde-bildschirm\"' in html
assert 'function anmeldeAblauf' in html
assert 'function anmeldeStarten' in html
assert 'ablageBeimStartLaden' not in html, 'alter Ablage-Startaufruf noch vorhanden'
print('OK: Anmelde-Bildschirm im Build, alter Ablage-Start entfernt')
"
```

- [ ] **Step 6: Manuelle Verifikation (kein Login nötig)**

Datei `Berichte/index.html` im Browser öffnen (Chrome oder Edge). Erwartet:
- Sofort erscheint die Karte "Schulungsplaner" mit dem Text "Bitte mit dem
  tribeta-Microsoft-Konto anmelden." und dem Knopf "Mit Microsoft anmelden".
- **Kein** Blick auf Kurse/Termine/Navigation dahinter — die App-Oberfläche
  ist vollständig verdeckt.
- Browser-Konsole zeigt keine Fehler außer ggf. einem MSAL-Hinweis zur
  fehlenden Redirect-URI-Konfiguration (erwartbar, solange Task 3/4 nicht mit
  der tatsächlich gehosteten URL abgeglichen sind — wird in Task 12 final
  geprüft).

- [ ] **Step 7: Commit**

```bash
git add Design/shell-template.html Design/styles.css Berichte/index.html
git commit -m "feat: Anmelde-Bildschirm vor der App-Oberflaeche einbauen"
```

---

## Task 10: Alte Ablage-Anbindung entfernen

> **Nachtrag aus der Umsetzung:** Beim tatsächlichen Ausführen dieses Tasks
> zeigte sich, dass `ablageDokument()`, `ablageZustand()` und
> `ablageAlleDokumente()` **ungeschützt** (kein `typeof`-Check) noch an vier
> weiteren Stellen aufgerufen wurden, die dieser Plan ursprünglich nicht
> aufgeführt hatte: allen vier Druckfunktionen in `druck-vorlagen.js`
> (`druckeZertifikat`, `druckeAnwesenheitsliste`, `druckeFirmenNachweis`,
> `druckeAbschlussbericht`) sowie `detailNachAbschlussSichern()` in
> `page-schulungdetail.js`. Ohne Korrektur hätte das Löschen von `ablage.js`
> **jeden Ausdruck einer Bescheinigung/Anwesenheitsliste/eines Berichts zum
> Absturz gebracht** (die try/catch-Blöcke dort fangen den entstehenden
> `ReferenceError` ab und verhindern damit den Druck komplett, statt ihn
> durchzulassen). Ergänzend zu den Schritten unten wurden daher auch
> entfernt:
> - in `druck-vorlagen.js`: die vier `ablageDokument(...)`-Aufrufe direkt vor
>   dem jeweiligen `druckeInhalt(...)` — der Druck selbst bleibt unverändert.
> - in `page-schulungdetail.js`: `detailNachAbschlussSichern()` komplett
>   vereinfacht auf die Sicherungs-Download-Nachfrage (kein Ablage-Zweig
>   mehr, kein `terminId`-Parameter mehr nötig); Aufruf in
>   `detailSpeichereAbschluss()` entsprechend ohne Argument angepasst.
>
> Wer diesen Plan nachträglich noch einmal ausführt (z. B. in einer anderen
> Kopie des Projekts), sollte vor Step 4 (Bauen) einmal
> `grep -rn "ablageDokument\|ablageZustand\|ablageAlleDokumente" Design/`
> laufen lassen, um sicherzugehen, dass keine weiteren ungeschützten
> Aufrufstellen existieren.

**Files:**
- Delete: `Design/fragments/ablage.js`
- Modify: `Design/assemble.py`
- Modify: `Design/fragments/einstellungen.js:69-83`
- Modify: `Design/fragments/druck-vorlagen.js` (vier `ablageDokument(...)`-Aufrufe entfernt)
- Modify: `Design/fragments/page-schulungdetail.js` (`detailNachAbschlussSichern` vereinfacht)

**Interfaces:**
- Consumes: `graphAngemeldeterName()`, `graphAbmelden()` (Task 6).

- [ ] **Step 1: Datei löschen**

```bash
git rm Design/fragments/ablage.js
```

- [ ] **Step 2: Aus assemble.py entfernen**

In `Design/assemble.py` die Zeile

```python
for extra in ["druck-vorlagen", "einstellungen", "ablage"]:
```

ersetzen durch:

```python
for extra in ["druck-vorlagen", "einstellungen"]:
```

- [ ] **Step 3: Ablageordner-Feld im Einstellungsdialog ersetzen**

In `Design/fragments/einstellungen.js`, den Block

```html
      <div class="field">
        <label>Ablageordner für Dokumente und Sicherungen</label>
        <div id="einst-ablage-zustand" class="einst-ablage">wird geprüft …</div>
        <div class="einst-bildaktionen" style="margin-top:8px;">
          <button type="button" class="btn" id="einst-ablage-knopf" onclick="einstellungenAblageWaehlen()">Ordner wählen</button>
          <button type="button" class="btn" onclick="einstellungenSicherungJetzt()">Alles sichern und ablegen</button>
        </div>
        <div class="field-hint">
          Dort landen die Dokumente (je Termin ein Unterordner) <strong>und der gemeinsame
          Datenbestand</strong>. Liegt der Ordner in OneDrive, arbeiten alle auf demselben Stand:
          App öffnen, hier denselben Ordner wählen, fertig. Zur Sicherheit liegt im Ordner die
          Datei <em>ABLAGE-Schulungsplaner.txt</em>, damit im Explorer erkennbar ist, welcher es ist.
          Abgelegt wird HTML; jede Datei hat einen Knopf „Als PDF speichern".
        </div>
      </div>
```

ersetzen durch:

```html
      <div class="field">
        <label>Cloud-Verbindung</label>
        <div class="einst-ablage">Angemeldet als <strong>${escHtml(graphAngemeldeterName() || 'unbekannt')}</strong></div>
        <div class="einst-bildaktionen" style="margin-top:8px;">
          <button type="button" class="btn btn-ghost-red" onclick="graphAbmelden()">Abmelden</button>
        </div>
        <div class="field-hint">
          Kurse, Termine, Buchungen und Teilnehmer liegen automatisch im gemeinsamen
          OneDrive-Ordner. Jede angemeldete Person sieht denselben Stand — kein
          manuelles Verbinden nötig.
        </div>
      </div>
```

Direkt danach, in derselben Datei, die Funktionen `einstellungenAblageWaehlen`
und `einstellungenAblageZustandZeigen` sowie den Aufruf
`einstellungenAblageZustandZeigen();` am Ende von `oeffneEinstellungenDialog()`
entfernen (sie gehören ausschließlich zur alten Ablage-Lösung).

Zusätzlich die komplette Funktion `einstellungenSicherungJetzt()` (aktuell
Zeilen 139–174, direkt nach dem oben ersetzten Block) entfernen:

```js
// Legt den Datenbestand ab und dazu die Dokumente aller Termine, die
// abgeschlossen sind - so ist nach einem Klick alles gesichert, was fertig ist.
function einstellungenSicherungJetzt() {
  const abgeschlossene = window.STATE.kurse
    .flatMap(k => k.termine)
    .filter(t => t.abschluss);

  const frage = abgeschlossene.length
    ? `Datenbestand sichern und die Dokumente von ${abgeschlossene.length} abgeschlossenen Termin(en) ablegen?\n\n`
      + 'Dabei werden fehlende Bescheinigungen erzeugt und ihre Nummern vergeben.'
    : 'Datenbestand jetzt im Ablageordner sichern?';
  if (!confirm(frage)) return;

  ablageSicherung().then(async ergebnis => {
    if (!ergebnis.abgelegt) {
      alert('Sicherung nicht abgelegt (' + ergebnis.grund + ').\n'
        + 'Über „Exportieren" in der Seitenleiste geht es weiterhin als Download.');
      return;
    }
    let dateien = 0;
    const fehler = [];
    for (const termin of abgeschlossene) {
      try {
        const r = await ablageAlleDokumente(termin.id);
        dateien += r.erledigt.length;
        fehler.push(...r.fehler);
      } catch (e) {
        fehler.push(e.message);
      }
    }
    const zeilen = ['Datensicherung: ' + ergebnis.pfad];
    if (abgeschlossene.length) zeilen.push(`${dateien} Dokument(e) abgelegt.`);
    if (fehler.length) zeilen.push('\nNicht abgelegt:\n' + fehler.join('\n'));
    alert(zeilen.join('\n'));
  }).catch(e => alert('Sicherung fehlgeschlagen: ' + e.message));
}
```

Sie besteht vollständig aus Aufrufen von `ablageSicherung()` und
`ablageAlleDokumente()` (beide aus dem gelöschten `ablage.js`) und hat ohne
diese keinen eigenständigen Zweck mehr — ihr einziger Aufrufer war der
Knopf „Alles sichern und ablegen", der im obigen HTML-Block bereits entfernt
wurde. Die reguläre Datensicherung läuft nach dieser Umstellung automatisch
über `graphDatenSpaeterSchreiben()` bei jeder Änderung; ein manueller
"Jetzt sichern"-Knopf ist damit nicht mehr nötig (siehe Scope-Abgrenzung
oben — Dokumentablage ist YAGNI für diesen Plan).

- [ ] **Step 4: Bauen**

```bash
python Design/assemble.py
```

- [ ] **Step 5: Verifikation**

```bash
python -c "
html = open('Berichte/index.html', encoding='utf-8').read()
assert 'showDirectoryPicker' not in html, 'alte Ablage-Logik noch im Build'
assert 'einstellungenAblageWaehlen' not in html
assert 'einstellungenSicherungJetzt' not in html, 'verwaiste Ablage-Sicherungsfunktion noch im Build'
assert 'ablageSicherung' not in html
assert 'ablageDokument(' not in html, 'unguarded ablageDokument-Aufruf noch im Build (siehe Nachtrag oben)'
assert 'ablageZustand' not in html
assert 'ablageAlleDokumente' not in html
assert 'graphAbmelden' in html
assert 'function druckeZertifikat' in html
assert 'function detailNachAbschlussSichern' in html
print('OK: Ablage-Logik vollstaendig entfernt (inkl. Druckvorlagen + Abschluss-Dialog), Cloud-Status im Einstellungsdialog')
"
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: alte Ablage-Loesung entfernen, Cloud-Anmeldestatus im Einstellungsdialog"
```

---

## Task 11: Hilfeseite aktualisieren

> **Nachtrag aus der Umsetzung:** Die Bestätigungstexte von `zuruecksetzenAufBeispieldaten()`
> und `alleDatenLeeren()` (`Design/state-engine.js`) warnten noch so, als
> betreffe die Aktion nur den lokalen Browser — tatsächlich schreiben beide
> über `speichereState()` jetzt automatisch in den gemeinsamen Cloud-Bestand,
> betreffen also alle angemeldeten Personen. Beide Texte ergänzt: "Das
> betrifft den gemeinsamen Datenbestand in der Cloud — alle angemeldeten
> Personen [...]". Nicht ursprünglich in diesem Plan vorgesehen, aber eine
> direkte Konsequenz der Umstellung und sicherheitsrelevant genug, um sie
> hier mitzunehmen statt zu verschieben.

**Files:**
- Modify: `Design/fragments/page-hilfe.html`
- Modify: `Design/state-engine.js` (Bestätigungstexte von `zuruecksetzenAufBeispieldaten()` und `alleDatenLeeren()`)

- [ ] **Step 1: "Wo die Daten liegen" korrigieren**

Den Absatz

```html
<p>Alle Daten liegen <strong>ausschließlich lokal in diesem Browser</strong> auf diesem Rechner. Es gibt keinen Server, nichts wird übertragen. Ein anderer Browser oder ein anderer Rechner sieht diese Daten nicht.</p>
```

ersetzen durch:

```html
<p>Alle Daten liegen im gemeinsamen OneDrive-Ordner von tribeta. Nach der Anmeldung mit dem tribeta-Microsoft-Konto lädt die App automatisch den aktuellen Stand — jede angemeldete Person sieht dieselben Kurse, Termine und Buchungen wie alle anderen, ohne etwas manuell zu übertragen.</p>
```

- [ ] **Step 2: Ablage-Erwähnungen in derselben Datei suchen und bereinigen**

```bash
grep -n "Ablage\|showDirectoryPicker\|Ordner wählen" "Design/fragments/page-hilfe.html"
```

Jede Fundstelle einzeln ansehen und auf den neuen automatischen Ablauf
umschreiben (kein Ordner-Auswahlschritt mehr) oder entfernen, falls sie
ausschließlich den alten Mechanismus beschreibt.

- [ ] **Step 3: Bauen**

```bash
python Design/assemble.py
```

- [ ] **Step 4: Verifikation**

```bash
python -c "
html = open('Berichte/index.html', encoding='utf-8').read()
assert 'ausschließlich lokal in diesem Browser' not in html
print('OK: Hilfeseite korrigiert')
"
```

- [ ] **Step 5: Commit**

```bash
git add Design/fragments/page-hilfe.html Berichte/index.html
git commit -m "docs: Hilfeseite auf automatischen Cloud-Zugriff aktualisieren"
```

---

## Task 12: OneDrive-Laufwerks-/Ordner-ID auflösen (geführt)

Kein Code-Task im engeren Sinn — liefert die letzten beiden `graph-config.js`-Werte.

- [ ] **Step 1:** Nutzerin öffnet [OneDrive im Web](https://onedrive.live.com),
  navigiert zum Ordner `Claude-tribeta-Tools/Schulungsplaner`, Rechtsklick →
  „Link kopieren" (Freigabe-Link des Ordners).
- [ ] **Step 2:** [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)
  öffnen, mit dem tribeta-Konto anmelden.
- [ ] **Step 3:** Den kopierten Link in Base64url kodieren (Graph Explorer hat
  dafür ein Feld, oder online mit `u!` + Base64url-Kodierung des Links gemäß
  [Microsoft-Dokumentation zu geteilten Elementen](https://learn.microsoft.com/graph/api/shares-get)).
- [ ] **Step 4:** Anfrage ausführen: `GET /shares/{kodierter-link}/driveItem`
- [ ] **Step 5:** In der Antwort `parentReference.driveId` → das ist `driveId`,
  und `id` → das ist `itemId`.
- [ ] **Step 6:** Beide Werte in `Design/graph-config.js` eintragen.
- [ ] **Step 7: Bauen und committen**

```bash
python Design/assemble.py
git add Design/graph-config.js Berichte/index.html
git commit -m "feat: OneDrive-Ordner-ID in graph-config.js eintragen"
```

---

## Task 13: Auf GitHub veröffentlichen

**Files:** keine Quelländerung, nur Veröffentlichung.

- [ ] **Step 1:** Repository-Inhalt (mindestens `Berichte/index.html`, gerne
  das ganze Repo für Nachvollziehbarkeit) in das in Task 3 angelegte
  GitHub-Repository pushen.
- [ ] **Step 2:** GitHub Pages ggf. final auf den richtigen Ordner/Branch
  einstellen (Repository → Settings → Pages).
- [ ] **Step 3:** Warten, bis GitHub die Seite gebaut hat (Reiter „Actions"
  oder die grüne Meldung unter Settings → Pages), dann die URL öffnen.
- [ ] **Step 4:** Prüfen, dass die tatsächliche Pages-URL **exakt** der in
  Task 4 hinterlegten Redirect-URI entspricht (inklusive Groß-/Kleinschreibung
  und abschließendem `/`). Weicht sie ab: in Entra ID unter der
  App-Registrierung → Authentifizierung die Redirect-URI korrigieren.

**Kein Commit in diesem Task** (Veröffentlichung, keine Quelländerung).

---

## Task 14: Solo-Test (Nutzerin allein, von mir gegengeprüft)

- [ ] **Step 1:** Nutzerin öffnet die GitHub-Pages-URL, meldet sich mit dem
  tribeta-Konto an.
- [ ] **Step 2:** Erwartet: Anmelde-Bildschirm kurz sichtbar, dann die normale
  App-Oberfläche, unten der Status „Gespeichert um HH:MM Uhr".
- [ ] **Step 3:** Testweise einen Trainer oder Kurs anlegen.
- [ ] **Step 4:** Ich prüfe direkt im Anschluss die Datei im OneDrive-Ordner
  (lokal über den synchronisierten Pfad lesbar, unabhängig vom Browser-Login).
  `graph-config.js` legt die Datei über `itemId` direkt in die Wurzel des
  Ordners `Schulungsplaner` (nicht in den alten `Ablage`-Unterordner):

```bash
python -c "
import json, os
pfad = r'C:\Hinschg\OneDrive - HinSchG Meldungen GbR\Claude-tribeta-Tools\Schulungsplaner\schulungsdaten.json'
print('Zuletzt geaendert:', __import__('datetime').datetime.fromtimestamp(os.path.getmtime(pfad)))
d = json.load(open(pfad, encoding='utf-8'))
print('Kurse:', len(d['kurse']), '· Trainer:', len(d['trainer']))
"
```

Erwartet: Die neu angelegten Testdaten sind in der Datei sichtbar, der
Änderungszeitpunkt liegt im Bereich der letzten Minute.

- [ ] **Step 5:** Nur wenn Step 4 erfolgreich war: weiter zu Task 15. Sonst:
  Fehlermeldung in der Browser-Konsole der Nutzerin einsammeln und die
  jeweilige Stelle in `graph-sync.js`/`graph-auth.js` gezielt nachbessern.

---

## Task 15: Gemeinsamer Test mit dem Kollegen

- [ ] **Step 1:** Kollege öffnet dieselbe GitHub-Pages-URL, meldet sich mit
  seinem eigenen tribeta-Konto an.
- [ ] **Step 2:** Erwartet: Er sieht sofort den Testkurs/-trainer aus Task 14,
  ohne irgendeinen manuellen Schritt.
- [ ] **Step 3:** Kollege legt testweise einen zweiten Eintrag an.
- [ ] **Step 4:** Nutzerin lädt ihre offene Seite neu (F5) — Erwartet: der
  Eintrag des Kollegen erscheint.
- [ ] **Step 5:** Beide Richtungen bestätigt funktionierend → Umstellung
  abgeschlossen. HANDOFF.md entsprechend aktualisieren (nächster Task).

---

## Task 16: HANDOFF.md aktualisieren und finaler Commit

**Files:**
- Modify: `.claude/HANDOFF.md`

- [ ] **Step 1:** Neuen Abschnitt ergänzen: Cloud-Sync über Microsoft-Login
  umgesetzt, Ablage-Lösung entfernt, gemeinsamer Test mit Kollegen erfolgreich
  (Datum, wer getestet hat). Verweis auf `design-spec-cloud-sync.md` und
  `implementation-plan-cloud-sync.md`.
- [ ] **Step 2:** Abschnitt „Offen" bereinigen: den bisherigen Punkt zum
  Ablageordner-Funktionstest als erledigt markieren/entfernen.
- [ ] **Step 3: Commit**

```bash
git add .claude/HANDOFF.md
git commit -m "docs: HANDOFF auf abgeschlossene Cloud-Sync-Umstellung bringen"
```
