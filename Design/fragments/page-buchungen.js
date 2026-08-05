// Design/fragments/page-buchungen.js

function buchungenAktualisiereKursFilterOptionen() {
  const select = document.getElementById('buchungen-kurs-filter');
  const aktuellerWert = select.value;
  const optionen = window.STATE.kurse
    .map(k => `<option value="${k.id}">${k.titel}</option>`).join('');
  select.innerHTML = '<option value="">Kurs: Alle</option>' + optionen;
  if ([...select.options].some(o => o.value === aktuellerWert)) {
    select.value = aktuellerWert;
  }
}

function buchungenIstNeu(gebuchtAm) {
  const heute = new Date();
  const datum = new Date(gebuchtAm);
  // Ohne Vorzeichenpruefung wuerde auch ein in der Zukunft liegendes
  // Buchungsdatum als "neu" markiert - "neu" heisst kuerzlich gebucht.
  const tageDiff = (heute - datum) / 86400000;
  return tageDiff >= 0 && tageDiff <= 14;
}

function buchungenZeile(buchung) {
  const teilnehmer = window.STATE.teilnehmer.find(t => t.id === buchung.teilnehmerId);
  const gefunden = findeTerminMitKurs(buchung.terminId);
  if (!teilnehmer || !gefunden) return '';
  const { kurs, termin } = gefunden;
  const neu = buchungenIstNeu(buchung.gebuchtAm);
  const historie = buchungshistorieFirma(teilnehmer.firma);
  const historieHtml = historie.length
    ? `<ul style="margin:0; padding-left:18px;">${historie.map(h => `<li>${h.titel}: ${h.anzahl}×</li>`).join('')}</ul>`
    : '<p class="empty-hint" style="padding:0;">Bisher keine anderen Buchungen dieser Firma.</p>';

  return `
    <tr class="expand-row ${neu ? 'buchung-neu' : ''}" onclick="buchungenToggleVerlauf('${buchung.id}')">
      <td class="cell-strong">${teilnehmer.name}</td>
      <td>${teilnehmer.firma} ${teilnehmer.bestandskunde ? '<span class="pill">Bestandskunde</span>' : ''}</td>
      <td class="truncate" style="max-width:200px;" title="${escAttr(teilnehmer.email)}">${teilnehmer.email}</td>
      <td>${anmeldestatusBadgeHtml(buchung.anmeldestatus)}</td>
      <td>${kurs.titel} <span style="color:var(--muted2);">· ${formatiereDatum(termin.datum)}</span></td>
      <td onclick="event.stopPropagation();"><button class="btn btn-ghost-red" onclick="buchungenEntfernen('${buchung.id}')">Entfernen</button></td>
    </tr>
    <tr id="buchung-verlauf-${buchung.id}" style="display:none;">
      <td colspan="6" style="background:var(--card-2); padding:10px 14px 14px 34px;">
        <div class="mat-group-label" style="margin:0 0 6px 0;">Buchungshistorie ${teilnehmer.firma}</div>
        ${historieHtml}
      </td>
    </tr>`;
}

function renderBuchungen() {
  const tbody = document.getElementById('buchungen-tabelle');
  if (!tbody) return;
  buchungenAktualisiereKursFilterOptionen();

  const statusFilter = document.getElementById('buchungen-status-filter').value;
  const kursFilter = document.getElementById('buchungen-kurs-filter').value;

  const buchungen = buchungenSortiertNeuesteZuerst().filter(b => {
    if (statusFilter && b.anmeldestatus !== statusFilter) return false;
    if (kursFilter) {
      const gefunden = findeTerminMitKurs(b.terminId);
      if (!gefunden || gefunden.kurs.id !== kursFilter) return false;
    }
    return true;
  });

  tbody.innerHTML = buchungen.map(buchungenZeile).join('') ||
    '<tr><td colspan="6" class="empty-hint">Keine Buchungen gefunden.</td></tr>';
}

function buchungenToggleVerlauf(buchungId) {
  const zeile = document.getElementById(`buchung-verlauf-${buchungId}`);
  zeile.style.display = zeile.style.display === 'table-row' ? 'none' : 'table-row';
}

function buchungenEntfernen(buchungId) {
  if (confirm('Diese Buchung wirklich entfernen?')) {
    loescheBuchung(buchungId);
  }
}

function oeffneNeueBuchungDialog() {
  const personenOptionen = window.STATE.teilnehmer
    .map(t => `<option value="${t.id}">${t.name} — ${t.firma}</option>`).join('');
  const terminOptionen = window.STATE.kurse.map(k => `
    <optgroup label="${escAttr(k.titel)}">
      ${k.termine.map(t => `<option value="${t.id}">${formatiereDatum(t.datum)} · ${t.trainer}</option>`).join('')}
    </optgroup>`).join('');

  oeffneDialog(`
    <div class="dialog-head"><h3>Neue Buchung</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form onsubmit="return speichereNeueBuchung(event)">
      <div class="dialog-body">
        <div class="field">
          <label>Person</label>
          <select name="teilnehmerId" onchange="buchungenToggleNeuePersonFelder(this.value)">
            <option value="__neu__">— Neue Person —</option>
            ${personenOptionen}
          </select>
        </div>
        <div id="buchungen-neue-person-felder">
          <div class="field"><label>Name</label><input name="name" required /></div>
          <div class="field"><label>Firma</label><input name="firma" required /></div>
          <div class="field"><label>E-Mail</label><input type="email" name="email" required /></div>
        </div>
        <div class="field"><label>Termin</label><select name="terminId" required>${terminOptionen}</select></div>
        <div class="field">
          <label>Anmeldestatus</label>
          <select name="anmeldestatus">
            <option value="angemeldet">angemeldet</option>
            <option value="bestätigt">bestätigt</option>
          </select>
        </div>
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Buchen</button>
      </div>
    </form>`);
}

function buchungenToggleNeuePersonFelder(wert) {
  const felder = document.getElementById('buchungen-neue-person-felder');
  const sichtbar = wert === '__neu__';
  // '' statt 'flex': der Wrapper hat keine flex-direction, mit 'flex' stuenden
  // Name/Firma/E-Mail nebeneinander statt untereinander.
  felder.style.display = sichtbar ? '' : 'none';
  // required nur solange die Felder sichtbar sind - ein required-Feld in einem
  // display:none-Container blockiert das Absenden ("not focusable").
  felder.querySelectorAll('input').forEach(i => { i.required = sichtbar; });
}

function speichereNeueBuchung(ev) {
  ev.preventDefault();
  const felder = formularWerte(ev.target);
  const a = terminAuslastung(felder.terminId);
  if (a.frei <= 0 && !confirm(`Dieser Termin hat keine freien Plätze mehr (${a.belegt} von ${a.kapazitaet} belegt). Trotzdem buchen?`)) {
    return false;
  }
  let teilnehmerId = felder.teilnehmerId;
  if (teilnehmerId === '__neu__') {
    teilnehmerId = erstelleTeilnehmer({
      name: felder.name, firma: felder.firma, email: felder.email, bestandskunde: false,
    });
  }
  erstelleBuchung({ teilnehmerId, terminId: felder.terminId, anmeldestatus: felder.anmeldestatus });
  schliesseDialog();
  return false;
}
