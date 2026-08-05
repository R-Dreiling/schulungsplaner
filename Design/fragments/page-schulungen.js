// Design/fragments/page-schulungen.js

function schulungenGefilterteKurse() {
  const suche = (document.getElementById('schulungen-suche')?.value || '').toLowerCase();
  const kategorie = document.getElementById('schulungen-kategorie-filter')?.value || '';
  return window.STATE.kurse.filter(k =>
    (!suche || k.titel.toLowerCase().includes(suche)) &&
    (!kategorie || k.kategorie === kategorie)
  );
}

// Vorschlagsliste fuer das Kategorie-Freitextfeld, gespeist aus dem Bestand.
function schulungenKategorieDatalist() {
  const optionen = kategorienListe()
    .map(k => `<option value="${escAttr(k)}"></option>`).join('');
  return `<datalist id="kategorien-liste">${optionen}</datalist>`;
}

// Optionen fuer eine Trainer-Auswahl. mitLeer=true ergaenzt einen leeren
// Eintrag (fuer das optionale Vertretungsfeld).
function schulungenTrainerOptionen(ausgewaehlt, mitLeer) {
  const leer = mitLeer
    ? `<option value="" ${!ausgewaehlt ? 'selected' : ''}>— keine —</option>`
    : '';
  const rest = alleTrainer().map(t =>
    `<option value="${escAttr(t.id)}" ${t.id === ausgewaehlt ? 'selected' : ''}>${escHtml(t.name)}</option>`
  ).join('');
  return leer + rest;
}

function schulungenTerminZeile(kurs, termin) {
  const a = terminAuslastung(termin.id);
  let auslastungText;
  if (a.belegt >= a.kapazitaet) {
    auslastungText = '<span class="badge badge-indigo">Ausgebucht</span>';
  } else if (a.unterbesetzt) {
    auslastungText = `<span class="badge badge-unterbesetzt">${a.belegt} von mind. ${a.minTeilnehmer}</span>`;
  } else {
    auslastungText = `${a.belegt} / ${a.kapazitaet}`;
  }

  const trainer = termin.trainerId
    ? escHtml(trainerName(termin.trainerId))
    : '<span style="color:var(--status-red-fg);">Kein Trainer zugeordnet</span>';
  const vertretung = termin.vertretungTrainerId
    ? `<div style="font-size:11.5px; color:var(--muted);">Vertretung: ${escHtml(trainerName(termin.vertretungTrainerId))}</div>`
    : '';

  return `
    <tr>
      <td class="cell-strong" style="cursor:pointer;" onclick="showSchulungDetail('${termin.id}')">${formatiereDatum(termin.datum)}</td>
      <td>${trainer}${vertretung}</td>
      <td>${escHtml(kurs.format)} · ${escHtml(termin.ort)}</td>
      <td>${statusBadgeHtml(termin.status)}</td>
      <td>${auslastungText}</td>
      <td style="text-align:right; white-space:nowrap;">
        <button class="btn" onclick="showSchulungDetail('${termin.id}')">Öffnen</button>
        <button class="btn" onclick="oeffneTerminBearbeitenDialog('${termin.id}')">Bearbeiten</button>
        <button class="btn btn-ghost-red" onclick="terminLoeschenBestaetigen('${termin.id}')">Löschen</button>
      </td>
    </tr>`;
}

function schulungenAktualisiereKategorieFilter() {
  const select = document.getElementById('schulungen-kategorie-filter');
  if (!select) return;
  const aktuell = select.value;
  select.innerHTML = '<option value="">Kategorie: Alle</option>'
    + kategorienListe().map(k => `<option value="${escAttr(k)}">${escHtml(k)}</option>`).join('');
  if ([...select.options].some(o => o.value === aktuell)) select.value = aktuell;
}

