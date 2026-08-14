# Umsetzungsplan: Cloudflare-native Architektur (Access + R2)

Setzt `Design/design-spec-cloudflare-native.md` um. Löst den
Microsoft-Login/Graph-API-Ansatz aus `implementation-plan-cloud-sync.md`
vollständig ab.

## Globale Vorgaben

- Kein Node.js/npm, kein automatisierter Testrunner — Verifikation über
  strukturelle Prüfungen gegen die gebaute `Berichte/index.html` /
  `docs/index.html` sowie manuelle Tests im Browser.
- `Berichte/index.html` und `docs/index.html` **nie von Hand** bearbeiten —
  immer `python Design/assemble.py`.
- Anfängliche Zugriffsliste: `dreiling@tribeta-group.de`,
  `fuetterer@tribeta-group.de`, `finocchietti@tribeta-group.de`.
- Reihenfolge wichtig: Daten migrieren (Task 4), **bevor** die neue Version
  veröffentlicht wird (Task 13) — sonst startet die neue Version leer.

---

## Task 1: Cloudflare-R2-Bucket anlegen (Nutzerin)

- [ ] **Schritt 1:** Cloudflare-Dashboard → linkes Menü → „Storage &
  databases" → „R2 Object Storage".
- [ ] **Schritt 2:** „Create bucket" → Name `schulungsplaner-daten` →
  erstellen (Standardeinstellungen reichen, kein öffentlicher Zugriff nötig).

**Kein Commit** (reine Cloudflare-Einrichtung).

---

## Task 2: Cloudflare Access einrichten (Nutzerin, mit Anleitung)

- [ ] **Schritt 1:** Cloudflare-Dashboard → „Zero Trust" (im Hauptmenü oder
  über zero-trust-Unterdomain) → einmalige Ersteinrichtung, falls Zero Trust
  noch nie genutzt wurde (Team-Name vergeben, kostenloser Plan reicht).
- [ ] **Schritt 2:** „Access" → „Applications" → „Add an application" →
  Typ „Self-hosted".
