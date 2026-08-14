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
