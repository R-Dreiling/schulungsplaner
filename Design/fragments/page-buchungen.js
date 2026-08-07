// Design/fragments/page-buchungen.js

function buchungenAktualisiereKursFilterOptionen() {
  const select = document.getElementById('buchungen-kurs-filter');
  const aktuellerWert = select.value;
  const optionen = window.STATE.kurse
    .map(k => `<option value="${escAttr(k.id)}">${escHtml(k.titel)}</option>`).join('');
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
    ? `<ul style="margin:0; padding-left:18px;">${historie.map(h => `<li>${escHtml(h.titel)}: ${h.anzahl}×</li>`).join('')}</ul>`
    : '<p class="empty-hint" style="padding:0;">Bisher keine anderen Buchungen dieser Firma.</p>';

  return `
    <tr class="expand-row ${neu ? 'buchung-neu' : ''}" onclick="buchungenToggleVerlauf('${buchung.id}')">
      <td class="cell-strong">${escHtml(teilnehmer.name)}</td>
      <td>
        <div class="zell-haupttext" title="${escAttr(teilnehmer.firma)}">${escHtml(teilnehmer.firma)}</div>
        ${teilnehmer.bestandskunde ? '<span class="pill">Bestandskunde</span>' : ''}
      </td>
      <td class="truncate" style="max-width:200px;" title="${escAttr(teilnehmer.email)}">${escHtml(teilnehmer.email)}</td>
      <td>${anmeldestatusBadgeHtml(buchung.anmeldestatus)}${
        (!buchung.statusManuell && buchung.anmeldestatus === 'bestätigt')
          ? '<span class="auto-marker" title="Status wurde automatisch bestätigt">⏱</span>'
          : ''
      }</td>
      <td>${escHtml(kurs.titel)} <span style="color:var(--muted2);">· ${formatiereDatum(termin.datum)}</span></td>
      <td onclick="event.stopPropagation();"><button class="btn btn-ghost-red" onclick="buchungenEntfernen('${buchung.id}')">Entfernen</button></td>
    </tr>
    <tr id="buchung-verlauf-${buchung.id}" style="display:none;">
      <td colspan="6" style="background:var(--card-2); padding:10px 14px 14px 34px;">
        <div class="mat-group-label" style="margin:0 0 6px 0;">Buchungshistorie ${escHtml(teilnehmer.firma)}</div>
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
    // Ueber detailVersuche: gehoert die Buchung zu einem abgeschlossenen
    // Termin, lehnt der Mutator ab - das muss die Nutzerin sehen.
    detailVersuche(() => loescheBuchung(buchungId));
  }
}

function oeffneNeueBuchungDialog() {
  const personenOptionen = window.STATE.teilnehmer
    .map(t => `<option value="${escAttr(t.id)}">${escHtml(t.name)} — ${escHtml(t.firma)}</option>`).join('');
  const terminOptionen = window.STATE.kurse.map(k => `
    <optgroup label="${escAttr(k.titel)}">
      ${k.termine.map(t => {
        // Abgeschlossene Termine gar nicht erst waehlbar machen - eine Buchung
        // darauf wuerde ohnehin abgelehnt.
        const zu = istTerminAbgeschlossen(t.id);
        return `<option value="${escAttr(t.id)}" ${zu ? 'disabled' : ''}>${formatiereDatum(t.datum)} · ${escHtml(trainerName(t.trainerId) || 'Kein Trainer')}${zu ? ' · abgeschlossen' : ''}</option>`;
      }).join('')}
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
  // Riegel VOR erstelleTeilnehmer: waere er erst an erstelleBuchung, stuende
  // die neue Person bereits gespeichert im Bestand, waehrend die Buchung
  // abgelehnt wird - eine verwaiste Person ohne jede Buchung.
  if (istTerminAbgeschlossen(felder.terminId)) {
    alert('Dieser Termin ist abgeschlossen und schreibgeschützt – es lässt sich niemand mehr dazubuchen. '
      + 'Über „Wieder öffnen" auf der Detailseite des Termins lässt sich der Schutz aufheben.');
    return false;
  }

  let teilnehmerId = felder.teilnehmerId;
  if (teilnehmerId === '__neu__') {
    teilnehmerId = erstelleTeilnehmer({
      name: felder.name, firma: felder.firma, email: felder.email, bestandskunde: false,
    });
  }
  // Ein bewusst abweichend gewaehlter Status gilt als manuell gesetzt - sonst
  // wuerde die Automatik ihn spaeter als ihren eigenen ausweisen.
  if (detailVersuche(() => erstelleBuchung({
    teilnehmerId,
    terminId: felder.terminId,
    anmeldestatus: felder.anmeldestatus,
    statusManuell: felder.anmeldestatus !== 'angemeldet',
  }))) schliesseDialog();
  return false;
}

