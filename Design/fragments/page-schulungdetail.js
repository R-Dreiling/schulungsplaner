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

// Fuehrt eine Aenderung aus und zeigt eine Fehlermeldung an, statt sie nur in
// der Konsole zu hinterlassen. Seit dem Schreibschutz werfen die Mutatoren bei
// einem abgeschlossenen Termin - die Nutzerin soll erfahren, warum nichts
// passiert ist, statt vor einer scheinbar toten Schaltflaeche zu sitzen.
function detailVersuche(aktion) {
  try {
    aktion();
  } catch (e) {
    alert(e.message);
  }
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

    ${detailAbschlussBanner(termin)}

    <div class="card" style="padding:20px 24px; margin-bottom:20px;">
      <div style="display:flex; align-items:flex-start; justify-content:space-between;">
        <div>
          <div style="display:flex; gap:8px; margin-bottom:10px;">
            <span class="badge badge-gray">${escHtml(kurs.kategorie)}</span>
            ${statusBadgeHtml(termin.status)}
          </div>
          <h2 style="font-size:20px; margin:0 0 8px 0;">${escHtml(kurs.titel)}</h2>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn" onclick="oeffneTerminBearbeitenDialog('${termin.id}')">Bearbeiten</button>
          ${istTerminAbgeschlossen(termin.id) ? '' : `<button class="btn" onclick="detailOeffneAbschlussDialog('${escJsArg(termin.id)}')">Schulung abschließen</button>`}
          <button class="btn btn-primary" onclick="detailOeffneTeilnehmerHinzufuegenDialog('${termin.id}')">+ Teilnehmer</button>
        </div>
      </div>
      <div style="display:flex; gap:32px; font-size:13px; margin:14px 0;">
        <div><div class="mat-group-label" style="margin:0 0 3px 0;">Datum</div><div style="color:var(--ink); font-weight:600;">${formatiereDatum(termin.datum)}</div></div>
        <div><div class="mat-group-label" style="margin:0 0 3px 0;">Trainer</div><div style="color:var(--ink); font-weight:600;">${
          termin.trainerId
            ? escHtml(trainerName(termin.trainerId))
            : '<span style="color:var(--status-red-fg);">Kein Trainer zugeordnet</span>'
        }${
          termin.vertretungTrainerId
            ? `<div style="font-size:11.5px; font-weight:400; color:var(--muted);">Vertretung: ${escHtml(trainerName(termin.vertretungTrainerId))}</div>`
            : ''
        }</div></div>
        <div><div class="mat-group-label" style="margin:0 0 3px 0;">Format</div><div style="color:var(--ink); font-weight:600;">${escHtml(kurs.format)} · ${escHtml(termin.ort)}</div></div>
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
        <a id="nav-anwesenheit" onclick="detailScrollZu('anwesenheit')">Anwesenheit</a>
        <a id="nav-teilnehmer" onclick="detailScrollZu('teilnehmer')">Teilnehmer</a>
      </div>
      <div class="detail-main">
        ${detailAbschnittBeschreibung(kurs)}
        ${detailAbschnittAgenda(kurs)}
        ${detailAbschnittMaterialien(kurs)}
        ${detailAbschnittCheckliste(termin)}
        ${detailAbschnittAnwesenheit(termin)}
        ${detailAbschnittTeilnehmer(kurs, termin)}
      </div>
    </div>`;
}

// Beschreibung, Agenda und Materialien haengen am Kurs, nicht am Termin -
// eine Aenderung wirkt sich auf alle Termine des Kurses aus. Ohne Hinweis ist
// das bei mehreren Terminen nicht erkennbar.
function detailKursweitHinweis(kurs) {
  const anzahl = kurs.termine.length;
  const text = anzahl === 1
    ? 'Gilt für alle Termine dieses Kurses'
    : `Gilt für alle ${anzahl} Termine dieses Kurses`;
  return `<div style="font-size:11px; color:var(--muted2); margin:-8px 0 12px 0;">${text}</div>`;
}

function detailAbschnittBeschreibung(kurs) {
  return `
    <div class="card" id="abschnitt-beschreibung">
      <div class="section-title">Beschreibung &amp; Lernziele
        <button class="btn" onclick="detailOeffneBeschreibungBearbeitenDialog('${kurs.id}')">Bearbeiten</button>
      </div>
      ${detailKursweitHinweis(kurs)}
      <p class="desc-text" style="font-size:13px; line-height:1.55;">${kurs.beschreibung ? escHtml(kurs.beschreibung) : '<em>Noch keine Beschreibung.</em>'}</p>
      <ul class="goal-list">${(kurs.lernziele || []).map(z => `<li>${escHtml(z)}</li>`).join('') || '<li style="color:var(--muted2);">Noch keine Lernziele.</li>'}</ul>
      <div class="pill-row">
        <span class="pill">Format: ${escHtml(kurs.format)}</span>
        <span class="pill">${kurs.minTeilnehmer}–${kurs.maxTeilnehmer} Teilnehmer</span>
        <span class="pill">Umfang: ${kurs.zertifikat && kurs.zertifikat.umfangUE ? kurs.zertifikat.umfangUE : '—'} UE</span>
        <span class="pill">Voraussetzung: ${escHtml(kurs.voraussetzungen || '—')}</span>
      </div>
    </div>`;
}

function detailOeffneBeschreibungBearbeitenDialog(kursId) {
  const kurs = findeKurs(kursId);
  oeffneDialog(`
    <div class="dialog-head"><h3>Beschreibung &amp; Lernziele bearbeiten</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form onsubmit="return detailSpeichereBeschreibung(event, '${kursId}')">
      <div class="dialog-body">
        <div class="field"><label>Beschreibung</label><textarea name="beschreibung" rows="3">${escHtml(kurs.beschreibung)}</textarea></div>
        <div class="field"><label>Lernziele (ein Punkt pro Zeile)</label><textarea name="lernzieleText" rows="4">${escHtml((kurs.lernziele || []).join('\n'))}</textarea></div>
        <div class="field"><label>Voraussetzungen</label><input name="voraussetzungen" value="${escAttr(kurs.voraussetzungen)}" /></div>
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
    beschreibung: felder.beschreibung,
    voraussetzungen: felder.voraussetzungen,
    lernziele,
  });
  schliesseDialog();
  return false;
}

