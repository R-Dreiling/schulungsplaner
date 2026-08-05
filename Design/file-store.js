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