// ---- Teilnehmer sammelweise anlegen ----
// Meldet ein Kunde mehrere Beschaeftigte, waere Einzeleingabe muehsam. Hier
// laesst sich eine Liste einfuegen - aus Excel kopiert (Tabulator), als CSV
// (Semikolon oder Komma) oder von Hand. Derselbe Weg nimmt spaeter die
// Buchungen der Website entgegen: Zeilen rein, Personen und Buchungen raus.

const SAMMEL_TRENNER = /\t|;|,/;

// Erkennt eine Kopfzeile, damit "Name;Firma;E-Mail" nicht als Person landet.
function sammelIstKopfzeile(felder) {
  const erste = (felder[0] || '').toLowerCase();
  return erste === 'name' || erste === 'nachname' || erste === 'teilnehmer';
}

function sammelZeilenLesen(text) {
  const zeilen = String(text || '').split(/\r?\n/).map(z => z.trim()).filter(Boolean);
  const ergebnis = [];
  zeilen.forEach((zeile, i) => {
    const felder = zeile.split(SAMMEL_TRENNER).map(f => f.trim());
    if (i === 0 && sammelIstKopfzeile(felder)) return;
    const [name, firma, email] = felder;
    if (!name) return;
    // Vorhandene Person: gleicher Name UND gleiche Firma. Nur der Name waere
    // zu unsicher - Namensgleichheit ueber Unternehmen hinweg kommt vor.
    const vorhanden = window.STATE.teilnehmer.find(t =>
      t.name.toLowerCase() === name.toLowerCase()
      && (t.firma || '').toLowerCase() === (firma || '').toLowerCase());
    ergebnis.push({
      name,
      firma: firma || '',
      email: email || (vorhanden ? vorhanden.email : ''),
      vorhandenId: vorhanden ? vorhanden.id : null,
      fehlt: !firma ? 'Firma fehlt' : (!email && !vorhanden ? 'E-Mail fehlt' : null),
    });
  });
  return ergebnis;
}

function oeffneSammelDialog() {
  const terminOptionen = window.STATE.kurse.map(k => `
    <optgroup label="${escAttr(k.titel)}">
      ${k.termine.map(t => {
        const zu = istTerminAbgeschlossen(t.id);
        return `<option value="${escAttr(t.id)}" ${zu ? 'disabled' : ''}>${formatiereDatum(t.datum)} · ${escHtml(trainerName(t.trainerId) || 'Kein Trainer')}${zu ? ' · abgeschlossen' : ''}</option>`;
      }).join('')}
    </optgroup>`).join('');

  oeffneDialog(`
    <div class="dialog-head"><h3>Teilnehmer sammelweise buchen</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <div class="dialog-body">
      <div class="field">
        <label>Termin</label>
        <select id="sammel-termin" required>${terminOptionen}</select>
      </div>
      <div class="field">
        <label>Liste einfügen</label>
        <textarea id="sammel-text" rows="7" placeholder="Name;Firma;E-Mail&#10;Anna Weber;Muster GmbH;a.weber@muster.de&#10;Tim Below;Muster GmbH;t.below@muster.de"
                  oninput="sammelVorschau()"></textarea>
        <div class="field-hint">Eine Person je Zeile. Aus Excel kopierte Spalten funktionieren ebenso wie Semikolon oder Komma. Eine Kopfzeile wird erkannt.</div>
      </div>
      <div id="sammel-vorschau"></div>
    </div>
    <div class="dialog-foot">
      <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
      <button type="button" class="btn btn-primary" onclick="sammelBuchen()">Buchen</button>
    </div>`);
  sammelVorschau();
}

