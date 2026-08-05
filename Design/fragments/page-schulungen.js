// Design/fragments/page-schulungen.js

function schulungenGefilterteKurse() {
  const suche = (document.getElementById('schulungen-suche')?.value || '').toLowerCase();
  const kategorie = document.getElementById('schulungen-kategorie-filter')?.value || '';
  return window.STATE.kurse.filter(k =>
    (!suche || k.titel.toLowerCase().includes(suche)) &&
    (!kategorie || k.kategorie === kategorie)
  );
}

function schulungenTerminZeile(kurs, termin) {
  const a = terminAuslastung(termin.id);
  const auslastungText = a.belegt >= a.kapazitaet
    ? '<span class="badge badge-indigo">Ausgebucht</span>'
    : `${a.belegt} / ${a.kapazitaet}`;
  return `
    <tr>
      <td class="cell-strong" style="cursor:pointer;" onclick="showSchulungDetail('${termin.id}')">${formatiereDatum(termin.datum)}</td>
      <td>${termin.trainer}</td>
      <td>${termin.format} · ${termin.ort}</td>
      <td>${statusBadgeHtml(termin.status)}</td>
      <td>${auslastungText}</td>
      <td style="text-align:right; white-space:nowrap;">
        <button class="btn" onclick="showSchulungDetail('${termin.id}')">Öffnen</button>
        <button class="btn" onclick="oeffneTerminBearbeitenDialog('${termin.id}')">Bearbeiten</button>
        <button class="btn btn-ghost-red" onclick="terminLoeschenBestaetigen('${termin.id}')">Löschen</button>
      </td>
    </tr>`;
}

function renderSchulungen() {
  const container = document.getElementById('schulungen-kursliste');
  if (!container) return;
  const kurse = schulungenGefilterteKurse();

  container.innerHTML = kurse.map(kurs => `
    <div style="border-bottom:1px solid var(--line); padding:14px 0;">
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <div class="expand-row" style="flex:1;" onclick="schulungenToggle('${kurs.id}')">
          <span class="expand-toggle" id="s-toggle-${kurs.id}">▸</span>
          <strong style="font-family:var(--font-display); font-size:14px; color:var(--ink);">${kurs.titel}</strong>
          <span style="color:var(--muted); font-size:12px; margin-left:8px;">${kurs.kategorie} · ${kurs.termine.length} Termin(e)</span>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn" onclick="oeffneNeuerTerminDialog('${kurs.id}')">+ Termin</button>
          <button class="btn" onclick="oeffneKursBearbeitenDialog('${kurs.id}')">Bearbeiten</button>
          <button class="btn btn-ghost-red" onclick="kursLoeschenBestaetigen('${kurs.id}')">Löschen</button>
        </div>
      </div>
      <div class="expand-content" id="s-expand-${kurs.id}">
        <table class="data-table fixed-rows">
          <thead><tr><th>Datum</th><th>Trainer</th><th>Format / Ort</th><th>Status</th><th>Teilnehmer</th><th></th></tr></thead>
          <tbody>${kurs.termine.map(t => schulungenTerminZeile(kurs, t)).join('')}</tbody>
        </table>
      </div>
    </div>`).join('');
}

function schulungenToggle(kursId) {
  document.getElementById(`s-expand-${kursId}`).classList.toggle('open');
  document.getElementById(`s-toggle-${kursId}`).classList.toggle('open');
}

function oeffneNeuerKursDialog() {
  oeffneDialog(`
    <div class="dialog-head"><h3>Neuen Kurs anlegen</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form id="neuer-kurs-form" onsubmit="return speichereNeuerKurs(event)">
      <div class="dialog-body">
        <div class="field"><label>Titel</label><input name="titel" required /></div>
        <div class="field">
          <label>Kategorie</label>
          <select name="kategorie" required>
            <option value="Datenschutz">Datenschutz</option>
            <option value="Compliance">Compliance</option>
            <option value="Arbeitssicherheit">Arbeitssicherheit</option>
          </select>
        </div>
        <div class="field"><label>Beschreibung</label><textarea name="beschreibung" rows="3"></textarea></div>
        <div class="field"><label>Zielgruppe</label><input name="zielgruppe" /></div>
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Kurs anlegen</button>
      </div>
    </form>`);
}

function speichereNeuerKurs(ev) {
  ev.preventDefault();
  const felder = formularWerte(ev.target);
  felder.lernziele = [];
  felder.voraussetzungen = felder.voraussetzungen || 'Keine';
  erstelleKurs(felder);
  schliesseDialog();
  return false;
}