function detailAbschnittAgenda(kurs) {
  const punkte = kurs.agenda.map((p, i) => `
    <div class="agenda-item">
      <div class="agenda-time">${escHtml(p.zeit)}</div>
      <div style="flex:1;">
        <div class="agenda-title">${escHtml(p.titel)}</div>
        <div class="agenda-desc">${escHtml(p.beschreibung)}</div>
      </div>
      <button class="btn-link" style="color:var(--status-red-fg);" onclick="detailAgendaEntfernen('${kurs.id}', ${i})">Entfernen</button>
    </div>`).join('') || '<p class="empty-hint">Noch keine Agenda-Punkte.</p>';
  return `
    <div class="card" id="abschnitt-agenda">
      <div class="section-title">Agenda <small>${kurs.agenda.length} Programmpunkte</small>
        <button class="btn" onclick="detailOeffneAgendaDialog('${kurs.id}')">+ Programmpunkt</button>
      </div>
      ${detailKursweitHinweis(kurs)}
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
        <div class="mat-name">${escHtml(d.name)}</div>
        <div class="mat-sub">${detailFormatiereGroesse(d.groesse)}</div>
      </div>
      <div class="mat-actions">
        <button class="btn" onclick="herunterladeDatei('${d.id}', '${escJsArg(d.name)}')">↓</button>
        <button class="btn btn-ghost-red" onclick="detailMaterialEntfernen('${kurs.id}', '${bereich}', '${d.id}')">Entfernen</button>
      </div>
    </div>`).join('');
}

function detailAbschnittMaterialien(kurs) {
  return `
    <div class="card" id="abschnitt-materialien">
      <div class="section-title">Materialien</div>
      ${detailKursweitHinweis(kurs)}
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
  speichereDatei(datei, { kursId, bereich })
    .then(() => { ev.target.value = ''; })
    .catch(err => alert('Datei-Upload fehlgeschlagen: ' + err.message));
}

function detailMaterialEntfernen(kursId, bereich, dateiId) {
  if (confirm('Diese Datei wirklich entfernen?')) {
    loescheDateiUndReferenz(dateiId, kursId, bereich);
  }
}

function detailAbschnittCheckliste(termin) {
  const zeilen = termin.checkliste.map((p, i) => `
    <div class="check-row ${p.erledigt ? 'done' : ''}">
      <button class="check-box ${p.erledigt ? 'done' : ''}" onclick="detailVersuche(() => checklistePunktToggeln('${escJsArg(termin.id)}', ${i}))">${p.erledigt ? '✓' : ''}</button>
      <span class="lbl" style="flex:1;">${escHtml(p.label)}</span>
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
    detailVersuche(() => checklistePunktHinzufuegen(terminId, label.trim()));
  }
}

