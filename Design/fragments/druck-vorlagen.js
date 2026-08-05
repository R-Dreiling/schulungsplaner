// Design/fragments/druck-vorlagen.js
// Baut Bescheinigung und Abschlussbericht als HTML fuer den Druckbereich.
// Nachbau der tribeta-Vorlage 09_Zertifikat_Vorlage.pdf.

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
      <div class="zert-rahmen">
        <div><img class="druck-logo" src="${window.LOGO_NORMAL}" alt="tribeta" /></div>
        <div class="zert-ueberschrift">${escHtml(z.ueberschrift || kurs.titel)}</div>
        <h1 class="zert-titel">Zertifikat</h1>
        <div class="zert-einleitung">Hiermit wird bestätigt, dass</div>
        <div class="zert-name">${escHtml(teilnehmer.name)}</div>
        <div class="zert-text">${text}</div>
        <div class="zert-unterschriften">
          <div class="zert-unterschrift"><div class="zert-linie"></div><span>Ort, Datum</span></div>
          <div class="zert-unterschrift"><div class="zert-linie"></div><span>Leitung / Referent:in</span></div>
          <div class="zert-unterschrift"><div class="zert-linie"></div><span>tribeta</span></div>
        </div>
        <div class="zert-fuss">
          Zertifikat-Nr.: ${escHtml(nummer)} &nbsp;·&nbsp; Gültigkeit: ${escHtml(z.gueltigkeit || 'unbefristet')}
        </div>
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
