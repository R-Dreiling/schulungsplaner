// Design/file-store.js
// IndexedDB-Speicher fuer hochgeladene Materialien-Dateien. Referenzen
// (Name/Typ/Groesse) leben im normalen State (localStorage), der Blob-Inhalt
// liegt separat in IndexedDB, da localStorage zu klein fuer Dateien ist.

const DATEI_DB_NAME = 'schulungsplaner_dateien';
const DATEI_STORE = 'dateien';

function oeffneDateiDB() {
  return new Promise((resolve, reject) => {
    const anfrage = indexedDB.open(DATEI_DB_NAME, 1);
    anfrage.onupgradeneeded = () => {
      anfrage.result.createObjectStore(DATEI_STORE, { keyPath: 'id' });
    };
    anfrage.onsuccess = () => resolve(anfrage.result);
    anfrage.onerror = () => reject(anfrage.error);
  });
}

function neueDateiId() {
  return `d${Date.now()}${Math.floor(Math.random() * 10000)}`;
}

async function speichereDatei(datei, { kursId, bereich }) {
  if (!findeKurs(kursId)) throw new Error(`Kurs ${kursId} nicht gefunden`);
  const db = await oeffneDateiDB();
  const id = neueDateiId();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DATEI_STORE, 'readwrite');
    tx.objectStore(DATEI_STORE).put({ id, blob: datei });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  materialHinzufuegen(kursId, bereich, {
    id, name: datei.name, typ: datei.type || 'application/octet-stream', groesse: datei.size,
  });
  return id;
}

async function ladeDateiBlob(dateiId) {
  const db = await oeffneDateiDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DATEI_STORE, 'readonly');
    const anfrage = tx.objectStore(DATEI_STORE).get(dateiId);
    anfrage.onsuccess = () => resolve(anfrage.result ? anfrage.result.blob : null);
    anfrage.onerror = () => reject(anfrage.error);
  });
}

async function loescheDateiUndReferenz(dateiId, kursId, bereich) {
  if (!findeKurs(kursId)) throw new Error(`Kurs ${kursId} nicht gefunden`);
  const db = await oeffneDateiDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DATEI_STORE, 'readwrite');
    tx.objectStore(DATEI_STORE).delete(dateiId);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  materialEntfernen(kursId, bereich, dateiId);
}

async function herunterladeDatei(dateiId, dateiName) {
  const blob = await ladeDateiBlob(dateiId);
  if (!blob) {
    alert('Datei wurde nicht gefunden (evtl. nach einem Import ohne Dateien).');
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = dateiName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function speichereTrainerDokument(datei, trainerId, gueltigBis) {
  if (!findeTrainer(trainerId)) throw new Error(`Trainer ${trainerId} nicht gefunden`);
  const db = await oeffneDateiDB();
  const id = neueDateiId();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DATEI_STORE, 'readwrite');
    tx.objectStore(DATEI_STORE).put({ id, blob: datei });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  trainerDokumentHinzufuegen(trainerId, {
    id,
    name: datei.name,
    typ: datei.type || 'application/octet-stream',
    groesse: datei.size,
    gueltigBis: gueltigBis || null,
  });
  return id;
}

async function loescheTrainerDokumentUndDatei(dateiId, trainerId) {
  if (!findeTrainer(trainerId)) throw new Error(`Trainer ${trainerId} nicht gefunden`);
  const db = await oeffneDateiDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DATEI_STORE, 'readwrite');
    tx.objectStore(DATEI_STORE).delete(dateiId);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  trainerDokumentEntfernen(trainerId, dateiId);
}

async function alleDateienLoeschen() {
  const db = await oeffneDateiDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DATEI_STORE, 'readwrite');
    tx.objectStore(DATEI_STORE).clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// ---- Zeichnungsbilder (Unterschrift, Stempel) ----
// Anders als Materialien landen diese beiden nicht in IndexedDB, sondern als
// Data-URL im State: die Bescheinigung wird synchron aufgebaut und koennte
// nicht auf einen asynchronen Datenbankzugriff warten. Damit der localStorage
// nicht volllaeuft, wird das Bild vorher auf eine Druckgroesse verkleinert.

const ZEICHNUNG_MAX_BREITE = 700;   // reicht fuer den Druck bei ~45 mm Breite
const ZEICHNUNG_MAX_BYTES = 400000; // Sicherheitsgrenze fuer den State

// Unterschriften kommen meist als Scan oder Screenshot mit weissem Grund. Auf
// dem hellen Untergrund der Bescheinigung waere das ein sichtbarer Kasten.
// Deshalb wird Helles durchsichtig gemacht - mit weichem Uebergang, damit die
// Linien nicht ausfransen. Bereits freigestellte Bilder bleiben unveraendert,
// ihre deckenden Pixel sind ja dunkel.
const FREISTELLEN_HELL = 240;   // ab hier vollstaendig durchsichtig
const FREISTELLEN_DUNKEL = 200; // bis hier unveraendert deckend

function weissenHintergrundFreistellen(kontext, leinwand) {
  const daten = kontext.getImageData(0, 0, leinwand.width, leinwand.height);
  const p = daten.data;
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] === 0) continue;
    const helligkeit = (p[i] + p[i + 1] + p[i + 2]) / 3;
    if (helligkeit >= FREISTELLEN_HELL) {
      p[i + 3] = 0;
    } else if (helligkeit > FREISTELLEN_DUNKEL) {
      const anteil = (FREISTELLEN_HELL - helligkeit) / (FREISTELLEN_HELL - FREISTELLEN_DUNKEL);
      p[i + 3] = Math.round(p[i + 3] * anteil);
    }
  }
  kontext.putImageData(daten, 0, 0);
}

function bildAufDruckgroesseVerkleinern(datei) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(datei.type)) {
      reject(new Error('Bitte eine Bilddatei wählen (PNG mit transparentem Hintergrund ist am besten).'));
      return;
    }
    const leser = new FileReader();
    leser.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
    leser.onload = () => {
      const bild = new Image();
      bild.onerror = () => reject(new Error('Bild konnte nicht gelesen werden.'));
      bild.onload = () => {
        const faktor = Math.min(1, ZEICHNUNG_MAX_BREITE / bild.width);
        const leinwand = document.createElement('canvas');
        leinwand.width = Math.round(bild.width * faktor);
        leinwand.height = Math.round(bild.height * faktor);
        // PNG erhaelt die Transparenz - bei einer Unterschrift ist genau das
        // entscheidend, sonst liegt ein weisser Kasten auf dem Untergrund.
        const kontext = leinwand.getContext('2d');
        kontext.drawImage(bild, 0, 0, leinwand.width, leinwand.height);
        weissenHintergrundFreistellen(kontext, leinwand);
        const datenUrl = leinwand.toDataURL('image/png');
        if (datenUrl.length > ZEICHNUNG_MAX_BYTES) {
          reject(new Error('Das Bild ist auch verkleinert noch zu groß. Bitte einen engeren Ausschnitt wählen.'));
          return;
        }
        resolve(datenUrl);
      };
      bild.src = leser.result;
    };
    leser.readAsDataURL(datei);
  });
}

async function einstellungBildSetzen(feld, datei) {
  if (feld !== 'unterschriftBild' && feld !== 'stempelBild') {
    throw new Error(`Unbekanntes Bildfeld: ${feld}`);
  }
  const datenUrl = await bildAufDruckgroesseVerkleinern(datei);
  aktualisiereEinstellungen({ [feld]: datenUrl });
  return datenUrl;
}