function renderSchulungen() {
  const container = document.getElementById('schulungen-kursliste');
  if (!container) return;
  schulungenAktualisiereKategorieFilter();
  const kurse = schulungenGefilterteKurse();

  if (kurse.length === 0) {
    container.innerHTML = window.STATE.kurse.length === 0
      ? '<div class="leer-hinweis">Noch keine Kurse angelegt. Über „+ Neuer Kurs" startest du.</div>'
      : '<p class="empty-hint">Keine Kurse gefunden.</p>';
    return;
  }

  container.innerHTML = kurse.map(kurs => `
    <div style="border-bottom:1px solid var(--line); padding:14px 0;">
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <div class="expand-row" style="flex:1;" onclick="schulungenToggle('${kurs.id}')">
          <span class="expand-toggle" id="s-toggle-${kurs.id}">▸</span>
          <strong style="font-family:var(--font-display); font-size:14px; color:var(--ink);">${escHtml(kurs.titel)}</strong>
          <span style="color:var(--muted); font-size:12px; margin-left:8px;">${escHtml(kurs.kategorie)} · ${escHtml(kurs.format)} · ${kurs.minTeilnehmer}–${kurs.maxTeilnehmer} Teilnehmer · ${kurs.termine.length} Termin(e)</span>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn" onclick="oeffneNeuerTerminDialog('${kurs.id}')">+ Termin</button>
          <button class="btn" onclick="oeffneKursBearbeitenDialog('${kurs.id}')">Bearbeiten</button>
          <button class="btn btn-ghost-red" onclick="kursLoeschenBestaetigen('${kurs.id}')">Löschen</button>
        </div>
      </div>
      <div class="expand-content" id="s-expand-${kurs.id}">
        ${kurs.termine.length === 0
          ? '<p class="empty-hint">Noch keine Termine. Über „+ Termin" anlegen.</p>'
          : `<table class="data-table fixed-rows">
          <thead><tr><th>Datum</th><th>Trainer</th><th>Format / Ort</th><th>Status</th><th>Teilnehmer</th><th></th></tr></thead>
          <tbody>${kurs.termine.map(t => schulungenTerminZeile(kurs, t)).join('')}</tbody>
        </table>`}
      </div>
    </div>`).join('');
}

function schulungenToggle(kursId) {
  document.getElementById(`s-expand-${kursId}`).classList.toggle('open');
  document.getElementById(`s-toggle-${kursId}`).classList.toggle('open');
}

// Gemeinsamer Formularrumpf fuer "Neuer Kurs" und "Kurs bearbeiten" - beide
// Dialoge zeigen exakt dieselben Felder, daher eine Quelle.
function schulungenKursFormularFelder(kurs) {
  const k = kurs || {
    titel: '', kategorie: '', beschreibung: '', voraussetzungen: 'Keine',
    format: 'Vor Ort', minTeilnehmer: 5, maxTeilnehmer: 30,
    zertifikat: { kuerzel: '', umfangUE: 8, ueberschrift: '', bestaetigungstext: '', gueltigkeit: 'unbefristet' },
  };
  const z = k.zertifikat || {};
  return `
    ${schulungenKategorieDatalist()}
    <div class="field"><label>Titel</label><input name="titel" value="${escAttr(k.titel)}" required /></div>
    <div class="field">
      <label>Kategorie</label>
      <input name="kategorie" list="kategorien-liste" value="${escAttr(k.kategorie)}" required />
      <div class="field-hint">Vorhandene auswählen oder neue eintippen</div>
    </div>
    <div class="field-row2">
      <div class="field">
        <label>Format</label>
        <select name="format">
          <option ${k.format === 'Vor Ort' ? 'selected' : ''}>Vor Ort</option>
          <option ${k.format === 'Online' ? 'selected' : ''}>Online</option>
          <option ${k.format === 'Hybrid' ? 'selected' : ''}>Hybrid</option>
        </select>
      </div>
      <div class="field"><label>Umfang (UE)</label><input type="number" name="umfangUE" min="1" value="${z.umfangUE || 8}" required /></div>
    </div>
    <div class="field-row2">
      <div class="field"><label>Mindestteilnehmer</label><input type="number" name="minTeilnehmer" min="1" value="${k.minTeilnehmer}" required /></div>
      <div class="field"><label>Maximalteilnehmer</label><input type="number" name="maxTeilnehmer" min="1" value="${k.maxTeilnehmer}" required /></div>
    </div>
    <div class="field"><label>Beschreibung</label><textarea name="beschreibung" rows="3">${escHtml(k.beschreibung)}</textarea></div>
    <div class="field"><label>Voraussetzungen</label><input name="voraussetzungen" value="${escAttr(k.voraussetzungen)}" /></div>
    <div class="field"><label>Kürzel für Zertifikatsnummer</label><input name="kuerzel" value="${escAttr(z.kuerzel || '')}" placeholder="z. B. DSB" /></div>
    <div class="field"><label>Gültigkeit der Bescheinigung</label><input name="gueltigkeit" value="${escAttr(z.gueltigkeit || 'unbefristet')}" /></div>
    <div class="field">
      <label>Überschrift auf der Bescheinigung</label>
      <input name="ueberschrift" value="${escAttr(z.ueberschrift || '')}" placeholder="z. B. Zertifizierungslehrgang Datenschutzbeauftragte:r" />
    </div>
    <div class="field">
      <label>Bestätigungstext auf der Bescheinigung</label>
      <textarea name="bestaetigungstext" rows="3">${escHtml(z.bestaetigungstext || '')}</textarea>
      <div class="field-hint">Platzhalter: {teilnehmer}, {kurs}, {umfang}, {datum}, {ort}, {trainer}</div>
    </div>`;
}