function detailChecklisteEntfernen(terminId, index) {
  if (confirm('Diesen Checklistenpunkt entfernen?')) {
    detailVersuche(() => checklistePunktEntfernen(terminId, index));
  }
}

// ---- Phase 2: Anwesenheit ----

function detailAnwesenheitZeile(termin, buchung, gesperrt) {
  const teilnehmer = window.STATE.teilnehmer.find(t => t.id === buchung.teilnehmerId);
  const erfasst = buchung.anwesenheitProzent !== null && buchung.anwesenheitProzent !== undefined;
  const unter = erfasst && !erfuelltMindestteilnahme(buchung);
  const gruende = ['krank', 'entschuldigt', 'unentschuldigt'];
  const grundOptionen = ['<option value="">— kein Grund —</option>']
    .concat(gruende.map(g =>
      `<option value="${g}" ${buchung.fehlgrund === g ? 'selected' : ''}>${g}</option>`))
    .join('');

  return `
    <div class="anw-row ${unter ? 'unter-mindest' : ''}">
      <div class="anw-name">
        <strong>${escHtml(teilnehmer ? teilnehmer.name : '(unbekannt)')}</strong>
        <div class="anw-firma">${escHtml(teilnehmer ? teilnehmer.firma : '')}</div>
      </div>
      <div class="anw-prozent">
        <input type="number" min="0" max="100" step="1"
               value="${erfasst ? buchung.anwesenheitProzent : ''}"
               placeholder="%" ${gesperrt ? 'disabled' : ''}
               onchange="detailAnwesenheitProzent('${escJsArg(buchung.id)}', this.value)" />
      </div>
      <div class="anw-grund">
        <select ${gesperrt || !erfasst || buchung.anwesenheitProzent === 100 ? 'disabled' : ''}
                onchange="detailAnwesenheitGrund('${escJsArg(buchung.id)}', this.value)">
          ${grundOptionen}
        </select>
      </div>
      <div class="anw-aktion">
        ${(() => {
          if (!erfasst) {
            return '<button class="btn" disabled title="Anwesenheit noch nicht erfasst">Bescheinigung</button>';
          }
          if (unter) {
            return `<button class="btn" disabled title="unter Mindestteilnahme von ${MINDEST_ANWESENHEIT} %">Bescheinigung</button>`;
          }
          return `<button class="btn" onclick="druckeZertifikat('${escJsArg(buchung.id)}')">Bescheinigung</button>`;
        })()}
      </div>`;
}

function detailAbschnittAnwesenheit(termin) {
  // Nicht !!termin.abschluss verwenden: nach dem Wiederoeffnen bleibt das
  // abschluss-Objekt als Historie erhalten, der Termin ist aber wieder offen.
  const gesperrt = istTerminAbgeschlossen(termin.id);
  const buchungen = anwesenheitsBuchungen(termin.id);
  const s = anwesenheitStatistik(termin.id);

  if (buchungen.length === 0) {
    return `
      <div class="card" id="abschnitt-anwesenheit">
        <div class="section-title">Anwesenheit</div>
        <p class="empty-hint">Noch keine Teilnehmer gebucht — es gibt nichts zu erfassen.</p>
      </div>`;
  }

  const zusammenfassung = s.erfasst === 0
    ? 'noch nichts erfasst'
    : `${s.erfuellt} von ${s.gesamt} erfüllen die Mindestteilnahme`
      + (s.erfasst < s.gesamt ? ` · ${s.gesamt - s.erfasst} offen` : '')
      + (s.durchschnitt !== null ? ` · Ø ${s.durchschnitt} %` : '');

  return `
    <div class="card" id="abschnitt-anwesenheit">
      <div class="section-title">Anwesenheit <small>${escHtml(zusammenfassung)}</small>
        ${gesperrt ? '' : `<button class="btn" onclick="detailAlleAnwesend('${escJsArg(termin.id)}')">Alle auf 100 %</button>`}
      </div>
      <p class="field-hint" style="margin:-4px 0 10px 0;">
        Ab ${MINDEST_ANWESENHEIT} % Anwesenheit wird eine Teilnahmebescheinigung ausgestellt.
        Sie wird bewusst einzeln erzeugt, damit beim Versand keine Daten anderer Teilnehmer mitgehen.
      </p>
      ${buchungen.map(b => detailAnwesenheitZeile(termin, b, gesperrt)).join('')}
    </div>`;
}

