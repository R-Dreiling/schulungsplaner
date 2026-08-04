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

// -- Suche --

function findeKurs(kursId) {
  return window.STATE.kurse.find(k => k.id === kursId);
}

function findeTerminMitKurs(terminId) {
  for (const kurs of window.STATE.kurse) {
    const termin = kurs.termine.find(t => t.id === terminId);
    if (termin) return { kurs, termin };
  }
  return undefined;
}

// -- Kurs-CRUD --

function erstelleKurs(felder) {
  const id = naechsteId('k', window.STATE.kurse);
  window.STATE.kurse.push({
    id,
    titel: felder.titel,
    kategorie: felder.kategorie,
    beschreibung: felder.beschreibung || '',
    lernziele: felder.lernziele || [],
    zielgruppe: felder.zielgruppe || '',
    voraussetzungen: felder.voraussetzungen || '',
    agenda: [],
    materialien: { seminarunterlagen: [], vorlagen: [] },
    termine: [],
  });
  speichereState();
  return id;
}

function aktualisiereKurs(kursId, felder) {
  const kurs = findeKurs(kursId);
  if (!kurs) throw new Error(`Kurs ${kursId} nicht gefunden`);
  Object.assign(kurs, felder);
  speichereState();
}

function loescheKurs(kursId) {
  const kurs = findeKurs(kursId);
  if (!kurs) throw new Error(`Kurs ${kursId} nicht gefunden`);
  const terminIds = new Set(kurs.termine.map(t => t.id));
  window.STATE.buchungen = window.STATE.buchungen.filter(b => !terminIds.has(b.terminId));
  window.STATE.kurse = window.STATE.kurse.filter(k => k.id !== kursId);
  speichereState();
}

// -- Termin-CRUD --

const STANDARD_CHECKLISTE = [
  'Raum gebucht', 'Technik geprüft', 'Unterlagen gedruckt',
  'Einladungen versendet', 'Zertifikate vorbereitet',
];

function alleTermine() {
  return window.STATE.kurse.flatMap(k => k.termine);
}

function erstelleTermin(kursId, felder) {
  const kurs = findeKurs(kursId);
  if (!kurs) throw new Error(`Kurs ${kursId} nicht gefunden`);
  const id = naechsteId('tm', alleTermine());
  kurs.termine.push({
    id,
    datum: felder.datum,
    trainer: felder.trainer,
    format: felder.format,
    ort: felder.ort,
    kapazitaet: felder.kapazitaet,
    status: felder.status || 'geplant',
    checkliste: STANDARD_CHECKLISTE.map(label => ({ label, erledigt: false })),
  });
  speichereState();
  return id;
}

function aktualisiereTermin(terminId, felder) {
  const gefunden = findeTerminMitKurs(terminId);
  if (!gefunden) throw new Error(`Termin ${terminId} nicht gefunden`);
  Object.assign(gefunden.termin, felder);
  speichereState();
}

function loescheTermin(terminId) {
  const gefunden = findeTerminMitKurs(terminId);
  if (!gefunden) throw new Error(`Termin ${terminId} nicht gefunden`);
  gefunden.kurs.termine = gefunden.kurs.termine.filter(t => t.id !== terminId);
  window.STATE.buchungen = window.STATE.buchungen.filter(b => b.terminId !== terminId);
  speichereState();
}

// -- Checkliste (pro Termin) --

function checklistePunktToggeln(terminId, index) {
  const gefunden = findeTerminMitKurs(terminId);
  if (!gefunden) throw new Error(`Termin ${terminId} nicht gefunden`);
  const punkt = gefunden.termin.checkliste[index];
  if (!punkt) throw new Error(`Checklistenpunkt ${index} nicht gefunden`);
  punkt.erledigt = !punkt.erledigt;
  speichereState();
}

function checklistePunktHinzufuegen(terminId, label) {
  const gefunden = findeTerminMitKurs(terminId);
  if (!gefunden) throw new Error(`Termin ${terminId} nicht gefunden`);
  gefunden.termin.checkliste.push({ label, erledigt: false });
  speichereState();
}

function checklistePunktEntfernen(terminId, index) {
  const gefunden = findeTerminMitKurs(terminId);
  if (!gefunden) throw new Error(`Termin ${terminId} nicht gefunden`);
  gefunden.termin.checkliste.splice(index, 1);
  speichereState();
}

// -- Agenda (kursweit) --

function agendaPunktHinzufuegen(kursId, punkt) {
  const kurs = findeKurs(kursId);
  if (!kurs) throw new Error(`Kurs ${kursId} nicht gefunden`);
  kurs.agenda.push(punkt);
  speichereState();
}

