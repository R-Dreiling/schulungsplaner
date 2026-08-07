// Design/fragments/druck-vorlagen.js
// Baut Bescheinigung, Anwesenheitsliste und Abschlussbericht als HTML fuer den
// Druckbereich.

// Untergrund einer Druckseite: sehr helles Feld mit weichen Wellen, darauf das
// Logo als grosses, fast durchsichtiges Wasserzeichen. Beides sind echte
// Elemente im Dokument und keine CSS-Hintergruende - Hintergrundgrafiken lassen
// sich im Druckdialog abschalten, Bilder und Vektoren im Inhalt nicht.
// staerke: 'voll' fuer die Bescheinigung, 'dezent' fuer Arbeitsdokumente.
function druckUntergrund(staerke) {
  const voll = staerke === 'voll';
  const flaeche = voll ? '#F2F8FB' : '#FAFCFD';
  const welle = voll ? '#DCEDF3' : '#EDF4F7';
  const wasserzeichen = voll ? 0.05 : 0.03;
  // Die Wellen laufen ueber die volle Seite; preserveAspectRatio none streckt
  // sie auf jedes Seitenformat.
  const linien = Array.from({ length: 14 }, (_, i) => {
    const y = 40 + i * 62;
    return `<path d="M0 ${y} C 210 ${y - 26}, 380 ${y + 26}, 595 ${y - 12}" fill="none" stroke="${welle}" stroke-width="1.1"/>`;
  }).join('');
  return `
      <svg class="druck-grund" viewBox="0 0 595 842" preserveAspectRatio="none" aria-hidden="true">
        <rect x="0" y="0" width="595" height="842" fill="${flaeche}"/>
        ${linien}
        <path d="M0 792 C 150 812, 420 762, 595 786 L595 842 L0 842 Z" fill="#ffffff"/>
      </svg>
      <img class="druck-wasserzeichen" src="${window.LOGO_NORMAL}" alt="" style="opacity:${wasserzeichen}" />`;
}

// Absenderzeile am Fuss jeder Druckseite.
function druckFusszeile(zusatz) {
  return `
      <div class="druck-fusszeile">
        <div>${zusatz ? escHtml(zusatz) : ''}</div>
        <img class="druck-logo" src="${window.LOGO_NORMAL}" alt="tribeta" />
      </div>`;
}

function zertifikatPlatzhalterFuellen(vorlage, werte) {
  return String(vorlage)
    .replace(/\{teilnehmer\}/g, werte.teilnehmer)
    .replace(/\{kurs\}/g, werte.kurs)
    .replace(/\{umfang\}/g, werte.umfang)
    .replace(/\{datum\}/g, werte.datum)
    .replace(/\{ort\}/g, werte.ort)
    .replace(/\{trainer\}/g, werte.trainer);
}

