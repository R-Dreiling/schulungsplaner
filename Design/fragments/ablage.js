// Design/fragments/ablage.js
// Legt die erzeugten Dokumente und Sicherungen in einem Ordner ab, den die
// Nutzerin einmal auswaehlt. Liegt dieser Ordner in OneDrive, sind die
// Nachweise damit automatisch in der Cloud und fuer alle sichtbar.
//
// Grenzen, die man kennen muss:
// - Der Browser darf nur in Ordner schreiben, die ausdruecklich freigegeben
//   wurden. Die Freigabe holt showDirectoryPicker(); der Zugriff wird in
//   IndexedDB gemerkt, muss je nach Browser aber pro Sitzung einmal
//   bestaetigt werden.
// - Abgelegt wird HTML, nicht PDF: Ein PDF entsteht erst im Druckdialog des
//   Browsers, und an diese Datei kommt die App nicht heran. Die HTML-Fassung
//   ist vollstaendig (Layout und Logo eingebettet) und laesst sich jederzeit
//   oeffnen und drucken.

const ABLAGE_DB = 'schulungsplaner_ablage';
const ABLAGE_STORE = 'handles';
const ABLAGE_SCHLUESSEL = 'wurzel';

function ablageDbOeffnen() {
  return new Promise((resolve, reject) => {
    const anfrage = indexedDB.open(ABLAGE_DB, 1);
    anfrage.onupgradeneeded = () => anfrage.result.createObjectStore(ABLAGE_STORE);
    anfrage.onsuccess = () => resolve(anfrage.result);
    anfrage.onerror = () => reject(anfrage.error);
  });
}

async function ablageHandleMerken(handle) {
  const db = await ablageDbOeffnen();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(ABLAGE_STORE, 'readwrite');
    tx.objectStore(ABLAGE_STORE).put(handle, ABLAGE_SCHLUESSEL);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function ablageHandleLaden() {
  const db = await ablageDbOeffnen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ABLAGE_STORE, 'readonly');
    const anfrage = tx.objectStore(ABLAGE_STORE).get(ABLAGE_SCHLUESSEL);
    anfrage.onsuccess = () => resolve(anfrage.result || null);
    anfrage.onerror = () => reject(anfrage.error);
  });
}

function ablageMoeglich() {
  return typeof window.showDirectoryPicker === 'function';
}

// Ein gespeicherter Eintrag kann aus einer aelteren Fassung stammen oder
// beschaedigt sein. Dann ist es kein Ordnerzugriff, sondern irgendein Objekt -
// das muss auffallen, bevor darauf zugegriffen wird.
function istOrdnerZugriff(handle) {
  return !!handle
    && typeof handle.queryPermission === 'function'
    && typeof handle.getDirectoryHandle === 'function';
}

// Fragt die Schreibberechtigung ab und holt sie bei Bedarf nach. still=true
// unterdrueckt die Nachfrage - dann wird nur gemeldet, ob es gerade geht.
async function ablageBerechtigung(handle, still) {
  if (!istOrdnerZugriff(handle)) return false;
  const optionen = { mode: 'readwrite' };
  if ((await handle.queryPermission(optionen)) === 'granted') return true;
  if (still) return false;
  return (await handle.requestPermission(optionen)) === 'granted';
}

async function ablageOrdnerWaehlen() {
  if (!ablageMoeglich()) {
    alert('Dieser Browser kann nicht in Ordner schreiben. In Chrome oder Edge funktioniert es.');
    return null;
  }
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await ablageHandleMerken(handle);
    aktualisiereEinstellungen({ ablageOrdnerName: handle.name });
    return handle;
  } catch (e) {
    // Abbruch durch die Nutzerin ist kein Fehler.
    if (e && e.name === 'AbortError') return null;
    alert('Ordner konnte nicht übernommen werden: ' + e.message);
    return null;
  }
}