function agendaPunktEntfernen(kursId, index) {
  const kurs = findeKurs(kursId);
  if (!kurs) throw new Error(`Kurs ${kursId} nicht gefunden`);
  kurs.agenda.splice(index, 1);
  speichereState();
}

// -- Teilnehmer & Buchungen --

function erstelleTeilnehmer(felder) {
  const id = naechsteId('t', window.STATE.teilnehmer);
  window.STATE.teilnehmer.push({
    id,
    name: felder.name,
    firma: felder.firma,
    email: felder.email,
    bestandskunde: !!felder.bestandskunde,
  });
  speichereState();
  return id;
}

function erstelleBuchung(felder) {
  const id = naechsteId('b', window.STATE.buchungen);
  window.STATE.buchungen.push({
    id,
    teilnehmerId: felder.teilnehmerId,
    terminId: felder.terminId,
    anmeldestatus: felder.anmeldestatus || 'angemeldet',
    gebuchtAm: new Date().toISOString().slice(0, 10),
  });
  speichereState();
  return id;
}

function aktualisiereBuchungStatus(buchungId, neuerStatus) {
  const buchung = window.STATE.buchungen.find(b => b.id === buchungId);
  if (!buchung) throw new Error(`Buchung ${buchungId} nicht gefunden`);
  buchung.anmeldestatus = neuerStatus;
  speichereState();
}

function loescheBuchung(buchungId) {
  window.STATE.buchungen = window.STATE.buchungen.filter(b => b.id !== buchungId);
  speichereState();
}

// -- Abgeleitete Daten --

function terminAuslastung(terminId) {
  const gefunden = findeTerminMitKurs(terminId);
  if (!gefunden) throw new Error(`Termin ${terminId} nicht gefunden`);
  const belegt = window.STATE.buchungen.filter(
    b => b.terminId === terminId && b.anmeldestatus !== 'abgesagt'
  ).length;
  const kapazitaet = gefunden.termin.kapazitaet;
  return {
    belegt,
    kapazitaet,
    frei: Math.max(0, kapazitaet - belegt),
    prozent: kapazitaet > 0 ? Math.round((belegt / kapazitaet) * 100) : 0,
  };
}

function naechsteZweiTermine(kursId) {
  const kurs = findeKurs(kursId);
  if (!kurs) throw new Error(`Kurs ${kursId} nicht gefunden`);
  const heute = new Date().toISOString().slice(0, 10);
  const sortiert = [...kurs.termine].sort((a, b) => a.datum.localeCompare(b.datum));
  const kommende = sortiert.filter(t => t.datum >= heute);
  const vergangene = sortiert.filter(t => t.datum < heute).reverse();
  return [...kommende, ...vergangene].slice(0, 2);
}

function buchungenFuerTermin(terminId) {
  return window.STATE.buchungen.filter(b => b.terminId === terminId);
}

function buchungenSortiertNeuesteZuerst() {
  return [...window.STATE.buchungen].sort((a, b) => b.gebuchtAm.localeCompare(a.gebuchtAm));
}

function buchungshistorieFirma(firma) {
  const zaehlerNachTitel = {};
  for (const buchung of window.STATE.buchungen) {
    const teilnehmer = window.STATE.teilnehmer.find(t => t.id === buchung.teilnehmerId);
    if (!teilnehmer || teilnehmer.firma !== firma) continue;
    const gefunden = findeTerminMitKurs(buchung.terminId);
    if (!gefunden) continue;
    const titel = gefunden.kurs.titel;
    zaehlerNachTitel[titel] = (zaehlerNachTitel[titel] || 0) + 1;
  }
  return Object.entries(zaehlerNachTitel)
    .map(([titel, anzahl]) => ({ titel, anzahl }))
    .sort((a, b) => b.anzahl - a.anzahl);
}

// -- Materialien-Referenzen (Datei-Inhalt liegt in IndexedDB, siehe file-store.js) --

function materialHinzufuegen(kursId, bereich, referenz) {
  const kurs = findeKurs(kursId);
  if (!kurs) throw new Error(`Kurs ${kursId} nicht gefunden`);
  kurs.materialien[bereich].push(referenz);
  speichereState();
}

function materialEntfernen(kursId, bereich, dateiId) {
  const kurs = findeKurs(kursId);
  if (!kurs) throw new Error(`Kurs ${kursId} nicht gefunden`);
  kurs.materialien[bereich] = kurs.materialien[bereich].filter(d => d.id !== dateiId);
  speichereState();
}