function detailAnwesenheitProzent(buchungId, wert) {
  if (wert === '') return;
  try {
    const buchung = window.STATE.buchungen.find(b => b.id === buchungId);
    anwesenheitSetzen(buchungId, wert, buchung ? buchung.fehlgrund : null);
  } catch (e) {
    alert(e.message);
    renderAll();
  }
}

function detailAnwesenheitGrund(buchungId, wert) {
  try {
    const buchung = window.STATE.buchungen.find(b => b.id === buchungId);
    if (!buchung) return;
    anwesenheitSetzen(buchungId, buchung.anwesenheitProzent, wert || null);
  } catch (e) {
    alert(e.message);
    renderAll();
  }
}

function detailAlleAnwesend(terminId) {
  try {
    const anzahl = alleAnwesenheitAufVoll(terminId);
    if (anzahl === 0) alert('Keine Teilnehmer vorhanden.');
  } catch (e) {
    alert(e.message);
  }
}

function detailAbschnittTeilnehmer(kurs, termin) {
  const buchungen = buchungenFuerTermin(termin.id);
  // Abgesagte bleiben als Zeile sichtbar (sie muessen verwaltbar sein), zaehlen
  // aber nicht mit - so passt die Kopfzahl zur Kapazitaetsanzeige oben.
  const aktivAnzahl = buchungen.filter(b => b.anmeldestatus !== 'abgesagt').length;
  const mehrereTermine = kurs.termine.length > 1;
  const zeilen = buchungen.map(b => {
    const t = window.STATE.teilnehmer.find(p => p.id === b.teilnehmerId);
    return `
      <tr>
        <td class="cell-strong">${t ? escHtml(t.name) : '(unbekannt)'}</td>
        <td>${t ? escHtml(t.firma) : ''}</td>
        <td>${t ? escHtml(t.email) : ''}</td>
        <td>
          <select onchange="aktualisiereBuchungStatus('${b.id}', this.value)">
            <option value="angemeldet" ${b.anmeldestatus === 'angemeldet' ? 'selected' : ''}>angemeldet</option>
            <option value="bestätigt" ${b.anmeldestatus === 'bestätigt' ? 'selected' : ''}>bestätigt</option>
            <option value="abgesagt" ${b.anmeldestatus === 'abgesagt' ? 'selected' : ''}>abgesagt</option>
          </select>
        </td>
        <td style="text-align:right; white-space:nowrap;">
          ${mehrereTermine ? `<button class="btn" onclick="detailOeffneVerschiebenDialog('${b.id}')">Verschieben</button>` : ''}
          <button class="btn btn-ghost-red" onclick="detailBuchungEntfernen('${b.id}')">Entfernen</button>
        </td>
      </tr>`;
  }).join('') || '<tr><td colspan="5" class="empty-hint">Noch keine Teilnehmer.</td></tr>';
  return `
    <div class="card" id="abschnitt-teilnehmer">
      <div class="section-title">Teilnehmer dieses Termins <small>${aktivAnzahl} aktiv von ${buchungen.length}</small></div>
      <table class="data-table fixed-rows">
        <thead><tr><th>Name</th><th>Firma</th><th>E-Mail</th><th>Anmeldestatus</th><th></th></tr></thead>
        <tbody>${zeilen}</tbody>
      </table>
    </div>`;
}

