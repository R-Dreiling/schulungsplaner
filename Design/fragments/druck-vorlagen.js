// Design/fragments/druck-vorlagen.js
// Baut Bescheinigung, Anwesenheitsliste und Abschlussbericht als HTML fuer den
// Druckbereich.

// Untergrund einer Druckseite: sehr helles Feld, darauf das Signet als grosses,
// fast durchsichtiges Wasserzeichen. Beides sind echte Elemente im Dokument und
// keine CSS-Hintergruende - Hintergrundgrafiken lassen sich im Druckdialog
// abschalten, Bilder und Vektoren im Inhalt nicht.
// staerke: 'voll' fuer die Bescheinigung, 'dezent' fuer Arbeitsdokumente.
function druckUntergrund(staerke) {
  const voll = staerke === 'voll';
  const flaeche = voll ? '#F4F9FB' : '#FBFDFD';
  const wasserzeichen = voll ? 0.07 : 0.04;
  return `
      <svg class="druck-grund" viewBox="0 0 595 842" preserveAspectRatio="none" aria-hidden="true">
        <rect x="0" y="0" width="595" height="842" fill="${flaeche}"/>
      </svg>
      <img class="druck-wasserzeichen" src="${window.LOGO_ICON}" alt="" style="opacity:${wasserzeichen}" />`;
}

