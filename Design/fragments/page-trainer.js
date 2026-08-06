// Design/fragments/page-trainer.js

function trainerInitialen(name) {
  return (name || '?')
    .split(/\s+/)
    .filter(teil => /[A-Za-zÄÖÜäöüß]/.test(teil))
    .slice(-2)
    .map(teil => teil[0].toUpperCase())
    .join('') || '?';
}

function trainerListeHtml() {
  const trainer = alleTrainer();
  if (trainer.length === 0) {
    return '<div class="leer-hinweis">Noch keine Trainer angelegt. Über „+ Neuer Trainer" startest du.</div>';
  }
  const karten = trainer.map(t => {
    const termine = termineFuerTrainer(t.id);
    const status = trainerDokumentStatus(t);
    let warnung = '';
    if (status.abgelaufen > 0) {
      warnung = `<div class="trainer-warn">${status.abgelaufen} Nachweis(e) abgelaufen</div>`;
    } else if (status.laeuftBaldAb > 0) {
      warnung = `<div class="trainer-warn" style="color:var(--status-amber-fg);">${status.laeuftBaldAb} Nachweis(e) laufen bald ab</div>`;
    }
    return `
      <div class="trainer-card" onclick="showTrainerDetail('${escJsArg(t.id)}')">
        <div class="trainer-card-head">
          <div class="trainer-avatar">${escHtml(trainerInitialen(t.name))}</div>
          <div>
            <div class="trainer-card-name">${escHtml(t.name)}</div>
            <div class="trainer-card-sub">${escHtml(t.qualifikation || 'Keine Qualifikation hinterlegt')}</div>
          </div>
        </div>
        <div class="trainer-card-body">
          <div>${termine.length} Termin(e) zugeordnet</div>
          <div>${(t.dokumente || []).length} Nachweis(e) hinterlegt</div>
          ${warnung}
        </div>
      </div>`;
  }).join('');

  return `<div class="trainer-grid">${karten}</div>`;
}

function trainerDokumentZeile(trainer, dok) {
  const heute = new Date().toISOString().slice(0, 10);
  const grenze = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  let fristHtml = '<span class="dok-frist ok">ohne Frist</span>';
  if (dok.gueltigBis) {
    let klasse = 'ok';
    if (dok.gueltigBis < heute) klasse = 'abgelaufen';
    else if (dok.gueltigBis <= grenze) klasse = 'bald';
    const praefix = klasse === 'abgelaufen' ? 'abgelaufen am ' : 'gültig bis ';
    fristHtml = `<span class="dok-frist ${klasse}">${praefix}${formatiereDatum(dok.gueltigBis)}</span>`;
  }
  return `
    <div class="dok-row">
      <div class="mat-icon">📄</div>
      <div>
        <div class="mat-name">${escHtml(dok.name)}</div>
        <div class="mat-sub">${Math.max(1, Math.round(dok.groesse / 1024))} KB · ${fristHtml}</div>
      </div>
      <div class="mat-actions">
        <button class="btn" onclick="herunterladeDatei('${escJsArg(dok.id)}', '${escJsArg(dok.name)}')">↓</button>
        <button class="btn btn-ghost-red" onclick="trainerDokumentEntfernenBestaetigen('${escJsArg(trainer.id)}', '${escJsArg(dok.id)}')">Entfernen</button>
      </div>
    </div>`;
}

