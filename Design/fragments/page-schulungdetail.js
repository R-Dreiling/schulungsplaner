// Design/fragments/page-schulungdetail.js

function detailFormatiereGroesse(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function detailDateiIcon(typ) {
  if (typ.includes('pdf')) return '📄';
  if (typ.includes('presentation') || typ.includes('powerpoint')) return '📊';
  if (typ.includes('sheet') || typ.includes('excel')) return '📈';
  return '📁';
}

function detailScrollZu(anker) {
  document.getElementById(`abschnitt-${anker}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.querySelectorAll('.detail-nav a').forEach(a => a.classList.remove('active'));
  document.getElementById(`nav-${anker}`)?.classList.add('active');
}

function renderSchulungdetail(terminId) {
  const container = document.getElementById('schulungdetail-inhalt');
  if (!container) return;
  const gefunden = terminId ? findeTerminMitKurs(terminId) : undefined;
  if (!gefunden) {
    container.innerHTML = '<p class="empty-hint">Wähle links unter „Schulungen" einen Termin aus, um Details zu sehen.</p>';
    return;
  }
  const { kurs, termin } = gefunden;
  const a = terminAuslastung(termin.id);

  container.innerHTML = `
    <button class="crumb" onclick="showPage('schulungen')">← Zurück zu Schulungen</button>

    <div class="card" style="padding:20px 24px; margin-bottom:20px;">
      <div style="display:flex; align-items:flex-start; justify-content:space-between;">
        <div>
          <div style="display:flex; gap:8px; margin-bottom:10px;">
            <span class="badge badge-indigo">${kurs.kategorie}</span>
            ${statusBadgeHtml(termin.status)}
          </div>
          <h2 style="font-size:20px; margin:0 0 8px 0;">${kurs.titel}</h2>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn" onclick="oeffneTerminBearbeitenDialog('${termin.id}')">Bearbeiten</button>
          <button class="btn btn-primary" onclick="detailOeffneTeilnehmerHinzufuegenDialog('${termin.id}')">+ Teilnehmer</button>
        </div>
      </div>
      <div style="display:flex; gap:32px; font-size:13px; margin:14px 0;">
        <div><div class="mat-group-label" style="margin:0 0 3px 0;">Datum</div><div style="color:var(--ink); font-weight:600;">${formatiereDatum(termin.datum)}</div></div>
        <div><div class="mat-group-label" style="margin:0 0 3px 0;">Trainer</div><div style="color:var(--ink); font-weight:600;">${termin.trainer}</div></div>
        <div><div class="mat-group-label" style="margin:0 0 3px 0;">Format</div><div style="color:var(--ink); font-weight:600;">${termin.format} · ${termin.ort}</div></div>
        <div><div class="mat-group-label" style="margin:0 0 3px 0;">Kapazität</div><div style="color:var(--ink); font-weight:600;">${a.belegt} von ${a.kapazitaet} belegt</div></div>
      </div>
      <div class="progress-track"><div class="progress-fill ${a.belegt >= a.kapazitaet ? 'full' : ''}" style="width:${a.prozent}%"></div></div>
    </div>

    <div class="detail-layout">
      <div class="detail-nav">
        <a id="nav-beschreibung" class="active" onclick="detailScrollZu('beschreibung')">Beschreibung</a>
        <a id="nav-agenda" onclick="detailScrollZu('agenda')">Agenda</a>
        <a id="nav-materialien" onclick="detailScrollZu('materialien')">Materialien</a>
        <a id="nav-checkliste" onclick="detailScrollZu('checkliste')">Checkliste</a>
        <a id="nav-teilnehmer" onclick="detailScrollZu('teilnehmer')">Teilnehmer</a>
      </div>
      <div class="detail-main">
        ${detailAbschnittBeschreibung(kurs)}
        ${detailAbschnittAgenda(kurs)}
        ${detailAbschnittMaterialien(kurs)}
        ${detailAbschnittCheckliste(termin)}
        ${detailAbschnittTeilnehmer(termin)}
      </div>
    </div>`;
}

function detailAbschnittBeschreibung(kurs) {
  return `
    <div class="card" id="abschnitt-beschreibung">
      <div class="section-title">Beschreibung &amp; Lernziele
        <button class="btn" onclick="detailOeffneBeschreibungBearbeitenDialog('${kurs.id}')">Bearbeiten</button>
      </div>
      <p class="desc-text" style="font-size:13px; line-height:1.55;">${kurs.beschreibung || '<em>Noch keine Beschreibung.</em>'}</p>
      <ul class="goal-list">${(kurs.lernziele || []).map(z => `<li>${z}</li>`).join('') || '<li style="color:var(--muted2);">Noch keine Lernziele.</li>'}</ul>
      <div class="pill-row">
        <span class="pill">Zielgruppe: ${kurs.zielgruppe || '—'}</span>
        <span class="pill">Voraussetzung: ${kurs.voraussetzungen || '—'}</span>
      </div>
    </div>`;
}

function detailOeffneBeschreibungBearbeitenDialog(kursId) {
  const kurs = findeKurs(kursId);
  oeffneDialog(`
    <div class="dialog-head"><h3>Beschreibung &amp; Lernziele bearbeiten</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form onsubmit="return detailSpeichereBeschreibung(event, '${kursId}')">
      <div class="dialog-body">
        <div class="field"><label>Beschreibung</label><textarea name="beschreibung" rows="3">${kurs.beschreibung}</textarea></div>
        <div class="field"><label>Lernziele (ein Punkt pro Zeile)</label><textarea name="lernzieleText" rows="4">${(kurs.lernziele || []).join('\n')}</textarea></div>
        <div class="field-row2">
          <div class="field"><label>Zielgruppe</label><input name="zielgruppe" value="${kurs.zielgruppe}" /></div>
          <div class="field"><label>Voraussetzungen</label><input name="voraussetzungen" value="${kurs.voraussetzungen}" /></div>
        </div>
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Speichern</button>
      </div>
    </form>`);
}

function detailSpeichereBeschreibung(ev, kursId) {
  ev.preventDefault();
  const felder = formularWerte(ev.target);
  const lernziele = felder.lernzieleText.split('\n').map(z => z.trim()).filter(Boolean);
  aktualisiereKurs(kursId, {
    beschreibung: felder.beschreibung, zielgruppe: felder.zielgruppe,
    voraussetzungen: felder.voraussetzungen, lernziele,
  });
  schliesseDialog();
  return false;
}

function detailAbschnittAgenda(kurs) {
  const punkte = kurs.agenda.map((p, i) => `
    <div class="agenda-item">
      <div class="agenda-time">${p.zeit}</div>
      <div style="flex:1;">
        <div class="agenda-title">${p.titel}</div>
        <div class="agenda-desc">${p.beschreibung}</div>
      </div>
      <button class="btn-link" style="color:var(--status-red-fg);" onclick="detailAgendaEntfernen('${kurs.id}', ${i})">Entfernen</button>
    </div>`).join('') || '<p class="empty-hint">Noch keine Agenda-Punkte.</p>';
  return `
    <div class="card" id="abschnitt-agenda">
      <div class="section-title">Agenda <small>${kurs.agenda.length} Programmpunkte</small>
        <button class="btn" onclick="detailOeffneAgendaDialog('${kurs.id}')">+ Programmpunkt</button>
      </div>
      ${punkte}
    </div>`;
}

function detailOeffneAgendaDialog(kursId) {
  oeffneDialog(`
    <div class="dialog-head"><h3>Programmpunkt hinzufügen</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form onsubmit="return detailSpeichereAgenda(event, '${kursId}')">
      <div class="dialog-body">
        <div class="field"><label>Zeit</label><input name="zeit" placeholder="09:00–10:30" required /></div>
        <div class="field"><label>Titel</label><input name="titel" required /></div>
        <div class="field"><label>Beschreibung</label><textarea name="beschreibung" rows="2"></textarea></div>
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Hinzufügen</button>
      </div>
    </form>`);
}

function detailSpeichereAgenda(ev, kursId) {
  ev.preventDefault();
  agendaPunktHinzufuegen(kursId, formularWerte(ev.target));
  schliesseDialog();
  return false;
}

function detailAgendaEntfernen(kursId, index) {
  if (confirm('Diesen Programmpunkt entfernen?')) {
    agendaPunktEntfernen(kursId, index);
  }
}

function detailMaterialListe(kurs, bereich) {
  const dateien = kurs.materialien[bereich];
  if (dateien.length === 0) return '<p class="empty-hint">Noch keine Dateien.</p>';
  return dateien.map(d => `
    <div class="mat-row">
      <div class="mat-icon">${detailDateiIcon(d.typ)}</div>
      <div>
        <div class="mat-name">${d.name}</div>
        <div class="mat-sub">${detailFormatiereGroesse(d.groesse)}</div>
      </div>
      <div class="mat-actions">
        <button class="btn" onclick="herunterladeDatei('${d.id}', '${d.name}')">↓</button>
        <button class="btn btn-ghost-red" onclick="detailMaterialEntfernen('${kurs.id}', '${bereich}', '${d.id}')">Entfernen</button>
      </div>
    </div>`).join('');
}

function detailAbschnittMaterialien(kurs) {
  return `
    <div class="card" id="abschnitt-materialien">
      <div class="section-title">Materialien</div>
      <div class="mat-group-label">Seminarunterlagen</div>
      ${detailMaterialListe(kurs, 'seminarunterlagen')}
      <div style="margin:10px 0 18px 0;">
        <input type="file" onchange="detailMaterialUpload(event, '${kurs.id}', 'seminarunterlagen')" />
      </div>
      <div class="mat-group-label">Vorlagen-Bibliothek <span style="text-transform:none; font-weight:400;">— Ressourcen für die Umsetzung</span></div>
      ${detailMaterialListe(kurs, 'vorlagen')}
      <div style="margin-top:10px;">
        <input type="file" onchange="detailMaterialUpload(event, '${kurs.id}', 'vorlagen')" />
      </div>
    </div>`;
}

function detailMaterialUpload(ev, kursId, bereich) {
  const datei = ev.target.files[0];
  if (!datei) return;
  speichereDatei(datei, { kursId, bereich }).then(() => { ev.target.value = ''; });
}

function detailMaterialEntfernen(kursId, bereich, dateiId) {
  if (confirm('Diese Datei wirklich entfernen?')) {
    loescheDateiUndReferenz(dateiId, kursId, bereich);
  }
}

function detailAbschnittCheckliste(termin) {
  const zeilen = termin.checkliste.map((p, i) => `
    <div class="check-row ${p.erledigt ? 'done' : ''}">
      <button class="check-box ${p.erledigt ? 'done' : ''}" onclick="checklistePunktToggeln('${termin.id}', ${i})">${p.erledigt ? '✓' : ''}</button>
      <span class="lbl" style="flex:1;">${p.label}</span>
      <button class="btn-link" style="color:var(--status-red-fg);" onclick="detailChecklisteEntfernen('${termin.id}', ${i})">Entfernen</button>
    </div>`).join('');
  const erledigtAnzahl = termin.checkliste.filter(p => p.erledigt).length;
  return `
    <div class="card" id="abschnitt-checkliste">
      <div class="section-title">Checkliste <small>${erledigtAnzahl}/${termin.checkliste.length}</small>
        <button class="btn" onclick="detailChecklisteHinzufuegen('${termin.id}')">+ Punkt</button>
      </div>
      ${zeilen}
    </div>`;
}

function detailChecklisteHinzufuegen(terminId) {
  const label = prompt('Neuer Checklistenpunkt:');
  if (label && label.trim()) {
    checklistePunktHinzufuegen(terminId, label.trim());
  }
}

function detailChecklisteEntfernen(terminId, index) {
  if (confirm('Diesen Checklistenpunkt entfernen?')) {
    checklistePunktEntfernen(terminId, index);
  }
}

function detailAbschnittTeilnehmer(termin) {
  const buchungen = buchungenFuerTermin(termin.id);
  const zeilen = buchungen.map(b => {
    const t = window.STATE.teilnehmer.find(p => p.id === b.teilnehmerId);
    return `
      <tr>
        <td class="cell-strong">${t ? t.name : '(unbekannt)'}</td>
        <td>${t ? t.firma : ''}</td>
        <td>${t ? t.email : ''}</td>
        <td>
          <select onchange="aktualisiereBuchungStatus('${b.id}', this.value)">
            <option value="angemeldet" ${b.anmeldestatus === 'angemeldet' ? 'selected' : ''}>angemeldet</option>
            <option value="bestätigt" ${b.anmeldestatus === 'bestätigt' ? 'selected' : ''}>bestätigt</option>
            <option value="abgesagt" ${b.anmeldestatus === 'abgesagt' ? 'selected' : ''}>abgesagt</option>
          </select>
        </td>
        <td><button class="btn btn-ghost-red" onclick="detailBuchungEntfernen('${b.id}')">Entfernen</button></td>
      </tr>`;
  }).join('') || '<tr><td colspan="5" class="empty-hint">Noch keine Teilnehmer.</td></tr>';
  return `
    <div class="card" id="abschnitt-teilnehmer">
      <div class="section-title">Teilnehmer dieses Termins <small>${buchungen.length}</small></div>
      <table class="data-table fixed-rows">
        <thead><tr><th>Name</th><th>Firma</th><th>E-Mail</th><th>Anmeldestatus</th><th></th></tr></thead>
        <tbody>${zeilen}</tbody>
      </table>
    </div>`;
}

function detailBuchungEntfernen(buchungId) {
  if (confirm('Diese Buchung wirklich entfernen?')) {
    loescheBuchung(buchungId);
  }
}

function detailOeffneTeilnehmerHinzufuegenDialog(terminId) {
  const optionen = window.STATE.teilnehmer
    .map(t => `<option value="${t.id}">${t.name} — ${t.firma}</option>`).join('');
  oeffneDialog(`
    <div class="dialog-head"><h3>Teilnehmer hinzufügen</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form onsubmit="return detailSpeichereTeilnehmerHinzufuegen(event, '${terminId}')">
      <div class="dialog-body">
        <div class="field">
          <label>Person</label>
          <select name="teilnehmerId" id="detail-teilnehmer-auswahl" onchange="detailToggleNeuePersonFelder(this.value)">
            <option value="__neu__">— Neue Person —</option>
            ${optionen}
          </select>
        </div>
        <div id="detail-neue-person-felder">
          <div class="field"><label>Name</label><input name="name" /></div>
          <div class="field"><label>Firma</label><input name="firma" /></div>
          <div class="field"><label>E-Mail</label><input type="email" name="email" /></div>
        </div>
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
        <button type="submit" class="btn btn-primary">Hinzufügen</button>
      </div>
    </form>`);
}

function detailToggleNeuePersonFelder(wert) {
  document.getElementById('detail-neue-person-felder').style.display = wert === '__neu__' ? 'flex' : 'none';
}

function detailSpeichereTeilnehmerHinzufuegen(ev, terminId) {
  ev.preventDefault();
  const felder = formularWerte(ev.target);
  let teilnehmerId = felder.teilnehmerId;
  if (teilnehmerId === '__neu__') {
    teilnehmerId = erstelleTeilnehmer({
      name: felder.name, firma: felder.firma, email: felder.email, bestandskunde: false,
    });
  }
  erstelleBuchung({ teilnehmerId, terminId, anmeldestatus: felder.anmeldestatus });
  schliesseDialog();
  return false;
}