// Liest die Zahlenfelder als Zahlen und prueft min <= max.
function schulungenKursFelderLesen(form) {
  const felder = formularWerte(form);
  felder.minTeilnehmer = parseInt(felder.minTeilnehmer, 10);
  felder.maxTeilnehmer = parseInt(felder.maxTeilnehmer, 10);
  felder.umfangUE = parseInt(felder.umfangUE, 10);
  if (felder.minTeilnehmer > felder.maxTeilnehmer) {
    alert('Die Mindestteilnehmerzahl darf nicht größer als die Maximalteilnehmerzahl sein.');
    return null;
  }
  return felder;
}

function oeffneNeuerKursDialog() {
  oeffneDialog(`
    <div class="dialog-head"><h3>Neuen Kurs anlegen</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form onsubmit="return speichereNeuerKurs(event)">
      <div class="dialog-body">${schulungenKursFormularFelder(null)}</div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Kurs anlegen</button>
      </div>
    </form>`);
}

function speichereNeuerKurs(ev) {
  ev.preventDefault();
  const felder = schulungenKursFelderLesen(ev.target);
  if (!felder) return false;
  felder.lernziele = [];
  erstelleKurs(felder);
  schliesseDialog();
  return false;
}

function oeffneKursBearbeitenDialog(kursId) {
  const kurs = findeKurs(kursId);
  oeffneDialog(`
    <div class="dialog-head"><h3>Kurs bearbeiten</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form onsubmit="return speichereKursBearbeiten(event, '${kursId}')">
      <div class="dialog-body">${schulungenKursFormularFelder(kurs)}</div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Speichern</button>
      </div>
    </form>`);
}

function speichereKursBearbeiten(ev, kursId) {
  ev.preventDefault();
  const felder = schulungenKursFelderLesen(ev.target);
  if (!felder) return false;
  const kurs = findeKurs(kursId);
  // Zertifikatsfelder liegen verschachtelt, daher getrennt zusammensetzen.
  aktualisiereKurs(kursId, {
    titel: felder.titel,
    kategorie: felder.kategorie,
    beschreibung: felder.beschreibung,
    voraussetzungen: felder.voraussetzungen,
    format: felder.format,
    minTeilnehmer: felder.minTeilnehmer,
    maxTeilnehmer: felder.maxTeilnehmer,
    zertifikat: {
      ...kurs.zertifikat,
      kuerzel: felder.kuerzel,
      umfangUE: felder.umfangUE,
      gueltigkeit: felder.gueltigkeit,
      // Leer gelassen heisst "wie der Kurs heisst" bzw. "Standardwortlaut" -
      // eine Bescheinigung ohne Ueberschrift oder Text waere nicht brauchbar.
      ueberschrift: felder.ueberschrift.trim() || felder.titel,
      bestaetigungstext: felder.bestaetigungstext.trim() || STANDARD_BESTAETIGUNGSTEXT,
    },
  });
  schliesseDialog();
  return false;
}