function trainerDetailHtml(trainer) {
  const termine = termineFuerTrainer(trainer.id);
  const dokumente = (trainer.dokumente || []).length
    ? trainer.dokumente.map(d => trainerDokumentZeile(trainer, d)).join('')
    : '<p class="empty-hint">Noch keine Nachweise hinterlegt.</p>';

  const terminZeilen = termine.length
    ? termine.map(({ kurs, termin, rolle }) => `
        <tr>
          <td class="cell-strong" style="cursor:pointer;" onclick="showSchulungDetail('${escJsArg(termin.id)}')">${formatiereDatum(termin.datum)}</td>
          <td>${escHtml(kurs.titel)}</td>
          <td>${escHtml(termin.ort)}</td>
          <td>${rolle === 'vertretung' ? '<span class="pill">Vertretung</span>' : '<span class="pill">Trainer</span>'}</td>
        </tr>`).join('')
    : '<tr><td colspan="4" class="empty-hint">Diese Person ist keinem Termin zugeordnet.</td></tr>';

  return `
    <button class="crumb" onclick="showTrainerListe()">← Zurück zur Trainerliste</button>

    <div class="card">
      <div style="display:flex; align-items:flex-start; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:14px;">
          <div class="trainer-avatar" style="width:52px; height:52px; font-size:17px;">${escHtml(trainerInitialen(trainer.name))}</div>
          <div>
            <h2 style="font-size:20px; margin:0 0 4px 0;">${escHtml(trainer.name)}</h2>
            <div style="font-size:12.5px; color:var(--muted);">${escHtml(trainer.qualifikation || 'Keine Qualifikation hinterlegt')}</div>
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn" onclick="oeffneTrainerBearbeitenDialog('${escJsArg(trainer.id)}')">Bearbeiten</button>
          <button class="btn btn-ghost-red" onclick="trainerLoeschenBestaetigen('${escJsArg(trainer.id)}')">Löschen</button>
        </div>
      </div>
      <div style="display:flex; gap:32px; font-size:13px; margin-top:14px;">
        <div><div class="mat-group-label" style="margin:0 0 3px 0;">E-Mail</div><div style="color:var(--ink);">${escHtml(trainer.email || '—')}</div></div>
        <div><div class="mat-group-label" style="margin:0 0 3px 0;">Telefon</div><div style="color:var(--ink);">${escHtml(trainer.telefon || '—')}</div></div>
      </div>
      ${trainer.notizen ? `<div style="margin-top:14px; font-size:13px; color:var(--text);">${escHtml(trainer.notizen)}</div>` : ''}
    </div>

    <div class="card">
      <div class="section-title">Nachweise &amp; Dokumente <small>${(trainer.dokumente || []).length}</small></div>
      ${dokumente}
      <div style="margin-top:12px; display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap;">
        <div class="field" style="flex:1; min-width:180px;">
          <label>Datei</label>
          <label class="datei-wahl">
            <input type="file" id="trainer-datei-input" onchange="trainerDateiNameZeigen(this)" />
            <span class="datei-wahl-knopf">Datei wählen</span>
            <span class="datei-wahl-name" id="trainer-datei-name">keine gewählt</span>
          </label>
        </div>
        <div class="field">
          <label>gültig bis (optional)</label>
          <input type="date" id="trainer-datei-frist" />
        </div>
        <button class="btn btn-primary" onclick="trainerDokumentHochladen('${escJsArg(trainer.id)}')">Hochladen</button>
      </div>
    </div>

    <div class="card">
      <div class="section-title">Eingeplante Termine <small>${termine.length}</small></div>
      <table class="data-table fixed-rows">
        <thead><tr><th>Datum</th><th>Kurs</th><th>Ort</th><th>Rolle</th></tr></thead>
        <tbody>${terminZeilen}</tbody>
      </table>
    </div>`;
}

