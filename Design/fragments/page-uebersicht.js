// Design/fragments/page-uebersicht.js

function uebersichtTerminSpalte(termin) {
  const a = terminAuslastung(termin.id);
  const istVoll = a.belegt >= a.kapazitaet;
  let badge;
  if (istVoll) {
    badge = '<span class="badge badge-indigo">Ausgebucht</span>';
  } else if (a.unterbesetzt) {
    badge = `<span class="badge badge-unterbesetzt">Unterbesetzt (${a.belegt} von mind. ${a.minTeilnehmer})</span>`;
  } else {
    badge = `<span class="badge badge-green">${a.frei} Plätze frei</span>`;
  }
  return `
    <div class="termin-col">
      <div class="termin-col-label">${formatiereDatum(termin.datum)}</div>
      <div class="progress-track"><div class="progress-fill ${istVoll ? 'full' : ''}" style="width:${a.prozent}%"></div></div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; gap:8px;">
        <span style="font-size:12px; color:var(--muted);">${a.belegt} von ${a.kapazitaet} belegt</span>
        ${badge}
      </div>
    </div>`;
}

function uebersichtTeilnehmerListe(termin) {
  // Abgesagte Buchungen zaehlen nicht zur Auslastung und haben hier keine
  // Statusspalte - sie wuerden als normaler Name erscheinen und taeuschen.
  const buchungen = buchungenFuerTermin(termin.id).filter(b => b.anmeldestatus !== 'abgesagt');
  if (buchungen.length === 0) {
    return '<p class="empty-hint">Noch keine Teilnehmer zugeordnet.</p>';
  }
  const zeilen = buchungen.map(b => {
    const t = window.STATE.teilnehmer.find(p => p.id === b.teilnehmerId);
    return `<li>${t ? escHtml(t.name) : '(unbekannt)'} <span style="color:var(--muted2);">· ${t ? escHtml(t.firma) : ''}</span></li>`;
  }).join('');
  return `<ul style="margin:0; padding-left:18px; font-size:12.5px; color:var(--text);">${zeilen}</ul>`;
}

function renderUebersicht() {
  const container = document.getElementById('uebersicht-kursliste');
  if (!container) return;
  const naechsteContainer = document.getElementById('uebersicht-naechste-termine');

  // Nach „Alle Daten leeren" waere die Startseite sonst vollstaendig leer -
  // ausgerechnet auf dem Weg, der bewusst bei null anfaengt.
  if (window.STATE.kurse.length === 0) {
    container.innerHTML = '<div class="leer-hinweis">Noch keine Kurse angelegt. Lege unter „Schulungen“ deinen ersten Kurs an.</div>';
    naechsteContainer.innerHTML = '<div class="leer-hinweis">Sobald Termine angelegt sind, stehen die nächsten hier.</div>';
    return;
  }

  container.innerHTML = window.STATE.kurse.map(kurs => {
    const termine = naechsteZweiTermine(kurs.id);
    const spalten = termine.map(uebersichtTerminSpalte).join('');
    const teilnehmerBloecke = termine.map(t => `
      <div>
        <div class="termin-col-label">${formatiereDatum(t.datum)}</div>
        ${uebersichtTeilnehmerListe(t)}
      </div>`).join('');
    return `
      <div style="border-bottom:1px solid var(--line); padding:14px 0;">
        <div class="expand-row" onclick="uebersichtToggle('${kurs.id}')">
          <span class="expand-toggle" id="toggle-${kurs.id}">▸</span>
          <strong style="font-family:var(--font-display); font-size:14px; color:var(--ink);">${escHtml(kurs.titel)}</strong>
          <span style="color:var(--muted); font-size:12px; margin-left:8px;">${escHtml(kurs.kategorie)}</span>
        </div>
        <div class="termin-pair" style="margin-top:10px;">${spalten}</div>
        <div class="expand-content" id="expand-${kurs.id}" style="margin-top:10px;">
          <div class="termin-pair">${teilnehmerBloecke}</div>
        </div>
      </div>`;
  }).join('');

  const heute = new Date().toISOString().slice(0, 10);
  const alleTermineMitKurs = window.STATE.kurse.flatMap(kurs =>
    kurs.termine.map(termin => ({ kurs, termin }))
  ).filter(({ termin }) =>
    (termin.status === 'laufend' || termin.datum >= heute) && termin.status !== 'abgeschlossen'
  )
   .sort((a, b) => a.termin.datum.localeCompare(b.termin.datum))
   .slice(0, 6);

  naechsteContainer.innerHTML = alleTermineMitKurs.map(({ kurs, termin }) => {
    let chip;
    if (termin.status === 'laufend') {
      chip = '<span class="badge badge-green">Läuft</span>';
    } else {
      const tage = Math.round((new Date(termin.datum) - new Date(heute)) / 86400000);
      chip = `<span class="badge badge-gray">${tage === 0 ? 'Heute' : 'in ' + tage + ' Tagen'}</span>`;
    }
    return `
      <div class="list-row">
        <div>
          <div style="font-weight:600; color:var(--ink); font-size:13px;">${escHtml(kurs.titel)}</div>
          <div style="font-size:12px; color:var(--muted);">${escHtml(trainerName(termin.trainerId) || 'Kein Trainer')} · ${formatiereDatum(termin.datum)}</div>
        </div>
        ${chip}
      </div>`;
  }).join('');
}

function uebersichtToggle(kursId) {
  document.getElementById(`expand-${kursId}`).classList.toggle('open');
  document.getElementById(`toggle-${kursId}`).classList.toggle('open');
}