// Absenderzeile am Fuss jeder Druckseite. Ohne Logo - das steht bereits im
// Kopf der Seite, ein zweites Mal unten wirkt doppelt.
// Zeilenumbrueche im Text bleiben erhalten (mehrzeilige Firmierung).
function druckFusszeile(zusatz) {
  const text = zusatz ? escHtml(zusatz).replace(/\n/g, '<br/>') : '';
  return `
      <div class="druck-fusszeile">
        <div>${text}</div>
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

// Zeichnungsblock der Bescheinigung: links Ort und Ausstellungsdatum, rechts
// die Unterschrift. Sind Unterschrift oder Stempel hinterlegt, werden sie
// gedruckt - sonst bleiben die Linien leer zum Unterschreiben von Hand.
function zertifikatZeichnung(buchungId) {
  const e = einstellungen();
  const datum = formatiereDatum(zertifikatAusstellungsdatumFuer(buchungId));
  const ortDatum = e.ausstellungsort ? `${escHtml(e.ausstellungsort)}, ${datum}` : datum;
  const name = e.unterschriftName ? escHtml(e.unterschriftName) : 'Leitung / Referent:in';

  return `
        <div class="zert-unterschriften">
          <div class="zert-unterschrift">
            <div class="zert-zeichnungsfeld"><span class="zert-ortdatum">${ortDatum}</span></div>
            <div class="zert-linie"></div><span>Ort, Datum</span>
          </div>
          <div class="zert-unterschrift">
            <div class="zert-zeichnungsfeld">
              ${e.unterschriftBild ? `<img class="zert-unterschriftbild" src="${escAttr(e.unterschriftBild)}" alt="" />` : ''}
            </div>
            <div class="zert-linie"></div><span>${name}</span>
          </div>
        </div>
        ${e.stempelBild ? `<img class="zert-stempel" src="${escAttr(e.stempelBild)}" alt="" />` : ''}`;
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
          <span class="zert-dokumentart">${escHtml(z.dokumentart || 'Teilnahmebescheinigung')}</span>
          <img class="druck-logo" src="${window.LOGO_NORMAL}" alt="tribeta" />
        </div>

        <div class="zert-mitte">
          <div class="zert-ueberschrift">${escHtml(z.ueberschrift || kurs.titel)}</div>
          <h1 class="zert-titel">${escHtml(z.dokumentart || 'Teilnahmebescheinigung')}</h1>
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

        ${zertifikatZeichnung(buchungId)}
        ${druckFusszeile(einstellungen().firmenangaben)}
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

  // Kontaktspalte statt Unterschriftsspalte: geschult wird ueberwiegend online,
  // die Liste fuellt der Trainer aus. Bei Verbindungsproblemen muss er die
  // Teilnehmer erreichen koennen.
  const zeilen = buchungen.map((t, i) => `
      <tr>
        <td class="al-nr">${i + 1}</td>
        <td>${escHtml(t.name)}</td>
        <td>${escHtml(t.firma)}</td>
        <td class="al-kontakt">${escHtml(t.email || '—')}</td>
        <td class="al-haken"><span class="al-kasten"></span></td>
      </tr>`).join('');

  // Leerzeilen fuer Personen, die spontan dazukommen.
  const leerzeilen = Array.from({ length: ANWESENHEITSLISTE_LEERZEILEN }, (_, i) => `
      <tr>
        <td class="al-nr">${buchungen.length + i + 1}</td>
        <td><span class="al-linie"></span></td>
        <td><span class="al-linie"></span></td>
        <td class="al-kontakt"><span class="al-linie"></span></td>
        <td class="al-haken"><span class="al-kasten"></span></td>
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
            <th class="al-kontakt">E-Mail</th><th class="al-haken">Anwesend</th>
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

// ---- Nachweis fuer den Arbeitgeber ----
// Der Kunde muss belegen koennen, dass seine Belegschaft unterwiesen wurde.
// Bescheinigungen gehen an die Teilnehmer; dieses Blatt fasst alle Personen
// EINER Firma zusammen und geht an den Arbeitgeber. Datenschutzrechtlich
// unbedenklich: er kennt seine Beschaeftigten und deren Teilnahme ohnehin -
// anders als bei einem Sammeldokument ueber mehrere Firmen hinweg.

function firmenNachweisFirmen(terminId) {
  const namen = anwesenheitsBuchungen(terminId)
    .map(b => window.STATE.teilnehmer.find(t => t.id === b.teilnehmerId))
    .filter(Boolean)
    .map(t => t.firma || '(ohne Firma)');
  return [...new Set(namen)].sort((a, b) => a.localeCompare(b, 'de'));
}

function firmenNachweisHtml(terminId, firma) {
  const gefunden = findeTerminMitKurs(terminId);
  if (!gefunden) throw new Error(`Termin ${terminId} nicht gefunden`);
  const { kurs, termin } = gefunden;
  const z = kurs.zertifikat || {};
  const e = einstellungen();

  const zeilen = anwesenheitsBuchungen(terminId)
    .map(b => ({ b, t: window.STATE.teilnehmer.find(p => p.id === b.teilnehmerId) }))
    .filter(x => x.t && (x.t.firma || '(ohne Firma)') === firma)
    .sort((x, y) => x.t.name.localeCompare(y.t.name, 'de'));

  if (zeilen.length === 0) throw new Error(`Keine Teilnehmer der Firma „${firma}" auf diesem Termin.`);

  const erfuellt = zeilen.filter(x => erfuelltMindestteilnahme(x.b)).length;

  const tabelle = zeilen.map((x, i) => {
    const erfasst = x.b.anwesenheitProzent !== null && x.b.anwesenheitProzent !== undefined;
    const ok = erfuelltMindestteilnahme(x.b);
    return `
      <tr>
        <td class="al-nr">${i + 1}</td>
        <td>${escHtml(x.t.name)}</td>
        <td${erfasst && !ok ? ' class="negativ"' : ''}>${erfasst ? x.b.anwesenheitProzent + ' %' : 'nicht erfasst'}</td>
        <td${ok ? '' : ' class="negativ"'}>${x.b.zertifikatNr
          ? escHtml(x.b.zertifikatNr)
          : (ok ? 'noch nicht ausgestellt' : 'keine')}</td>
      </tr>`;
  }).join('');

  return `
    <div class="druck-seite">
      ${druckUntergrund('dezent')}
      <div class="druck-inhalt">
      <div class="bericht-kopf">
        <div>
          <h1 class="bericht-titel">Schulungsnachweis</h1>
          <div class="bericht-untertitel">${escHtml(firma)}</div>
        </div>
        <img class="druck-logo" src="${window.LOGO_NORMAL}" alt="tribeta" />
      </div>

      <div class="bericht-meta">
        <div><div class="l">Schulung</div>${escHtml(kurs.titel)}</div>
        <div><div class="l">Datum</div>${formatiereDatum(termin.datum)}</div>
        <div><div class="l">Format / Ort</div>${escHtml(kurs.format)} · ${escHtml(termin.ort || '—')}</div>
        <div><div class="l">Umfang</div>${escHtml(String(z.umfangUE || '—'))} Unterrichtseinheiten</div>
        <div><div class="l">Trainer</div>${escHtml(trainerName(termin.trainerId) || '—')}</div>
        <div><div class="l">Teilnehmer dieser Firma</div>${zeilen.length}</div>
      </div>

      <div class="bericht-abschnitt">Teilnehmende Beschäftigte</div>
      <table class="bericht-tabelle al-tabelle">
        <thead><tr><th class="al-nr">Nr.</th><th>Name</th><th>Anwesenheit</th><th>Bescheinigung</th></tr></thead>
        <tbody>${tabelle}</tbody>
      </table>
      <div class="bericht-kennzahlen">
        <div><strong>${erfuellt}</strong> von <strong>${zeilen.length}</strong> erfüllen die Mindestteilnahme (${MINDEST_ANWESENHEIT} %)</div>
      </div>

      <div class="al-bestaetigung">
        Hiermit wird bestätigt, dass die oben genannten Beschäftigten an der
        bezeichneten Schulung teilgenommen haben. Für Personen, die die
        Mindestteilnahme erreicht haben, wurde eine persönliche
        Teilnahmebescheinigung ausgestellt.
      </div>
      <div class="al-signatur">
        <div>
          <span class="al-linie"></span>
          <div class="al-signatur-label">${e.ausstellungsort ? escHtml(e.ausstellungsort) + ', Datum' : 'Ort, Datum'}</div>
        </div>
        <div>
          ${e.unterschriftBild ? `<img class="zert-unterschriftbild" src="${escAttr(e.unterschriftBild)}" alt="" />` : ''}
          <span class="al-linie"></span>
          <div class="al-signatur-label">${e.unterschriftName ? escHtml(e.unterschriftName) : 'Leitung / Referent:in'}</div>
        </div>
      </div>
      ${druckFusszeile(e.firmenangaben)}
      </div>
    </div>`;
}

function druckeFirmenNachweis(terminId, firma) {
  try {
    const gefunden = findeTerminMitKurs(terminId);
    const html = firmenNachweisHtml(terminId, firma);
    const dateiname = `Schulungsnachweis_${(firma || '').replace(/\s+/g, '-')}_${gefunden.termin.datum}`;
    druckeInhalt(html, dateiname);
  } catch (e) {
    alert('Nachweis konnte nicht erzeugt werden: ' + e.message);
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