function zertifikatHtml(buchungId) {
  const buchung = window.STATE.buchungen.find(b => b.id === buchungId);
  if (!buchung) throw new Error(`Buchung ${buchungId} nicht gefunden`);
  const teilnehmer = window.STATE.teilnehmer.find(t => t.id === buchung.teilnehmerId);
  const gefunden = findeTerminMitKurs(buchung.terminId);
  if (!teilnehmer || !gefunden) throw new Error('Teilnehmer oder Termin nicht gefunden.');
  const { kurs, termin } = gefunden;
  const z = kurs.zertifikat || {};

  // Erst hier vergeben: eine Nummer soll nur entstehen, wenn wirklich
  // gedruckt wird - nicht schon beim Anzeigen der Liste.
  const nummer = zertifikatNummerFuer(buchungId);

  // Die Platzhalter werden mit bereits escapetem Text gefuellt, damit ein
  // Kurstitel mit Sonderzeichen die Seite nicht zerlegt.
  // Reihenfolge ist wichtig: erst die frei eingegebene Vorlage escapen, dann
  // die ebenfalls escapten Werte einsetzen. Sonst wuerde ein "&" oder "<" im
  // Bestaetigungstext still als Markup interpretiert statt angezeigt. Die
  // geschweiften Klammern der Platzhalter ueberstehen escHtml unveraendert,
  // die Ersetzung greift also weiterhin.
  const text = zertifikatPlatzhalterFuellen(escHtml(z.bestaetigungstext || ''), {
    teilnehmer: escHtml(teilnehmer.name),
    kurs: escHtml(kurs.titel),
    umfang: escHtml(String(z.umfangUE || '')),
    datum: formatiereDatum(termin.datum),
    ort: escHtml(termin.ort || ''),
    trainer: escHtml(trainerName(termin.trainerId) || ''),
  });

  return `
    <div class="druck-seite">
      ${druckUntergrund('voll')}
      <div class="druck-inhalt">
        <div class="zert-kopfmarke">
          <span class="zert-dokumentart">Teilnahmebescheinigung</span>
          <img class="druck-logo" src="${window.LOGO_NORMAL}" alt="tribeta" />
        </div>

        <div class="zert-mitte">
          <div class="zert-ueberschrift">${escHtml(z.ueberschrift || kurs.titel)}</div>
          <h1 class="zert-titel">Zertifikat</h1>
          <div class="zert-titelstrich"></div>
          <div class="zert-einleitung">Hiermit wird bestätigt, dass</div>
          <div class="zert-name">${escHtml(teilnehmer.name)}</div>
          <div class="zert-text">${text}</div>

          <div class="zert-daten">
            <div>
              <div class="l">Zertifikatsnummer</div>
              <div class="v">${escHtml(nummer)}</div>
            </div>
            <div>
              <div class="l">Gültigkeit</div>
              <div class="v">${escHtml(z.gueltigkeit || 'unbefristet')}</div>
            </div>
            <div>
              <div class="l">Umfang</div>
              <div class="v">${escHtml(String(z.umfangUE || '—'))} UE</div>
            </div>
          </div>
        </div>

        <div class="zert-unterschriften">
          <div class="zert-unterschrift"><div class="zert-linie"></div><span>Ort, Datum</span></div>
          <div class="zert-unterschrift"><div class="zert-linie"></div><span>Leitung / Referent:in</span></div>
        </div>
        ${druckFusszeile('tribeta GmbH')}
      </div>
    </div>`;
}

function druckeZertifikat(buchungId) {
  try {
    const buchung = window.STATE.buchungen.find(b => b.id === buchungId);
    const teilnehmer = buchung && window.STATE.teilnehmer.find(t => t.id === buchung.teilnehmerId);
    const html = zertifikatHtml(buchungId);
    const dateiname = `Zertifikat_${buchung.zertifikatNr}_${(teilnehmer.name || '').replace(/\s+/g, '-')}`;
    druckeInhalt(html, dateiname);
  } catch (e) {
    alert('Bescheinigung konnte nicht erzeugt werden: ' + e.message);
  }
}

// ---- Anwesenheitsliste ----
// Das Blatt, das der Dozent mitnimmt: abhaken, wer da ist, jede anwesende
// Person unterschreibt. Bewusst OHNE die in der App erfassten Prozentwerte -
// vorbelegte Zahlen wuerden die Erhebung vor Ort entwerten.

const ANWESENHEITSLISTE_LEERZEILEN = 3;