// Verschiebt eine Buchung auf einen anderen Termin DESSELBEN Kurses - der
// eigentliche Zweck der Zwei-Termine-Ansicht (unterbelegten Termin auffuellen).
function detailOeffneVerschiebenDialog(buchungId) {
  const buchung = window.STATE.buchungen.find(b => b.id === buchungId);
  if (!buchung) return;
  const { kurs, termin } = findeTerminMitKurs(buchung.terminId);
  const teilnehmer = window.STATE.teilnehmer.find(p => p.id === buchung.teilnehmerId);
  const andere = kurs.termine.filter(t => t.id !== termin.id);
  const optionen = andere.map(t => {
    const a = terminAuslastung(t.id);
    return `<option value="${escAttr(t.id)}">${formatiereDatum(t.datum)} · ${escHtml(trainerName(t.trainerId) || 'Kein Trainer')} — ${a.belegt}/${a.kapazitaet} belegt</option>`;
  }).join('');
  const koerper = andere.length === 0
    ? '<p class="empty-hint">Dieser Kurs hat keine weiteren Termine.</p>'
    : `<div class="field"><label>Neuer Termin</label><select name="neuerTerminId" required>${optionen}</select></div>`;
  oeffneDialog(`
    <div class="dialog-head"><h3>Teilnehmer verschieben</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form onsubmit="return detailSpeichereVerschieben(event, '${buchungId}')">
      <div class="dialog-body">
        <div style="font-size:12.5px; color:var(--muted);">
          <strong style="color:var(--ink);">${teilnehmer ? escHtml(teilnehmer.name) : '(unbekannt)'}</strong>
          von ${formatiereDatum(termin.datum)} auf einen anderen Termin von „${escHtml(kurs.titel)}" verschieben.
          Buchungsdatum und Anmeldestatus bleiben erhalten.
        </div>
        ${koerper}
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        ${andere.length === 0 ? '' : '<button type="submit" class="btn btn-primary">Verschieben</button>'}
      </div>
    </form>`);
}

function detailSpeichereVerschieben(ev, buchungId) {
  ev.preventDefault();
  const felder = formularWerte(ev.target);
  detailVersuche(() => verschiebeBuchung(buchungId, felder.neuerTerminId));
  schliesseDialog();
  return false;
}

function detailBuchungEntfernen(buchungId) {
  if (confirm('Diese Buchung wirklich entfernen?')) {
    detailVersuche(() => loescheBuchung(buchungId));
  }
}

// ---- Phase 2: Schulungsabschluss ----

// Das Banner erscheint, sobald der Termin jemals foermlich abgeschlossen
// wurde - auch nach dem Wiederoeffnen, denn die Abschlusshistorie soll
// sichtbar bleiben. Ob aktuell schreibgeschuetzt wird, ist eine andere
// Frage und haengt an istTerminAbgeschlossen().
function detailAbschlussBanner(termin) {
  if (!termin.abschluss) return '';
  const a = termin.abschluss;
  const wieder = (a.wiedereroeffnungen || []).length;
  const gesperrt = istTerminAbgeschlossen(termin.id);
  return `
    <div class="abschluss-banner">
      <div>
        <strong>${gesperrt ? 'Abgeschlossen' : 'Wieder geöffnet · abgeschlossen war'} am ${formatiereDatum(a.abgeschlossenAm)}</strong>
        <div class="abschluss-hinweis">
          ${gesperrt
            ? 'Anwesenheit, Teilnehmerliste und Checkliste sind schreibgeschützt. Bescheinigungen und Abschlussbericht bleiben druckbar.'
            : 'Der Schreibschutz ist derzeit aufgehoben. Nach den Korrekturen bitte erneut abschließen.'}
          ${wieder > 0 ? `<br/>Nachträglich geöffnet: ${wieder}× (zuletzt ${formatiereDatum(a.wiedereroeffnungen[wieder - 1])})` : ''}
        </div>
        ${a.vorkommnisse ? `<div class="abschluss-hinweis">Vorkommnisse: ${escHtml(a.vorkommnisse)}</div>` : ''}
      </div>
      <button class="btn" onclick="detailWiedereroeffnen('${escJsArg(termin.id)}')">Wieder öffnen</button>
    </div>`;
}