// Dateisystemfreundlicher Name: die verbotenen Zeichen raus, Laenge begrenzt.
function dateinameSicher(text) {
  return String(text || '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'ohne-Namen';
}

// Ordner je Termin: "2026-08-12 Datenschutzbeauftragter Grundlagenschulung"
function ablageTerminOrdner(terminId) {
  const gefunden = findeTerminMitKurs(terminId);
  if (!gefunden) return null;
  return dateinameSicher(`${gefunden.termin.datum} ${gefunden.kurs.titel}`);
}

async function ablageUnterordner(wurzel, teile) {
  let ordner = wurzel;
  for (const teil of teile) {
    ordner = await ordner.getDirectoryHandle(teil, { create: true });
  }
  return ordner;
}

async function ablageSchreiben(teile, dateiname, inhalt) {
  const handle = await ablageHandleLaden();
  if (!istOrdnerZugriff(handle)) return { abgelegt: false, grund: 'kein Ordner gewählt' };
  if (!(await ablageBerechtigung(handle))) {
    return { abgelegt: false, grund: 'keine Schreibberechtigung' };
  }
  const ordner = await ablageUnterordner(handle, teile);
  const datei = await ordner.getFileHandle(dateiname, { create: true });
  const strom = await datei.createWritable();
  await strom.write(inhalt);
  await strom.close();
  return { abgelegt: true, pfad: teile.join('/') + '/' + dateiname };
}

// Baut aus einer Druckvorlage ein eigenstaendiges Dokument: das Stylesheet der
// App wird mitgegeben, Logo und Unterschrift stecken ohnehin als Data-URL im
// HTML. Die Datei laesst sich damit ohne die App oeffnen und drucken.
function ablageDokumentHtml(titel, koerper) {
  const stil = document.querySelector('style');
  const css = stil ? stil.textContent : '';
  // Der Dateiname des PDF ergibt sich beim Drucken aus dem Dokumenttitel -
  // deshalb steht hier derselbe Name wie an der HTML-Datei.
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<title>${escHtml(titel)}</title>
<style>
${css}
/* Ablagefassung: der Druckbereich ist hier der ganze Inhalt. */
@media screen {
  body { margin: 0; padding: 24px 24px 90px 24px; background: #E7EBF2; }
  .druck-seite { max-width: 210mm; margin: 0 auto; box-shadow: 0 2px 18px rgba(10,16,40,.18); }
}
#druck-bereich { display: block; }
.pdf-leiste {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 10;
  display: flex; align-items: center; justify-content: center; gap: 14px;
  padding: 12px 18px; background: #0A1028; color: #fff;
  font-family: 'Mulish', -apple-system, 'Segoe UI', Roboto, sans-serif; font-size: 13px;
}
.pdf-leiste button {
  font-family: 'Poppins', -apple-system, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 6px;
  border: none; background: #2BD5D8; color: #0A1028; cursor: pointer;
}
@media print { .pdf-leiste { display: none; } }
</style>
</head>
<body>
<div id="druck-bereich">${koerper}</div>
<div class="pdf-leiste">
  <span>Als PDF sichern: drucken und im Druckdialog „Als PDF speichern" wählen — am besten in denselben Ordner.</span>
  <button type="button" onclick="window.print()">Als PDF speichern</button>
</div>
</body>
</html>`;
}

// Legt ein Dokument ab und meldet den Ausgang zurueck, ohne den Druck
// aufzuhalten. Fehler landen in der Konsole und im Rueckgabewert - ein
// misslungener Ablageversuch darf den Ausdruck nie verhindern.
function ablageDokument(terminId, unterordner, dateiname, titel, koerper) {
  const ordner = ablageTerminOrdner(terminId);
  if (!ordner) return Promise.resolve({ abgelegt: false, grund: 'Termin nicht gefunden' });
  const teile = ['Schulungen', ordner].concat(unterordner || []);
  return ablageSchreiben(teile, dateinameSicher(dateiname) + '.html', ablageDokumentHtml(titel, koerper))
    .catch(e => {
      console.warn('Ablage fehlgeschlagen:', e);
      return { abgelegt: false, grund: e.message };
    });
}

// Sicherung des Datenbestands. Wird nach dem Abschluss einer Schulung
// angeboten und kann jederzeit von Hand ausgeloest werden.
async function ablageSicherung() {
  const inhalt = JSON.stringify(window.STATE, null, 2);
  const name = `${heuteIso()} Datenbestand.json`;
  const ergebnis = await ablageSchreiben(['Sicherungen'], name, inhalt);
  if (ergebnis.abgelegt) sicherungVermerken();
  return ergebnis;
}

// Legt zu einem Termin alle Dokumente auf einmal ab: Anwesenheitsliste,
// Abschlussbericht, je Firma einen Arbeitgebernachweis und fuer jede Person
// mit erfuellter Mindestteilnahme die Bescheinigung.
//
// ACHTUNG Zertifikatsnummern: zertifikatHtml() vergibt beim ersten Aufruf eine
// Nummer. Hier entstehen also Nummern fuer alle Berechtigten - das ist beim
// Abschluss einer Schulung gewollt (die Bescheinigungen werden ohnehin
// ausgestellt), waere beim blossen Anschauen einer Liste aber falsch. Deshalb
// laeuft dieser Weg ausschliesslich ueber eine ausdrueckliche Aktion.
async function ablageAlleDokumente(terminId) {
  const gefunden = findeTerminMitKurs(terminId);
  if (!gefunden) throw new Error(`Termin ${terminId} nicht gefunden`);

  const erledigt = [];
  const fehler = [];
  const ablegen = async (unterordner, dateiname, titel, html) => {
    try {
      const r = await ablageDokument(terminId, unterordner, dateiname, titel, html);
      if (r.abgelegt) erledigt.push(r.pfad); else fehler.push(`${dateiname}: ${r.grund}`);
    } catch (e) {
      fehler.push(`${dateiname}: ${e.message}`);
    }
  };

  await ablegen([], 'Anwesenheitsliste', 'Anwesenheitsliste', anwesenheitslisteHtml(terminId));

  if (gefunden.termin.abschluss) {
    await ablegen([], 'Abschlussbericht', 'Abschlussbericht', abschlussberichtHtml(terminId));
  }

  for (const firma of firmenNachweisFirmen(terminId)) {
    await ablegen(['Arbeitgebernachweise'], `Schulungsnachweis ${firma}`,
      'Schulungsnachweis', firmenNachweisHtml(terminId, firma));
  }

  for (const buchung of anwesenheitsBuchungen(terminId)) {
    if (!erfuelltMindestteilnahme(buchung)) continue;
    const person = window.STATE.teilnehmer.find(t => t.id === buchung.teilnehmerId);
    if (!person) continue;
    const html = zertifikatHtml(buchung.id);   // vergibt die Nummer, falls noch keine
    await ablegen(['Bescheinigungen'], `${buchung.zertifikatNr} ${person.name}`,
      'Teilnahmebescheinigung', html);
  }

  const sicherung = await ablageSicherung();
  return { erledigt, fehler, sicherung };
}

// Zustand fuer die Anzeige im Einstellungsdialog.
async function ablageZustand() {
  if (!ablageMoeglich()) return { moeglich: false };
  let handle = null;
  try {
    handle = await ablageHandleLaden();
  } catch (e) {
    return { moeglich: true, gewaehlt: false, hinweis: e.message };
  }
  if (!istOrdnerZugriff(handle)) return { moeglich: true, gewaehlt: false };
  return {
    moeglich: true,
    gewaehlt: true,
    name: handle.name,
    bereit: await ablageBerechtigung(handle, true),
  };
}