function anwesenheitslisteHtml(terminId) {
  const gefunden = findeTerminMitKurs(terminId);
  if (!gefunden) throw new Error(`Termin ${terminId} nicht gefunden`);
  const { kurs, termin } = gefunden;
  const z = kurs.zertifikat || {};

  // Dieselbe massgebliche Menge wie ueberall: abgesagte Buchungen zaehlen nicht.
  const buchungen = anwesenheitsBuchungen(terminId)
    .map(b => window.STATE.teilnehmer.find(t => t.id === b.teilnehmerId))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));

  const zeilen = buchungen.map((t, i) => `
      <tr>
        <td class="al-nr">${i + 1}</td>
        <td>${escHtml(t.name)}</td>
        <td>${escHtml(t.firma)}</td>
        <td class="al-haken"><span class="al-kasten"></span></td>
        <td><span class="al-linie"></span></td>
      </tr>`).join('');

  // Leerzeilen fuer Personen, die spontan dazukommen.
  const leerzeilen = Array.from({ length: ANWESENHEITSLISTE_LEERZEILEN }, (_, i) => `
      <tr>
        <td class="al-nr">${buchungen.length + i + 1}</td>
        <td><span class="al-linie"></span></td>
        <td><span class="al-linie"></span></td>
        <td class="al-haken"><span class="al-kasten"></span></td>
        <td><span class="al-linie"></span></td>
      </tr>`).join('');

  const vertretung = trainerName(termin.vertretungTrainerId);

  return `
    <div class="druck-seite">
      ${druckUntergrund('dezent')}
      <div class="druck-inhalt">
      <div class="bericht-kopf">
        <div>
          <h1 class="bericht-titel">Anwesenheitsliste</h1>
          <div class="bericht-untertitel">${escHtml(kurs.titel)}</div>
        </div>
        <img class="druck-logo" src="${window.LOGO_NORMAL}" alt="tribeta" />
      </div>

      <div class="al-kopfzeile">
        ${formatiereDatum(termin.datum)} · ${escHtml(termin.ort || 'Ort offen')} ·
        ${escHtml(kurs.format)} · ${escHtml(String(z.umfangUE || '—'))} Unterrichtseinheiten
      </div>
      <div class="al-kopfzeile">
        Trainer: ${escHtml(trainerName(termin.trainerId) || 'kein Trainer zugeordnet')}${
          vertretung ? ` · Vertretung: ${escHtml(vertretung)}` : ''}
      </div>

      <table class="bericht-tabelle al-tabelle">
        <thead>
          <tr>
            <th class="al-nr">Nr.</th><th>Name</th><th>Firma</th>
            <th class="al-haken">Anwesend</th><th class="al-unterschrift">Unterschrift</th>
          </tr>
        </thead>
        <tbody>${zeilen}${leerzeilen}</tbody>
      </table>

      <div class="al-bestaetigung">
        Ich bestätige, dass die Schulung wie oben angegeben durchgeführt wurde
        und die abgehakten Personen daran teilgenommen haben.
      </div>
      <div class="al-signatur">
        <div>
          <span class="al-linie"></span>
          <div class="al-signatur-label">Ort, Datum</div>
        </div>
        <div>
          <span class="al-linie"></span>
          <div class="al-signatur-label">Unterschrift Trainer</div>
        </div>
      </div>
      ${druckFusszeile('tribeta GmbH')}
      </div>
    </div>`;
}

function druckeAnwesenheitsliste(terminId) {
  try {
    const gefunden = findeTerminMitKurs(terminId);
    const html = anwesenheitslisteHtml(terminId);
    const dateiname = `Anwesenheitsliste_${gefunden.termin.datum}_${(gefunden.kurs.titel || '').replace(/\s+/g, '-')}`;
    druckeInhalt(html, dateiname);
  } catch (e) {
    alert('Anwesenheitsliste konnte nicht erzeugt werden: ' + e.message);
  }
}

// ---- Abschlussbericht ----
// Internes Archivdokument: enthaelt bewusst ALLE Teilnehmer mit ihren
// Anwesenheiten, anders als die personenbezogene Bescheinigung.

