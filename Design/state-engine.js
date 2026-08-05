// Design/state-engine.js
// Zentraler State: Laden aus localStorage (Fallback: SEED_DATA), Speichern,
// Reset, Export/Import. Wird von shell-template.html vor den Seiten-Skripten
// eingebunden. window.SEED_DATA muss vorher gesetzt sein.

// v3: Das Schema hat sich inkompatibel geaendert (Trainer, Format/Kapazitaet
// am Kurs). Ein alter v2-Stand im Browser wuerde die App zerlegen, daher ein
// neuer Schluessel - alte Staende werden ignoriert, die Beispieldaten greifen.
const STORAGE_KEY = 'schulungsplaner_state_v3';

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

// Prueft die Grobstruktur einer importierten Datei, BEVOR der bestehende
// State ueberschrieben wird. Wirft mit klarer Meldung, wenn etwas fehlt.
function pruefeImportStruktur(geparst) {
  if (!geparst || typeof geparst !== 'object') {
    throw new Error('Datei enthält kein gültiges JSON-Objekt.');
  }
  if (!Array.isArray(geparst.kurse) || !Array.isArray(geparst.teilnehmer) || !Array.isArray(geparst.buchungen)) {
    throw new Error('Datei enthält nicht die erwarteten Listen (kurse/teilnehmer/buchungen).');
  }
  for (const kurs of geparst.kurse) {
    if (!kurs || typeof kurs !== 'object' || !Array.isArray(kurs.termine)) {
      throw new Error(`Kurs "${kurs && kurs.titel ? kurs.titel : kurs && kurs.id}" hat keine gültige Terminliste.`);
    }
  }
  // Symmetrisch zum STORAGE_KEY-Wechsel auf v3: ein v2-Stand erfuellt zwar alle
  // Pruefungen oben, wuerde die App aber unbrauchbar machen (undefined-Kapazitaet,
  // NaN-Plaetze). Daher hier ausdruecklich abweisen, BEVOR etwas ueberschrieben wird.
  if (!Array.isArray(geparst.trainer) || !geparst.einstellungen) {
    throw new Error('Diese Datei stammt aus einer älteren Version des Schulungsplaners '
      + '(es fehlen Trainer und Einstellungen). Sie kann nicht importiert werden. '
      + 'Deine aktuellen Daten wurden nicht verändert.');
  }
  for (const kurs of geparst.kurse) {
    if (kurs.zielgruppe !== undefined || kurs.maxTeilnehmer === undefined) {
      throw new Error(`Kurs "${kurs.titel || kurs.id}" hat ein veraltetes Format. `
        + 'Die Datei stammt aus einer älteren Version und kann nicht importiert werden. '
        + 'Deine aktuellen Daten wurden nicht verändert.');
    }
    for (const termin of kurs.termine) {
      if (termin.trainer !== undefined || termin.kapazitaet !== undefined) {
        throw new Error(`Termin am ${termin.datum || '?'} hat ein veraltetes Format. `
          + 'Die Datei stammt aus einer älteren Version und kann nicht importiert werden. '
          + 'Deine aktuellen Daten wurden nicht verändert.');
      }
    }
  }
}

function importiereJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Vorherigen State sichern: schlaegt speichereState()/renderAll() trotz
      // Strukturpruefung fehl, wird er zurueckgerollt - ein fehlerhafter
      // Import darf die echten Daten des Nutzers nie verlieren.
      const vorheriger = window.STATE;
      try {
        const geparst = JSON.parse(reader.result);
        pruefeImportStruktur(geparst);
        window.STATE = geparst;
        try {
          speichereState();
        } catch (fehler) {
          window.STATE = vorheriger;
          speichereState();
          throw new Error('Datei konnte nicht dargestellt werden, alte Daten wiederhergestellt: ' + fehler.message);
        }
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

// Wortlaut der bestehenden tribeta-Vorlage. Greift, wenn das Feld leer bleibt -
// eine Bescheinigung ohne Bestaetigungstext waere wertlos.
const STANDARD_BESTAETIGUNGSTEXT =
  'an der Schulung „{kurs}“ im Umfang von {umfang} Unterrichtseinheiten am {datum} in {ort} teilgenommen hat.';

function erstelleKurs(felder) {
  const id = naechsteId('k', window.STATE.kurse);
  window.STATE.kurse.push({
    id,
    titel: felder.titel,
    kategorie: felder.kategorie,
    beschreibung: felder.beschreibung || '',
    lernziele: felder.lernziele || [],
    voraussetzungen: felder.voraussetzungen || 'Keine',
    format: felder.format || 'Vor Ort',
    minTeilnehmer: felder.minTeilnehmer || 5,
    maxTeilnehmer: felder.maxTeilnehmer || 30,
    zertifikat: {
      kuerzel: felder.kuerzel || '',
      umfangUE: felder.umfangUE || 8,
      ueberschrift: felder.ueberschrift || felder.titel,
      bestaetigungstext: felder.bestaetigungstext || STANDARD_BESTAETIGUNGSTEXT,
      gueltigkeit: felder.gueltigkeit || 'unbefristet',
    },
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
    trainerId: felder.trainerId || null,
    vertretungTrainerId: felder.vertretungTrainerId || null,
    ort: felder.ort || '—',
    status: felder.status || 'geplant',
    checkliste: STANDARD_CHECKLISTE.map(label => ({ label, erledigt: false })),
    abschluss: null,
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

// felder.statusManuell (optional, Vorgabe false): true, wenn der Status beim
// Anlegen bewusst abweichend vom Standard gesetzt wurde - dann laesst die
// Automatik die Buchung in Ruhe und es erscheint kein Automatik-Kennzeichen.
function erstelleBuchung(felder) {
  const id = naechsteId('b', window.STATE.buchungen);
  window.STATE.buchungen.push({
    id,
    teilnehmerId: felder.teilnehmerId,
    terminId: felder.terminId,
    anmeldestatus: felder.anmeldestatus || 'angemeldet',
    gebuchtAm: new Date().toISOString().slice(0, 10),
    anwesenheitProzent: null,
    fehlgrund: null,
    zertifikatNr: null,
    statusManuell: felder.statusManuell === true,
  });
  speichereState();
  // Zweiter Ausloeser der Status-Automatik (siehe design-spec-v3.md §8): eine
  // Buchung auf einen Termin innerhalb der Bestaetigungsfrist wird sofort
  // bestaetigt, nicht erst beim naechsten Laden.
  statusAutomatikAnwenden();
  return id;
}

function aktualisiereBuchungStatus(buchungId, neuerStatus) {
  const buchung = window.STATE.buchungen.find(b => b.id === buchungId);
  if (!buchung) throw new Error(`Buchung ${buchungId} nicht gefunden`);
  buchung.anmeldestatus = neuerStatus;
  // Manuell hat immer Vorrang: ab jetzt fasst die Automatik diese Buchung
  // nicht mehr an.
  buchung.statusManuell = true;
  speichereState();
}

// Verschiebt eine bestehende Buchung auf einen anderen Termin. gebuchtAm und
// anmeldestatus bleiben bewusst erhalten - nur die Termin-Zuordnung aendert
// sich (sonst waere es dasselbe wie Loeschen + neu anlegen).
function verschiebeBuchung(buchungId, neuerTerminId) {
  const buchung = window.STATE.buchungen.find(b => b.id === buchungId);
  if (!buchung) throw new Error(`Buchung ${buchungId} nicht gefunden`);
  buchung.terminId = neuerTerminId;
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
  const kapazitaet = gefunden.kurs.maxTeilnehmer;
  const minTeilnehmer = gefunden.kurs.minTeilnehmer;
  // "Unterbesetzt" ist ein Handlungshinweis (Teilnehmer ansprechen, verschieben).
  // Bei einem vergangenen oder bereits abgeschlossenen Termin gibt es nichts mehr
  // zu tun - dort waere das Kennzeichen nur ein Dauer-Fehlalarm.
  const heute = new Date().toISOString().slice(0, 10);
  const nochAktionsrelevant = gefunden.termin.status !== 'abgeschlossen'
    && gefunden.termin.datum >= heute;
  return {
    belegt,
    kapazitaet,
    minTeilnehmer,
    frei: Math.max(0, kapazitaet - belegt),
    prozent: kapazitaet > 0 ? Math.round((belegt / kapazitaet) * 100) : 0,
    unterbesetzt: nochAktionsrelevant && belegt < minTeilnehmer,
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

// -- Einstellungen --

const EINSTELLUNGEN_VORGABE = {
  zertifikatStartNummer: 147,
  bestaetigungsfristTage: 7,
};

function einstellungen() {
  if (!window.STATE.einstellungen) {
    window.STATE.einstellungen = { ...EINSTELLUNGEN_VORGABE };
  }
  for (const [schluessel, wert] of Object.entries(EINSTELLUNGEN_VORGABE)) {
    if (window.STATE.einstellungen[schluessel] === undefined) {
      window.STATE.einstellungen[schluessel] = wert;
    }
  }
  return window.STATE.einstellungen;
}

function aktualisiereEinstellungen(felder) {
  Object.assign(einstellungen(), felder);
  speichereState();
}

// -- Kategorien (abgeleitet, keine eigene Verwaltung) --

function kategorienListe() {
  const gesehen = new Set();
  for (const kurs of window.STATE.kurse) {
    const wert = (kurs.kategorie || '').trim();
    if (wert) gesehen.add(wert);
  }
  return [...gesehen].sort((a, b) => a.localeCompare(b, 'de'));
}

// -- Trainer --

function alleTrainer() {
  if (!Array.isArray(window.STATE.trainer)) window.STATE.trainer = [];
  return window.STATE.trainer;
}

function findeTrainer(trainerId) {
  return alleTrainer().find(t => t.id === trainerId);
}

function trainerName(trainerId) {
  const t = findeTrainer(trainerId);
  return t ? t.name : '';
}

function erstelleTrainer(felder) {
  const id = naechsteId('tr', alleTrainer());
  alleTrainer().push({
    id,
    name: felder.name,
    email: felder.email || '',
    telefon: felder.telefon || '',
    qualifikation: felder.qualifikation || '',
    notizen: felder.notizen || '',
    dokumente: [],
  });
  speichereState();
  return id;
}

function aktualisiereTrainer(trainerId, felder) {
  const trainer = findeTrainer(trainerId);
  if (!trainer) throw new Error(`Trainer ${trainerId} nicht gefunden`);
  Object.assign(trainer, felder);
  speichereState();
}

function loescheTrainer(trainerId) {
  if (!findeTrainer(trainerId)) throw new Error(`Trainer ${trainerId} nicht gefunden`);
  for (const kurs of window.STATE.kurse) {
    for (const termin of kurs.termine) {
      if (termin.trainerId === trainerId) termin.trainerId = null;
      if (termin.vertretungTrainerId === trainerId) termin.vertretungTrainerId = null;
    }
  }
  window.STATE.trainer = alleTrainer().filter(t => t.id !== trainerId);
  speichereState();
}

function termineFuerTrainer(trainerId) {
  const treffer = [];
  for (const kurs of window.STATE.kurse) {
    for (const termin of kurs.termine) {
      if (termin.trainerId === trainerId) treffer.push({ kurs, termin, rolle: 'trainer' });
      else if (termin.vertretungTrainerId === trainerId) treffer.push({ kurs, termin, rolle: 'vertretung' });
    }
  }
  return treffer.sort((a, b) => a.termin.datum.localeCompare(b.termin.datum));
}

// Nachweise, die abgelaufen sind oder in den naechsten 60 Tagen ablaufen.
function trainerDokumentStatus(trainer) {
  const heute = new Date().toISOString().slice(0, 10);
  const grenze = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  let abgelaufen = 0;
  let laeuftBaldAb = 0;
  for (const dok of trainer.dokumente || []) {
    if (!dok.gueltigBis) continue;
    if (dok.gueltigBis < heute) abgelaufen++;
    else if (dok.gueltigBis <= grenze) laeuftBaldAb++;
  }
  return { abgelaufen, laeuftBaldAb };
}

// -- Status-Automatik --
// Laeuft als eigener Schritt beim Laden und nach dem Anlegen einer Buchung,
// bewusst NICHT waehrend des Renderns (Rendern bleibt seiteneffektfrei).

function statusAutomatikAnwenden() {
  const fristTage = einstellungen().bestaetigungsfristTage;
  const heute = new Date().toISOString().slice(0, 10);
  let geaendert = 0;

  for (const buchung of window.STATE.buchungen) {
    if (buchung.statusManuell) continue;
    if (buchung.anmeldestatus !== 'angemeldet') continue;
    const gefunden = findeTerminMitKurs(buchung.terminId);
    if (!gefunden) continue;
    if (gefunden.termin.abschluss) continue;
    if (gefunden.termin.datum < heute) continue;
    const tageBisTermin = Math.round(
      (new Date(gefunden.termin.datum) - new Date(heute)) / 86400000
    );
    if (tageBisTermin <= fristTage) {
      buchung.anmeldestatus = 'bestätigt';
      geaendert++;
    }
  }

  if (geaendert > 0) speichereState();
  return geaendert;
}

// -- Trainer-Dokumente (Dateiinhalt liegt in IndexedDB, siehe file-store.js) --

function trainerDokumentHinzufuegen(trainerId, referenz) {
  const trainer = findeTrainer(trainerId);
  if (!trainer) throw new Error(`Trainer ${trainerId} nicht gefunden`);
  if (!Array.isArray(trainer.dokumente)) trainer.dokumente = [];
  trainer.dokumente.push(referenz);
  speichereState();
}

function trainerDokumentEntfernen(trainerId, dateiId) {
  const trainer = findeTrainer(trainerId);
  if (!trainer) throw new Error(`Trainer ${trainerId} nicht gefunden`);
  trainer.dokumente = (trainer.dokumente || []).filter(d => d.id !== dateiId);
  speichereState();
}

// -- Produktivstart: alles leeren --

// Reihenfolge ist bewusst: erst die Dateien loeschen, dann den State. Sonst
// waeren die Verweise auf die Dateien schon weg, wenn das Loeschen in
// IndexedDB fehlschlaegt - die Blobs blieben unerreichbar liegen.
async function alleDatenLeeren() {
  if (!confirm(
    'Wirklich ALLE Daten unwiderruflich löschen?\n\n'
    + 'Kurse, Termine, Buchungen, Teilnehmer, Trainer und alle hochgeladenen '
    + 'Dateien werden entfernt. Das lässt sich nicht rückgängig machen.\n\n'
    + 'Tipp: Vorher „Exportieren“ anklicken, falls du eine Sicherung möchtest.'
  )) {
    return;
  }

  if (typeof alleDateienLoeschen === 'function') {
    try {
      await alleDateienLoeschen();
    } catch (err) {
      alert('Die hochgeladenen Dateien konnten nicht gelöscht werden: ' + err.message
        + '\n\nEs wurde nichts geleert. Bitte erneut versuchen.');
      return;
    }
  }

  window.STATE.kurse = [];
  window.STATE.teilnehmer = [];
  window.STATE.buchungen = [];
  window.STATE.trainer = [];
  speichereState();
}

// ---- Phase 2: Anwesenheit ----

// Mindestanteil der Anwesenheit, ab dem eine Teilnahmebescheinigung
// ausgestellt wird (siehe design-spec-v3.md, Abschnitt 4).
const MINDEST_ANWESENHEIT = 80;

// Fuer Anwesenheit und Bescheinigung zaehlen nur Buchungen, die nicht
// abgesagt wurden - wer abgesagt hat, war nicht da und bekommt nichts.
function anwesenheitsBuchungen(terminId) {
  return window.STATE.buchungen.filter(
    b => b.terminId === terminId && b.anmeldestatus !== 'abgesagt'
  );
}

function erfuelltMindestteilnahme(buchung) {
  return buchung.anwesenheitProzent !== null
    && buchung.anwesenheitProzent !== undefined
    && buchung.anwesenheitProzent >= MINDEST_ANWESENHEIT;
}

function anwesenheitSetzen(buchungId, prozent, fehlgrund) {
  const buchung = window.STATE.buchungen.find(b => b.id === buchungId);
  if (!buchung) throw new Error(`Buchung ${buchungId} nicht gefunden`);
  pruefeTerminOffen(buchung.terminId, 'Anwesenheit ändern');

  const zahl = Number(prozent);
  if (!Number.isFinite(zahl) || zahl < 0 || zahl > 100) {
    throw new Error('Anwesenheit muss eine Zahl zwischen 0 und 100 sein.');
  }
  buchung.anwesenheitProzent = Math.round(zahl);
  // Bei voller Anwesenheit ist ein Fehlgrund sinnlos - sonst bliebe ein
  // alter Grund stehen, nachdem korrigiert wurde.
  buchung.fehlgrund = buchung.anwesenheitProzent === 100 ? null : (fehlgrund || null);
  speichereState();
}

function alleAnwesenheitAufVoll(terminId) {
  pruefeTerminOffen(terminId, 'Anwesenheit ändern');
  const betroffen = anwesenheitsBuchungen(terminId);
  for (const buchung of betroffen) {
    buchung.anwesenheitProzent = 100;
    buchung.fehlgrund = null;
  }
  speichereState();
  return betroffen.length;
}

function anwesenheitStatistik(terminId) {
  const buchungen = anwesenheitsBuchungen(terminId);
  const erfasste = buchungen.filter(
    b => b.anwesenheitProzent !== null && b.anwesenheitProzent !== undefined
  );
  const summe = erfasste.reduce((s, b) => s + b.anwesenheitProzent, 0);
  return {
    gesamt: buchungen.length,
    erfasst: erfasste.length,
    erfuellt: buchungen.filter(erfuelltMindestteilnahme).length,
    unterMindest: erfasste.filter(b => !erfuelltMindestteilnahme(b)).length,
    durchschnitt: erfasste.length ? Math.round(summe / erfasste.length) : null,
  };
}

// ---- Phase 2: Zertifikatsnummern ----
// Schema JAHR-KUERZEL-LAUFNUMMER, z. B. 2026-DSB-0147. Die Laufnummer ist
// global fortlaufend ueber alle Kurse und startet bei einem einstellbaren
// Wert, damit der ersten Bescheinigung nicht anzusehen ist, dass sie die
// erste ist.

function naechsteZertifikatNummer() {
  let hoechste = 0;
  for (const buchung of window.STATE.buchungen) {
    if (!buchung.zertifikatNr) continue;
    const teile = String(buchung.zertifikatNr).split('-');
    const laufnummer = parseInt(teile[teile.length - 1], 10);
    if (Number.isFinite(laufnummer)) hoechste = Math.max(hoechste, laufnummer);
  }
  const naechste = hoechste > 0 ? hoechste + 1 : einstellungen().zertifikatStartNummer;
  return String(naechste).padStart(4, '0');
}

function zertifikatNummerFuer(buchungId) {
  const buchung = window.STATE.buchungen.find(b => b.id === buchungId);
  if (!buchung) throw new Error(`Buchung ${buchungId} nicht gefunden`);
  // Einmal vergeben, bleibt die Nummer stabil - ein zweiter Ausdruck darf
  // keine neue Nummer erzeugen.
  if (buchung.zertifikatNr) return buchung.zertifikatNr;

  const gefunden = findeTerminMitKurs(buchung.terminId);
  if (!gefunden) throw new Error(`Termin ${buchung.terminId} nicht gefunden`);
  const jahr = gefunden.termin.datum.slice(0, 4);
  const kuerzel = (gefunden.kurs.zertifikat && gefunden.kurs.zertifikat.kuerzel)
    || gefunden.kurs.id.toUpperCase();
  buchung.zertifikatNr = `${jahr}-${kuerzel}-${naechsteZertifikatNummer()}`;
  speichereState();
  return buchung.zertifikatNr;
}