function detailOeffneAbschlussDialog(terminId) {
  const v = abschlussVollstaendigkeit(terminId);
  const hinweise = [];
  if (v.anwesenheitFehlt > 0) hinweise.push(`Bei ${v.anwesenheitFehlt} Teilnehmer(n) ist die Anwesenheit noch nicht erfasst.`);
  if (v.checklisteOffen > 0) hinweise.push(`${v.checklisteOffen} Checklistenpunkt(e) sind noch offen.`);
  if (v.keinTrainer) hinweise.push('Diesem Termin ist kein Trainer zugeordnet.');

  const hinweisHtml = hinweise.length
    ? `<div class="field-hint" style="color:var(--status-amber-fg); font-size:12px;">
         <strong>Noch offen:</strong><ul style="margin:6px 0 0 0; padding-left:18px;">
           ${hinweise.map(h => `<li>${escHtml(h)}</li>`).join('')}
         </ul>
         <div style="margin-top:6px;">Du kannst trotzdem abschließen — die Punkte werden nur nachrichtlich angezeigt.</div>
       </div>`
    : '<div class="field-hint" style="color:var(--status-green-fg); font-size:12px;">Alles vollständig erfasst.</div>';

  oeffneDialog(`
    <div class="dialog-head"><h3>Schulung abschließen</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <form onsubmit="return detailSpeichereAbschluss(event, '${escJsArg(terminId)}')">
      <div class="dialog-body">
        ${hinweisHtml}
        <div class="field">
          <label>Besondere Vorkommnisse (optional)</label>
          <textarea name="vorkommnisse" rows="3" placeholder="z. B. Teilnehmer Müller musste wegen Notfall früher gehen"></textarea>
        </div>
        <div class="field-hint">
          Nach dem Abschluss sind Anwesenheit, Teilnehmerliste und Checkliste dieses Termins
          schreibgeschützt. Ein späteres Wiederöffnen ist möglich, wird aber protokolliert
          und im Abschlussbericht ausgewiesen.
        </div>
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn" onclick="schliesseDialog()">Abbrechen</button>
        <button type="submit" class="btn btn-primary">Jetzt abschließen</button>
      </div>
    </form>`);
}

function detailSpeichereAbschluss(ev, terminId) {
  ev.preventDefault();
  const felder = formularWerte(ev.target);
  try {
    terminAbschliessen(terminId, felder.vorkommnisse);
    schliesseDialog();
  } catch (e) {
    alert(e.message);
  }
  return false;
}

function detailWiedereroeffnen(terminId) {
  if (!confirm(
    'Diesen abgeschlossenen Termin wieder öffnen?\n\n'
    + 'Der Schreibschutz wird aufgehoben. Die Wiederöffnung wird mit Datum '
    + 'festgehalten und im Abschlussbericht ausgewiesen.'
  )) return;
  try {
    terminWiedereroeffnen(terminId);
  } catch (e) {
    alert(e.message);
  }
}

function detailOeffneTeilnehmerHinzufuegenDialog(terminId) {
  const optionen = window.STATE.teilnehmer
    .map(t => `<option value="${escAttr(t.id)}">${escHtml(t.name)} — ${escHtml(t.firma)}</option>`).join('');
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
          <div class="field"><label>Name</label><input name="name" required /></div>
          <div class="field"><label>Firma</label><input name="firma" required /></div>
          <div class="field"><label>E-Mail</label><input type="email" name="email" required /></div>
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
  const felder = document.getElementById('detail-neue-person-felder');
  const sichtbar = wert === '__neu__';
  // '' statt 'flex': der Wrapper hat keine flex-direction, mit 'flex' stuenden
  // Name/Firma/E-Mail nebeneinander statt untereinander.
  felder.style.display = sichtbar ? '' : 'none';
  // required nur solange die Felder sichtbar sind - ein required-Feld in einem
  // display:none-Container blockiert das Absenden ("not focusable").
  felder.querySelectorAll('input').forEach(i => { i.required = sichtbar; });
}

function detailSpeichereTeilnehmerHinzufuegen(ev, terminId) {
  ev.preventDefault();
  const felder = formularWerte(ev.target);
  const a = terminAuslastung(terminId);
  if (a.frei <= 0 && !confirm(`Dieser Termin hat keine freien Plätze mehr (${a.belegt} von ${a.kapazitaet} belegt). Trotzdem buchen?`)) {
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
  detailVersuche(() => erstelleBuchung({
    teilnehmerId,
    terminId,
    anmeldestatus: felder.anmeldestatus,
    statusManuell: felder.anmeldestatus !== 'angemeldet',
  }));
  schliesseDialog();
  return false;
}