function abschlussberichtHtml(terminId) {
  const gefunden = findeTerminMitKurs(terminId);
  if (!gefunden) throw new Error(`Termin ${terminId} nicht gefunden`);
  const { kurs, termin } = gefunden;
  const a = termin.abschluss;
  const buchungen = anwesenheitsBuchungen(terminId);
  const s = anwesenheitStatistik(terminId);
  const z = kurs.zertifikat || {};

  const zeilen = buchungen.map(b => {
    const t = window.STATE.teilnehmer.find(p => p.id === b.teilnehmerId);
    const erfasst = b.anwesenheitProzent !== null && b.anwesenheitProzent !== undefined;
    const erfuellt = erfuelltMindestteilnahme(b);
    return `
      <tr>
        <td>${escHtml(t ? t.name : '(unbekannt)')}</td>
        <td>${escHtml(t ? t.firma : '')}</td>
        <td${erfasst && !erfuellt ? ' class="negativ"' : ''}>${erfasst ? b.anwesenheitProzent + ' %' : 'nicht erfasst'}</td>
        <td>${escHtml(b.fehlgrund || '—')}</td>
        <td${erfuellt ? '' : ' class="negativ"'}>${b.zertifikatNr ? escHtml(b.zertifikatNr) : (erfuellt ? 'noch nicht ausgestellt' : 'nein')}</td>
      </tr>`;
  }).join('') || '<tr><td colspan="5">Keine Teilnehmer.</td></tr>';

  const agenda = (kurs.agenda || []).length
    ? `<table class="bericht-tabelle">
         <thead><tr><th style="width:26%">Zeit</th><th>Programmpunkt</th></tr></thead>
         <tbody>${kurs.agenda.map(p => `<tr><td>${escHtml(p.zeit)}</td><td>${escHtml(p.titel)}</td></tr>`).join('')}</tbody>
       </table>`
    : '<div style="font-size:10pt; color:#697187;">Keine Agenda hinterlegt.</div>';

  const wieder = a && (a.wiedereroeffnungen || []).length;
  const ausgestellt = buchungen.filter(b => b.zertifikatNr).length;

  return `
    <div class="druck-seite">
      ${druckUntergrund('dezent')}
      <div class="druck-inhalt">
      <div class="bericht-kopf">
        <div>
          <h1 class="bericht-titel">Abschlussbericht</h1>
          <div class="bericht-untertitel">${escHtml(kurs.titel)} · ${formatiereDatum(termin.datum)}</div>
        </div>
        <img class="druck-logo" src="${window.LOGO_NORMAL}" alt="tribeta" />
      </div>

      <div class="bericht-meta">
        <div><div class="l">Kategorie</div>${escHtml(kurs.kategorie)}</div>
        <div><div class="l">Format / Ort</div>${escHtml(kurs.format)} · ${escHtml(termin.ort || '—')}</div>
        <div><div class="l">Umfang</div>${escHtml(String(z.umfangUE || '—'))} Unterrichtseinheiten</div>
        <div><div class="l">Trainer</div>${escHtml(trainerName(termin.trainerId) || 'kein Trainer zugeordnet')}</div>
        <div><div class="l">Vertretung</div>${escHtml(trainerName(termin.vertretungTrainerId) || '—')}</div>
        <div><div class="l">Abgeschlossen am</div>${a ? formatiereDatum(a.abgeschlossenAm) : 'nicht abgeschlossen'}</div>
      </div>

      <div class="bericht-abschnitt">Durchgeführte Agenda</div>
      ${agenda}

      <div class="bericht-abschnitt">Teilnehmer und Anwesenheit</div>
      <table class="bericht-tabelle">
        <thead><tr><th>Name</th><th>Firma</th><th>Anwesenheit</th><th>Fehlgrund</th><th>Bescheinigung</th></tr></thead>
        <tbody>${zeilen}</tbody>
      </table>
      <div class="bericht-kennzahlen">
        <div><strong>${s.gesamt}</strong> Teilnehmer</div>
        <div><strong>${s.erfuellt}</strong> erfüllen die Mindestteilnahme (${MINDEST_ANWESENHEIT} %)</div>
        <div><strong>${ausgestellt}</strong> Bescheinigung(en) ausgestellt</div>
        <div>Ø Anwesenheit: <strong>${s.durchschnitt !== null ? s.durchschnitt + ' %' : '—'}</strong></div>
      </div>

      <div class="bericht-abschnitt">Besondere Vorkommnisse</div>
      <div class="bericht-vorkommnisse">${a && a.vorkommnisse ? escHtml(a.vorkommnisse) : 'Keine.'}</div>
      ${wieder ? `<div class="bericht-warnung">Hinweis: Dieser Termin wurde nach dem Abschluss ${wieder}× wieder geöffnet (${a.wiedereroeffnungen.map(formatiereDatum).join(', ')}). Nachträgliche Änderungen sind daher möglich gewesen.</div>` : ''}

      <div class="bericht-unterschrift">
        <div class="zert-linie"></div>
        <span style="font-size:9pt; color:var(--muted);">Unterschrift Trainer</span>
      </div>
      ${druckFusszeile('Internes Archivdokument · tribeta GmbH')}
      </div>
    </div>`;
}

function druckeAbschlussbericht(terminId) {
  try {
    const gefunden = findeTerminMitKurs(terminId);
    const html = abschlussberichtHtml(terminId);
    const dateiname = `Abschlussbericht_${gefunden.termin.datum}_${(gefunden.kurs.titel || '').replace(/\s+/g, '-')}`;
    druckeInhalt(html, dateiname);
  } catch (e) {
    alert('Abschlussbericht konnte nicht erzeugt werden: ' + e.message);
  }
}