- [ ] **Schritt 3:** Domain: `schulungsplaner.pages.dev` eintragen
  (Application name z. B. „Schulungsplaner").
- [ ] **Schritt 4:** Policy erstellen: Name z. B. „Zugelassene Personen",
  Action „Allow", Include-Regel „Emails" mit genau diesen drei Adressen:
  `dreiling@tribeta-group.de`, `fuetterer@tribeta-group.de`,
  `finocchietti@tribeta-group.de`.
- [ ] **Schritt 5:** Speichern. Ab jetzt verlangt jeder Aufruf von
  `schulungsplaner.pages.dev` eine Anmeldung über diese Liste — das gilt auch
  schon für die noch unveränderte Microsoft-Login-Version, das ist normal
  und wird erst mit Task 13 final getestet.

**Kein Commit** (reine Cloudflare-Einrichtung).

---

## Task 3: R2-Bucket mit dem Pages-Projekt verknüpfen (Nutzerin, mit Anleitung)

- [ ] **Schritt 1:** Cloudflare-Dashboard → „Workers & Pages" →
  `schulungsplaner` → „Settings" → „Bindings" (bzw. „Functions" →
  „R2 bucket bindings", je nach Oberfläche).
- [ ] **Schritt 2:** Neue Bindung hinzufügen: Variablenname **`SCHULUNGSDATEN`**
  (Groß-/Kleinschreibung wichtig — muss exakt zu `functions/api/daten.js`
  passen), Bucket `schulungsplaner-daten` auswählen.
- [ ] **Schritt 3:** Für „Production" **und** „Preview" Umgebung binden
  (beide Häkchen setzen, falls einzeln abgefragt).
- [ ] **Schritt 4:** Speichern.

**Kein Commit** (reine Cloudflare-Einrichtung).

---

## Task 4: Bestehende Daten nach R2 migrieren (gemeinsam)

- [ ] **Schritt 1:** Aktuellen Inhalt der Datei
  `C:\Hinschg\OneDrive - HinSchG Meldungen GbR\Claude-tribeta-Tools\Schulungsplaner\schulungsdaten.json`
  öffnen (das ist der lokal synchronisierte Stand aus dem OneDrive).
- [ ] **Schritt 2:** Cloudflare-Dashboard → R2 → Bucket
  `schulungsplaner-daten` → „Upload" → die Datei hochladen, dabei den
  Objektnamen exakt auf `schulungsdaten.json` setzen (kein Unterordner).
- [ ] **Schritt 3:** Gegenprüfen: Objekt im Bucket anklicken, Inhalt/Größe
  plausibel (sollte den „Test-Kurs" und ggf. weitere Testeinträge von heute
  enthalten).

**Kein Commit** (Datenmigration, kein Code).

---

## Task 5: `functions/api/daten.js` schreiben

**Dateien:**
- Neu: `functions/api/daten.js`

- [ ] **Schritt 1: Datei anlegen**

```js
// functions/api/daten.js
// Liest/schreibt schulungsdaten.json in R2. Cloudflare Access schuetzt die
// gesamte Domain bereits davor - jede Anfrage, die hier ankommt, kommt
// zwangslaeufig von einer zugelassenen E-Mail-Adresse (siehe
// design-spec-cloudflare-native.md).
const SCHLUESSEL = 'schulungsdaten.json';

export async function onRequestGet(context) {
  const objekt = await context.env.SCHULUNGSDATEN.get(SCHLUESSEL);
  if (!objekt) {
    return new Response(null, { status: 404 });
  }
  const text = await objekt.text();
  return new Response(text, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'ETag': objekt.httpEtag,
    },
  });
}

export async function onRequestPut(context) {
  const ifMatch = context.request.headers.get('If-Match');
  const body = await context.request.text();
  const optionen = { httpMetadata: { contentType: 'application/json' } };
  if (ifMatch) {
    optionen.onlyIf = { etagMatches: ifMatch };
  }
  const ergebnis = await context.env.SCHULUNGSDATEN.put(SCHLUESSEL, body, optionen);
  if (!ergebnis) {
    // onlyIf griff nicht: die Datei hat sich seit dem letzten Lesen geaendert.
    return new Response(JSON.stringify({ konflikt: true }), { status: 412 });
  }
  return new Response(JSON.stringify({ gespeichert: true }), {
    status: 200,
    headers: { 'ETag': ergebnis.httpEtag },
  });
}
```

- [ ] **Schritt 2: Commit**

```bash
git add functions/api/daten.js
git commit -m "feat: Cloudflare Pages Function fuer R2-Datenzugriff (GET/PUT mit ETag-Konfliktschutz)"
```

---

## Task 6: `Design/cf-sync.js` schreiben

**Dateien:**
- Neu: `Design/cf-sync.js`

**Interfaces:**
- Produces: `cfBeimStartLaden()` (von `shell-template.html` beim Start
  aufgerufen), `cfDatenSpaeterSchreiben()` (von `state-engine.js` nach jeder
  Änderung aufgerufen).
- Konsumiert: `window.STATE`, `speichereState()`, `pruefeImportStruktur()`,
  `statusAutomatikAnwenden()`, `renderAll()` (alle aus bestehenden Dateien).

- [ ] **Schritt 1: Datei anlegen**

```js
// Design/cf-sync.js
// Laedt und speichert schulungsdaten.json ueber die Cloudflare Pages
// Function /api/daten - ersetzt die fruehere Microsoft-Graph-Anbindung.
// Cloudflare Access schuetzt den Zugriff bereits auf Ebene der ganzen Seite,
// hier ist keine eigene Anmeldung noetig.
//
// Konfliktschutz: der zuletzt gelesene ETag wird gemerkt und beim Speichern
// per If-Match mitgeschickt. Hat sich die Datei seitdem geaendert, antwortet
// die Function mit 412 - dann wird NICHT ueberschrieben, sondern nachgefragt.

window.CF_STAND = { etag: null };

async function cfDatenLesen() {
  const antwort = await fetch('/api/daten');
  if (antwort.status === 404) return null;
  if (!antwort.ok) throw new Error('Laden fehlgeschlagen: ' + antwort.status);
  window.CF_STAND.etag = antwort.headers.get('ETag');
  const text = await antwort.text();
  if (!text) return null;
  return JSON.parse(text);
}

// erzwingen=true ueberschreibt ohne ETag-Pruefung (Nutzerin hat den
// Konfliktdialog bewusst mit "trotzdem ueberschreiben" bestaetigt).
async function cfDatenSchreiben(erzwingen) {
  const kopfzeilen = { 'Content-Type': 'application/json' };
  if (!erzwingen && window.CF_STAND.etag) {
    kopfzeilen['If-Match'] = window.CF_STAND.etag;
  }
  const antwort = await fetch('/api/daten', {
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
  window.CF_STAND.etag = antwort.headers.get('ETag');
  return { gespeichert: true };
}

function cfUhrzeit() {
  const jetzt = new Date();
  return String(jetzt.getHours()).padStart(2, '0') + ':' + String(jetzt.getMinutes()).padStart(2, '0') + ' Uhr';
}

function cfStatusAnzeigen(text) {
  const feld = document.getElementById('graph-sync-status');
  if (feld) feld.textContent = text;
}

// Wird beim Start einmal aufgerufen (siehe shell-template.html) und beim
// erneuten Laden aus dem Konfliktdialog.
async function cfBeimStartLaden() {
  try {
    cfStatusAnzeigen('Lädt …');
    const daten = await cfDatenLesen();
    if (daten) {
      if (typeof pruefeImportStruktur === 'function') pruefeImportStruktur(daten);
      window.STATE = daten;
      speichereState(false);
    }
    if (typeof statusAutomatikAnwenden === 'function') statusAutomatikAnwenden();
    if (typeof renderAll === 'function') renderAll();
    cfStatusAnzeigen('Gespeichert um ' + cfUhrzeit());
    return { geladen: !!daten };
  } catch (e) {
    cfStatusAnzeigen('Laden fehlgeschlagen — bitte Seite neu laden');
    console.warn('Gemeinsamer Datenbestand nicht ladbar:', e);
    return { geladen: false, grund: e.message };
  }
}

// Nach jeder Aenderung schreiben - gebuendelt (debounced), damit nicht jede
// Eingabe einzeln ueber das Netz geht.
let cfSchreibTimer = null;
function cfDatenSpaeterSchreiben() {
  cfStatusAnzeigen('Speichert …');
  if (cfSchreibTimer) clearTimeout(cfSchreibTimer);
  cfSchreibTimer = setTimeout(() => {
    cfSchreibTimer = null;
    cfDatenSchreiben(false).then(r => {
      if (r.gespeichert) {
        cfStatusAnzeigen('Gespeichert um ' + cfUhrzeit());
        return;
      }
      if (r.konflikt) {
        cfKonfliktDialog();
        return;
      }
      cfStatusAnzeigen('Nicht gespeichert — erneut versuchen');
    }).catch(e => {
      cfStatusAnzeigen('Nicht gespeichert — erneut versuchen');
      console.warn('Speichern fehlgeschlagen:', e);
    });
  }, 2000);
}

function cfKonfliktDialog() {
  const neuLaden = confirm(
    'Jemand anderes hat zwischenzeitlich gespeichert.\n\n'
    + 'OK = jetzt neu laden (eigene ungespeicherte Änderungen gehen verloren)\n'
    + 'Abbrechen = trotzdem mit dem eigenen Stand überschreiben'
  );
  if (neuLaden) {
    cfBeimStartLaden();
  } else {
    cfDatenSchreiben(true).then(r => {
      cfStatusAnzeigen(r.gespeichert ? 'Gespeichert um ' + cfUhrzeit() : 'Nicht gespeichert — erneut versuchen');
    });
  }
}
```

- [ ] **Schritt 2: `state-engine.js` auf cf-sync umstellen**

In `Design/state-engine.js`, Funktion `speichereState()`: den Aufruf
`graphDatenSpaeterSchreiben()` durch `cfDatenSpaeterSchreiben()` ersetzen:

```js
function speichereState(zaehlen = true) {
  if (zaehlen && typeof sicherungZaehlen === 'function') {
    sicherungZaehlen();
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(window.STATE));
  // Der gemeinsame Datenbestand liegt in der Cloud (siehe cf-sync.js);
  // localStorage bleibt die schnelle lokale Zwischenkopie.
  if (zaehlen && typeof cfDatenSpaeterSchreiben === 'function') {
    cfDatenSpaeterSchreiben();
  }
  if (typeof window.renderAll === 'function') {
    window.renderAll();
  }
}
```

- [ ] **Schritt 3: Commit**

```bash
git add Design/cf-sync.js Design/state-engine.js
git commit -m "feat: cf-sync.js fuer Laden/Speichern ueber Cloudflare statt Microsoft Graph"
```

---

## Task 7: `assemble.py` umstellen

**Dateien:**
- Ändern: `Design/assemble.py`

- [ ] **Schritt 1:** In der `core_js_parts`-Liste `"graph-config"`,
  `"graph-auth"`, `"graph-sync"` durch `"cf-sync"` ersetzen:

```python
core_js_parts = []
for name in ["cf-sync", "state-engine", "file-store", "ui-helpers"]:
    js = read(BASE / f"{name}.js")
    core_js_parts.append(f"// ---- {name}.js ----\n{js}")
core_js = "\n\n".join(core_js_parts)
```

- [ ] **Schritt 2:** Die `msal_js`-Zeile (liest
  `Design/vendor/msal-browser.min.js`) und das zugehörige
  `html.replace("{{MSAL_JS}}", msal_js)` entfernen (kommt in Task 9 aus dem
  Template raus, hier nur die Python-Seite).

- [ ] **Schritt 3: Commit** (zusammen mit Task 8/9, da erst nach Entfernen
  der Platzhalter aus dem Template lauffähig — siehe Hinweis am Ende von
  Task 9).

---

## Task 8: `shell-template.html` umstellen

**Dateien:**
- Ändern: `Design/shell-template.html`

- [ ] **Schritt 1:** `<script>{{MSAL_JS}}</script>`-Zeile entfernen.
- [ ] **Schritt 2:** Den kompletten `#anmelde-bildschirm`-Block (Div mit
  `anmelde-karte`, „Mit Microsoft anmelden"-Knopf) entfernen — wird nicht
  mehr gebraucht, Cloudflare Access übernimmt das Gate vollständig davor.
- [ ] **Schritt 3:** Die Funktionen `anmeldeLadeUndZeige()`,
  `anmeldeAblauf()`, `anmeldeStarten()` entfernen.
- [ ] **Schritt 4:** Den Aufruf `anmeldeAblauf();` am Ende ersetzen durch:

```js
cfBeimStartLaden();
```

- [ ] **Schritt 5:** Prüfen, dass `renderAll()` als Funktionsdefinition
  erhalten bleibt (wird weiterhin von `cf-sync.js` aufgerufen) — nur der
  gesonderte Aufruf im alten Anmelde-Ablauf entfällt, nicht die Definition
  selbst.

---

## Task 9: Alte Microsoft-/Graph-Dateien entfernen

**Dateien:**
- Löschen: `Design/graph-auth.js`, `Design/graph-config.js`,
  `Design/graph-sync.js`, `Design/vendor/msal-browser.min.js`
- Ändern: `Design/fragments/einstellungen.js` (Abschnitt
  „Cloud-Verbindung" mit `graphAngemeldeterName()`/`graphAbmelden()`
  entfernen — kein Microsoft-Konto mehr, das man an-/abmelden könnte)

- [ ] **Schritt 1:** Dateien löschen:

```bash
git rm Design/graph-auth.js Design/graph-config.js Design/graph-sync.js Design/vendor/msal-browser.min.js
```

- [ ] **Schritt 2:** In `Design/fragments/einstellungen.js` den
  „Cloud-Verbindung"-Abschnitt (zeigt `graphAngemeldeterName()`, Knopf
  „Abmelden" mit `graphAbmelden()`) ersatzlos entfernen.

- [ ] **Schritt 3:** Grep-Sweep — sicherstellen, dass keine Aufrufreste auf
  die entfernten Funktionen zurückbleiben:

```bash
grep -rn "graphAuthKonfigurieren\|graphSilentAnmeldung\|graphInteraktiveAnmeldung\|graphToken\|graphAngemeldeterName\|graphAbmelden\|graphDatenLesen\|graphDatenSchreiben\|graphBeimStartLaden\|graphDatenSpaeterSchreiben\|graphKonfliktDialog\|GRAPH_CONFIG\|GRAPH_SCOPES" Design/ --include="*.js" --include="*.html"
```

Erwartung: keine Treffer mehr (Design-Spec- und Implementation-Plan-Dateien
selbst als Dokumentation ausgenommen, dort dürfen die Namen als historische
Referenz stehen bleiben).

- [ ] **Schritt 4: Build erzeugen und strukturell prüfen**

```bash
python Design/assemble.py
```

```python
html = open(r'Berichte/index.html', encoding='utf-8').read()
assert 'anmelde-bildschirm' not in html, 'FEHLER: alter Login-Screen noch im Build'
assert 'msal' not in html.lower(), 'FEHLER: MSAL noch im Build'
assert 'cfBeimStartLaden' in html, 'FEHLER: cf-sync.js fehlt im Build'
assert '/api/daten' in html, 'FEHLER: neuer Endpunkt fehlt im Build'
assert 'graph-sync-status' in html, 'FEHLER: Status-Element fehlt'
print('OK')
```

- [ ] **Schritt 5: Commit**

```bash
git add -A
git commit -m "feat: Microsoft-Login und Graph-API-Anbindung entfernen, auf Cloudflare umgestellt"
```

---

## Task 10: `styles.css` aufräumen

**Dateien:**
- Ändern: `Design/styles.css`

- [ ] **Schritt 1:** Die Regeln `.anmelde-bildschirm` und `.anmelde-karte`
  entfernen, ebenso den Eintrag `#anmelde-bildschirm` aus der
  `@media print`-Ausblendliste.
- [ ] **Schritt 2: Build + Commit**

```bash
python Design/assemble.py
git add Design/styles.css Berichte/index.html docs/index.html
git commit -m "chore: nicht mehr benoetigte Anmelde-Bildschirm-Styles entfernen"
```

---

## Task 11: Hilfeseite aktualisieren

**Dateien:**
- Ändern: `Design/fragments/page-hilfe.html`

- [ ] **Schritt 1:** Abschnitt „Wo die Daten liegen" umschreiben: statt
  Microsoft-Konto/OneDrive jetzt beschreiben, dass der Zugriff über eine von
  der Nutzerin verwaltete E-Mail-Liste (Cloudflare Access) läuft und die
  Daten bei Cloudflare liegen.
- [ ] **Schritt 2: Build + Commit**

```bash
python Design/assemble.py
git add Design/fragments/page-hilfe.html Berichte/index.html docs/index.html
git commit -m "docs: Hilfeseite auf Cloudflare-Zugriff aktualisieren"
```

---

## Task 12: Veröffentlichen (Nutzerin)

- [ ] **Schritt 1:** `git push origin HEAD:main` (im Terminal der Nutzerin,
  wie bisher).
- [ ] **Schritt 2:** Kurz warten, bis Cloudflare Pages automatisch neu
  gebaut hat (Cloudflare-Dashboard → Workers & Pages → `schulungsplaner` →
  „Deployments").

**Kein Commit** (Veröffentlichung, kein Code).

---

## Task 13: Solo-Test (Nutzerin, von mir gegengeprüft)

- [ ] **Schritt 1:** `https://schulungsplaner.pages.dev/` öffnen (am besten
  in einem privaten/Inkognito-Fenster, um jeden alten Anmeldezustand
  auszuschließen).
- [ ] **Schritt 2:** Erwartet: Cloudflare-Access-Anmeldeseite (E-Mail
  eingeben, Code per Mail erhalten, eingeben) — **kein** Microsoft-Login
  mehr sichtbar.
- [ ] **Schritt 3:** Nach der Anmeldung: normale App-Oberfläche, unten
  „Gespeichert um HH:MM Uhr", der „Test-Kurs" von heute ist sichtbar (Beweis,
  dass die migrierten Daten aus Task 4 korrekt geladen werden).
- [ ] **Schritt 4:** Testweise einen weiteren Kurs oder Trainer anlegen.
- [ ] **Schritt 5:** Ich prüfe im Cloudflare-Dashboard direkt im
  R2-Bucket, dass das Objekt `schulungsdaten.json` den neuen Eintrag enthält
  (Download/Vorschau über die Cloudflare-Oberfläche).

---

## Task 14: Konflikttest (gemeinsam)

- [ ] **Schritt 1:** Zwei Browserfenster (bzw. ein normales + ein
  privates/Inkognito-Fenster) gleichzeitig öffnen, in beiden anmelden.
- [ ] **Schritt 2:** In Fenster A einen Kurs anlegen, 2 Sekunden warten
  (Speichern abwarten).
- [ ] **Schritt 3:** In Fenster B (ohne vorher neu zu laden) ebenfalls eine
  Änderung vornehmen.
- [ ] **Schritt 4:** Erwartet: Fenster B bekommt den Konfliktdialog
  („Jemand anderes hat zwischenzeitlich gespeichert…"), überschreibt nicht
  stillschweigend.

---

## Task 15: Gemeinsamer Test mit einer zweiten zugelassenen Adresse

- [ ] **Schritt 1:** Kollege (`fuetterer@tribeta-group.de` oder
  `finocchietti@tribeta-group.de`) öffnet `https://schulungsplaner.pages.dev/`,
  meldet sich über Cloudflare Access mit seiner E-Mail an (Code-Zustellung
  abwarten).
- [ ] **Schritt 2:** Erwartet: sieht sofort den aktuellen Datenbestand, legt
  testweise einen Eintrag an.
- [ ] **Schritt 3:** Nutzerin lädt ihre Seite neu (F5) — Eintrag erscheint.

---

## Task 16: Negativtest — nicht zugelassene Adresse

- [ ] **Schritt 1:** Mit einer E-Mail-Adresse versuchen, die **nicht** auf
  der Zugriffsliste steht (z. B. eine private Adresse).
- [ ] **Schritt 2:** Erwartet: Cloudflare Access weist ab, **bevor** die App
  überhaupt lädt — kein Zugriff auf Login-Screen, App-Oberfläche oder Daten.

---

## Task 17: Azure-AD-App-Registrierung als nicht mehr benötigt vermerken (Nutzerin, optional)

- [ ] **Schritt 1:** Die App-Registrierung „Schulungsplaner" in Microsoft
  Entra ID bleibt bestehen, wird aber nicht mehr verwendet — kann bei
  Bedarf später deaktiviert oder gelöscht werden. Kein dringender Schritt,
  da sie inaktiv keinen Schaden anrichtet.

**Kein Commit.**

---

## Task 18: HANDOFF.md finalisieren

**Dateien:**
- Ändern: `.claude/HANDOFF.md`

- [ ] **Schritt 1:** Architektur-Abschnitt komplett auf Cloudflare Access +
  R2 umschreiben (Microsoft-Login/Graph-API-Abschnitt als „frühere Lösung,
  abgelöst" kennzeichnen, nicht ersatzlos streichen — der Kontext bleibt für
  spätere Sessions wertvoll).
- [ ] **Schritt 2:** Zugriffsliste dokumentieren (die drei E-Mail-Adressen)
  und wie man sie ändert (Cloudflare Zero Trust → Access → Applications →
  Policy bearbeiten).
- [ ] **Schritt 3: Commit**

```bash
git add .claude/HANDOFF.md
git commit -m "docs: HANDOFF.md auf Cloudflare-native Architektur aktualisieren"
```