function sammelVorschau() {
  const feld = document.getElementById('sammel-vorschau');
  if (!feld) return;
  const eintraege = sammelZeilenLesen(document.getElementById('sammel-text').value);
  if (eintraege.length === 0) {
    feld.innerHTML = '<p class="empty-hint" style="padding:8px 0;">Noch nichts eingefügt.</p>';
    return;
  }
  const neu = eintraege.filter(e => !e.vorhandenId).length;
  const zeilen = eintraege.map(e => `
    <tr>
      <td class="cell-strong">${escHtml(e.name)}</td>
      <td>${escHtml(e.firma || '—')}</td>
      <td class="truncate" style="max-width:170px;" title="${escAttr(e.email)}">${escHtml(e.email || '—')}</td>
      <td>${e.vorhandenId
        ? '<span class="badge badge-gray">bekannt</span>'
        : '<span class="badge badge-green">neu</span>'}
        ${e.fehlt ? `<span class="badge badge-amber">${escHtml(e.fehlt)}</span>` : ''}</td>
    </tr>`).join('');
  feld.innerHTML = `
    <div class="field-hint" style="margin-bottom:6px;">
      ${eintraege.length} Person(en) erkannt · ${neu} neu, ${eintraege.length - neu} bereits im Bestand
    </div>
    <div class="tabelle-scroll" style="max-height:200px; overflow-y:auto;">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Firma</th><th>E-Mail</th><th></th></tr></thead>
        <tbody>${zeilen}</tbody>
      </table>
    </div>`;
}

function sammelBuchen() {
  const terminFeld = document.getElementById('sammel-termin');
  const terminId = terminFeld ? terminFeld.value : '';
  if (!terminId) { alert('Bitte einen Termin wählen.'); return; }
  const eintraege = sammelZeilenLesen(document.getElementById('sammel-text').value);
  if (eintraege.length === 0) { alert('Es wurde keine Person erkannt.'); return; }

  // Riegel vor dem Anlegen: sonst entstuenden Personen ohne Buchung, wenn der
  // Termin abgeschlossen ist (derselbe Fehler wie frueher im Einzeldialog).
  if (istTerminAbgeschlossen(terminId)) {
    alert('Dieser Termin ist abgeschlossen und schreibgeschützt – es lässt sich niemand mehr dazubuchen.');
    return;
  }

  const a = terminAuslastung(terminId);
  const frei = a.kapazitaet - a.belegt;
  if (eintraege.length > frei && !confirm(
      `Der Termin hat noch ${frei} freie(n) Platz/Plätze, gebucht werden sollen ${eintraege.length} Personen. Trotzdem fortfahren?`)) {
    return;
  }

  let neu = 0, gebucht = 0, uebersprungen = 0;
  const fehler = [];
  for (const e of eintraege) {
    try {
      let teilnehmerId = e.vorhandenId;
      if (!teilnehmerId) {
        teilnehmerId = erstelleTeilnehmer({ name: e.name, firma: e.firma, email: e.email, bestandskunde: false });
        neu++;
      }
      // Doppelbuchung auf denselben Termin vermeiden.
      const schonGebucht = window.STATE.buchungen.some(
        b => b.teilnehmerId === teilnehmerId && b.terminId === terminId && b.anmeldestatus !== 'abgesagt');
      if (schonGebucht) { uebersprungen++; continue; }
      erstelleBuchung({ teilnehmerId, terminId, anmeldestatus: 'angemeldet' });
      gebucht++;
    } catch (fehlerObj) {
      fehler.push(`${e.name}: ${fehlerObj.message}`);
    }
  }

  schliesseDialog();
  const teile = [`${gebucht} Buchung(en) angelegt`, `${neu} Person(en) neu`];
  if (uebersprungen) teile.push(`${uebersprungen} bereits auf diesem Termin gebucht`);
  if (fehler.length) teile.push(`${fehler.length} Fehler:\n` + fehler.join('\n'));
  alert(teile.join(' · '));
}
