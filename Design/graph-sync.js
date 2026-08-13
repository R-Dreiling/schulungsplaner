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
