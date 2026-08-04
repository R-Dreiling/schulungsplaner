// Design/state-engine.js
// Zentraler State: Laden aus localStorage (Fallback: SEED_DATA), Speichern,
// Reset, Export/Import. Wird von shell-template.html vor den Seiten-Skripten
// eingebunden. window.SEED_DATA muss vorher gesetzt sein.

const STORAGE_KEY = 'schulungsplaner_state_v2';

function ladeState() {
  const roh = localStorage.getItem(STORAGE_KEY);
  if (roh) {
    try {
      return JSON.parse(roh);
    } catch (e) {
      console.warn('Gespeicherter State ungültig, verwende Beispieldaten.', e);
    }
  }
  return JSON.parse(JSON.stringify(window.SEED_DATA));
}

window.STATE = ladeState();

function speichereState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(window.STATE));
  if (typeof window.renderAll === 'function') {
    window.renderAll();
  }
}

function zuruecksetzenAufBeispieldaten() {
  if (!confirm('Wirklich alle Änderungen verwerfen und auf die Beispieldaten zurücksetzen?')) {
    return;
  }
  window.STATE = JSON.parse(JSON.stringify(window.SEED_DATA));
  speichereState();
}

function exportiereJSON() {
  const inhalt = JSON.stringify(window.STATE, null, 2);
  const blob = new Blob([inhalt], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const heute = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `schulungsplaner-export-${heute}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function importiereJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const geparst = JSON.parse(reader.result);
        if (!geparst.kurse || !geparst.teilnehmer || !geparst.buchungen) {
          throw new Error('Datei enthält nicht die erwarteten Felder (kurse/teilnehmer/buchungen).');
        }
        window.STATE = geparst;
        speichereState();
        resolve();
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, 'utf-8');
  });
}

function naechsteId(praefix, liste) {
  let hoechste = 0;
  for (const eintrag of liste) {
    const match = String(eintrag.id).match(new RegExp(`^${praefix}(\\d+)$`));
    if (match) {
      hoechste = Math.max(hoechste, parseInt(match[1], 10));
    }
  }
  return `${praefix}${hoechste + 1}`;
}