function oeffneKursBearbeitenDialog(kursId) {
  const kurs = findeKurs(kursId);
  oeffneDialog(`
    <div class="dialog-head"><h3>Kurs bearbeiten</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form id="kurs-bearbeiten-form" onsubmit="return speichereKursBearbeiten(event, '${kursId}')">
      <div class="dialog-body">
        <div class="field"><label>Titel</label><input name="titel" value="${escAttr(kurs.titel)}" required /></div>
        <div class="field">
          <label>Kategorie</label>
          <select name="kategorie" required>
            <option ${kurs.kategorie === 'Datenschutz' ? 'selected' : ''}>Datenschutz</option>
            <option ${kurs.kategorie === 'Compliance' ? 'selected' : ''}>Compliance</option>
            <option ${kurs.kategorie === 'Arbeitssicherheit' ? 'selected' : ''}>Arbeitssicherheit</option>
          </select>
        </div>
        <div class="field"><label>Beschreibung</label><textarea name="beschreibung" rows="3">${kurs.beschreibung}</textarea></div>
        <div class="field"><label>Zielgruppe</label><input name="zielgruppe" value="${escAttr(kurs.zielgruppe)}" /></div>
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Speichern</button>
      </div>
    </form>`);
}

function speichereKursBearbeiten(ev, kursId) {
  ev.preventDefault();
  aktualisiereKurs(kursId, formularWerte(ev.target));
  schliesseDialog();
  return false;
}

function kursLoeschenBestaetigen(kursId) {
  const kurs = findeKurs(kursId);
  if (confirm(`"${kurs.titel}" mit allen ${kurs.termine.length} Terminen und zugehörigen Buchungen wirklich löschen?`)) {
    loescheKurs(kursId);
  }
}

function oeffneNeuerTerminDialog(kursId) {
  oeffneDialog(`
    <div class="dialog-head"><h3>Neuen Termin anlegen</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form id="neuer-termin-form" onsubmit="return speichereNeuerTermin(event, '${kursId}')">
      <div class="dialog-body">
        <div class="field-row2">
          <div class="field"><label>Datum</label><input type="date" name="datum" required /></div>
          <div class="field"><label>Kapazität</label><input type="number" name="kapazitaet" min="1" required /></div>
        </div>
        <div class="field-row2">
          <div class="field"><label>Trainer</label><input name="trainer" required /></div>
          <div class="field">
            <label>Format</label>
            <select name="format"><option>Vor Ort</option><option>Online</option></select>
          </div>
        </div>
        <div class="field"><label>Ort</label><input name="ort" placeholder="z. B. Hamburg oder — bei Online" /></div>
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Termin anlegen</button>
      </div>
    </form>`);
}

function speichereNeuerTermin(ev, kursId) {
  ev.preventDefault();
  const felder = formularWerte(ev.target);
  felder.kapazitaet = parseInt(felder.kapazitaet, 10);
  erstelleTermin(kursId, felder);
  schliesseDialog();
  return false;
}

function oeffneTerminBearbeitenDialog(terminId) {
  const { termin } = findeTerminMitKurs(terminId);
  oeffneDialog(`
    <div class="dialog-head"><h3>Termin bearbeiten</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form id="termin-bearbeiten-form" onsubmit="return speichereTerminBearbeiten(event, '${terminId}')">
      <div class="dialog-body">
        <div class="field-row2">
          <div class="field"><label>Datum</label><input type="date" name="datum" value="${termin.datum}" required /></div>
          <div class="field"><label>Kapazität</label><input type="number" name="kapazitaet" min="1" value="${termin.kapazitaet}" required /></div>
        </div>
        <div class="field-row2">
          <div class="field"><label>Trainer</label><input name="trainer" value="${escAttr(termin.trainer)}" required /></div>
          <div class="field">
            <label>Format</label>
            <select name="format">
              <option ${termin.format === 'Vor Ort' ? 'selected' : ''}>Vor Ort</option>
              <option ${termin.format === 'Online' ? 'selected' : ''}>Online</option>
            </select>
          </div>
        </div>
        <div class="field"><label>Ort</label><input name="ort" value="${escAttr(termin.ort)}" /></div>
        <div class="field">
          <label>Status</label>
          <select name="status">
            <option value="geplant" ${termin.status === 'geplant' ? 'selected' : ''}>geplant</option>
            <option value="laufend" ${termin.status === 'laufend' ? 'selected' : ''}>laufend</option>
            <option value="abgeschlossen" ${termin.status === 'abgeschlossen' ? 'selected' : ''}>abgeschlossen</option>
          </select>
        </div>
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Speichern</button>
      </div>
    </form>`);
}

function speichereTerminBearbeiten(ev, terminId) {
  ev.preventDefault();
  const felder = formularWerte(ev.target);
  felder.kapazitaet = parseInt(felder.kapazitaet, 10);
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