function renderTrainer(trainerId) {
  const container = document.getElementById('trainer-inhalt');
  if (!container) return;
  const trainer = trainerId ? findeTrainer(trainerId) : undefined;

  if (!trainer) {
    window.AKTUELLER_TRAINER_ID = undefined;
    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-text">
          <h1>Trainer</h1>
          <p class="subtitle">Dozenten, ihre Nachweise und Einsätze.</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" onclick="oeffneNeuerTrainerDialog()">+ Neuer Trainer</button>
        </div>
      </div>
      ${trainerListeHtml()}`;
    return;
  }

  container.innerHTML = trainerDetailHtml(trainer);
}

function showTrainerListe() {
  window.AKTUELLER_TRAINER_ID = undefined;
  renderTrainer(undefined);
}

function trainerFormularFelder(trainer) {
  const t = trainer || { name: '', email: '', telefon: '', qualifikation: '', notizen: '' };
  return `
    <div class="field"><label>Name</label><input name="name" value="${escAttr(t.name)}" required /></div>
    <div class="field-row2">
      <div class="field"><label>E-Mail</label><input type="email" name="email" value="${escAttr(t.email)}" /></div>
      <div class="field"><label>Telefon</label><input name="telefon" value="${escAttr(t.telefon)}" /></div>
    </div>
    <div class="field"><label>Qualifikation / Schwerpunkte</label><input name="qualifikation" value="${escAttr(t.qualifikation)}" /></div>
    <div class="field"><label>Notizen</label><textarea name="notizen" rows="3">${escHtml(t.notizen)}</textarea></div>`;
}

function oeffneNeuerTrainerDialog() {
  oeffneDialog(`
    <div class="dialog-head"><h3>Neuen Trainer anlegen</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form onsubmit="return speichereNeuerTrainer(event)">
      <div class="dialog-body">${trainerFormularFelder(null)}</div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Trainer anlegen</button>
      </div>
    </form>`);
}

function speichereNeuerTrainer(ev) {
  ev.preventDefault();
  erstelleTrainer(formularWerte(ev.target));
  schliesseDialog();
  return false;
}

function oeffneTrainerBearbeitenDialog(trainerId) {
  const trainer = findeTrainer(trainerId);
  oeffneDialog(`
    <div class="dialog-head"><h3>Trainer bearbeiten</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form onsubmit="return speichereTrainerBearbeiten(event, '${escJsArg(trainerId)}')">
      <div class="dialog-body">${trainerFormularFelder(trainer)}</div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Speichern</button>
      </div>
    </form>`);
}

function speichereTrainerBearbeiten(ev, trainerId) {
  ev.preventDefault();
  aktualisiereTrainer(trainerId, formularWerte(ev.target));
  schliesseDialog();
  return false;
}

function trainerLoeschenBestaetigen(trainerId) {
  const trainer = findeTrainer(trainerId);
  const anzahl = termineFuerTrainer(trainerId).length;
  const zusatz = anzahl > 0
    ? `\n\n"${trainer.name}" ist noch bei ${anzahl} Termin(en) eingetragen. Diese Termine haben danach keinen Trainer mehr.`
    : '';
  if (confirm(`"${trainer.name}" wirklich löschen?${zusatz}`)) {
    loescheTrainer(trainerId);
    showTrainerListe();
  }
}

// Hier wird die Datei erst gewaehlt und dann ueber "Hochladen" uebernommen -
// ohne Namensanzeige waere nach dem Waehlen nicht erkennbar, was ansteht.
function trainerDateiNameZeigen(input) {
  const anzeige = document.getElementById('trainer-datei-name');
  if (!anzeige) return;
  const datei = input.files && input.files[0];
  anzeige.textContent = datei ? datei.name : 'keine gewählt';
  anzeige.classList.toggle('gewaehlt', !!datei);
}

function trainerDokumentHochladen(trainerId) {
  const dateiFeld = document.getElementById('trainer-datei-input');
  const fristFeld = document.getElementById('trainer-datei-frist');
  const datei = dateiFeld && dateiFeld.files[0];
  if (!datei) {
    alert('Bitte zuerst eine Datei auswählen.');
    return;
  }
  speichereTrainerDokument(datei, trainerId, fristFeld ? fristFeld.value : null)
    .catch(err => alert('Upload fehlgeschlagen: ' + err.message));
}

function trainerDokumentEntfernenBestaetigen(trainerId, dateiId) {
  if (confirm('Diesen Nachweis wirklich entfernen?')) {
    loescheTrainerDokumentUndDatei(dateiId, trainerId)
      .catch(err => alert('Entfernen fehlgeschlagen: ' + err.message));
  }
}