function kursLoeschenBestaetigen(kursId) {
  const kurs = findeKurs(kursId);
  if (confirm(`"${kurs.titel}" mit allen ${kurs.termine.length} Terminen und zugehörigen Buchungen wirklich löschen?`)) {
    loescheKurs(kursId);
  }
}

// Gemeinsamer Formularrumpf fuer beide Termin-Dialoge.
function schulungenTerminFormularFelder(termin) {
  const t = termin || { datum: '', trainerId: '', vertretungTrainerId: '', ort: '', status: 'geplant' };
  return `
    <div class="field"><label>Datum</label><input type="date" name="datum" value="${escAttr(t.datum)}" required /></div>
    <div class="field">
      <label>Trainer</label>
      <select name="trainerId" required>${schulungenTrainerOptionen(t.trainerId, true)}</select>
      <div class="field-hint">Trainer werden im Bereich „Trainer" gepflegt</div>
    </div>
    <div class="field">
      <label>Vertretung (optional)</label>
      <select name="vertretungTrainerId">${schulungenTrainerOptionen(t.vertretungTrainerId, true)}</select>
    </div>
    <div class="field"><label>Ort</label><input name="ort" value="${escAttr(t.ort)}" placeholder="z. B. Hamburg oder — bei Online" /></div>
    <div class="field">
      <label>Status</label>
      <select name="status">
        <option value="geplant" ${t.status === 'geplant' ? 'selected' : ''}>geplant</option>
        <option value="laufend" ${t.status === 'laufend' ? 'selected' : ''}>laufend</option>
        <option value="abgeschlossen" ${t.status === 'abgeschlossen' ? 'selected' : ''}>abgeschlossen</option>
      </select>
    </div>`;
}

function schulungenTerminFelderLesen(form) {
  const felder = formularWerte(form);
  // Leere Auswahl bedeutet "nicht zugeordnet", nicht der leere String.
  felder.trainerId = felder.trainerId || null;
  felder.vertretungTrainerId = felder.vertretungTrainerId || null;
  if (felder.trainerId && felder.trainerId === felder.vertretungTrainerId) {
    alert('Trainer und Vertretung dürfen nicht dieselbe Person sein.');
    return null;
  }
  return felder;
}

function oeffneNeuerTerminDialog(kursId) {
  if (alleTrainer().length === 0) {
    alert('Bitte zuerst im Bereich „Trainer" mindestens eine Person anlegen.');
    return;
  }
  oeffneDialog(`
    <div class="dialog-head"><h3>Neuen Termin anlegen</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form onsubmit="return speichereNeuerTermin(event, '${kursId}')">
      <div class="dialog-body">${schulungenTerminFormularFelder(null)}</div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Termin anlegen</button>
      </div>
    </form>`);
}

function speichereNeuerTermin(ev, kursId) {
  ev.preventDefault();
  const felder = schulungenTerminFelderLesen(ev.target);
  if (!felder) return false;
  erstelleTermin(kursId, felder);
  schliesseDialog();
  return false;
}

function oeffneTerminBearbeitenDialog(terminId) {
  const { termin } = findeTerminMitKurs(terminId);
  oeffneDialog(`
    <div class="dialog-head"><h3>Termin bearbeiten</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form onsubmit="return speichereTerminBearbeiten(event, '${terminId}')">
      <div class="dialog-body">${schulungenTerminFormularFelder(termin)}</div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Speichern</button>
      </div>
    </form>`);
}

function speichereTerminBearbeiten(ev, terminId) {
  ev.preventDefault();
  const felder = schulungenTerminFelderLesen(ev.target);
  if (!felder) return false;
  aktualisiereTermin(terminId, felder);
  schliesseDialog();
  return false;
}

function terminLoeschenBestaetigen(terminId) {
  const { kurs, termin } = findeTerminMitKurs(terminId);
  if (confirm(`Termin "${kurs.titel}" am ${formatiereDatum(termin.datum)} mit allen Buchungen wirklich löschen?`)) {
    loescheTermin(terminId);
  }
}
