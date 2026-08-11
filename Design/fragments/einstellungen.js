// Design/fragments/einstellungen.js
// Dialog fuer die Angaben, die auf jeder Bescheinigung gleich sind:
// Ausstellungsort, Unterschrift und Firmenstempel. Kein Seiten-Fragment -
// der Dialog wird aus der Werkzeugleiste der Seitenleiste geoeffnet.

function einstellungenVorschauBild(feld, beschriftung) {
  const e = einstellungen();
  const bild = e[feld];
  const knopfText = bild ? 'Bild ersetzen' : 'Bild wählen';
  return `
    <div class="einst-bildfeld">
      <div class="einst-bildvorschau ${bild ? '' : 'leer'}">
        ${bild
          ? `<img src="${escAttr(bild)}" alt="${escAttr(beschriftung)}" />`
          : '<span>noch kein Bild</span>'}
      </div>
      <div class="einst-bildaktionen">
        <label class="datei-wahl">
          <input type="file" accept="image/*" onchange="einstellungenBildGewaehlt(event, '${escJsArg(feld)}')" />
          <span class="datei-wahl-knopf">${knopfText}</span>
        </label>
        ${feld === 'stempelBild'
          ? '<button type="button" class="btn" onclick="einstellungenStempelVorlage()">tribeta-Stempel verwenden</button>'
          : ''}
        ${bild ? `<button type="button" class="btn btn-ghost-red" onclick="einstellungenBildEntfernen('${escJsArg(feld)}')">Entfernen</button>` : ''}
      </div>
    </div>`;
}

function oeffneEinstellungenDialog() {
  const e = einstellungen();
  oeffneDialog(`
    <div class="dialog-head"><h3>Bescheinigungen: Ort, Unterschrift, Stempel</h3><button class="dialog-close" onclick="schliesseDialog()">✕</button></div>
    <div class="dialog-body">
      <p class="field-hint" style="margin:0;">
        Diese Angaben erscheinen auf <strong>jeder</strong> Teilnahmebescheinigung.
        Anwesenheitsliste und Abschlussbericht bleiben zum Unterschreiben von Hand.
      </p>

      <div class="field">
        <label>Ausstellungsort</label>
        <input id="einst-ort" value="${escAttr(e.ausstellungsort || '')}" placeholder="z. B. Hamburg" />
        <div class="field-hint">Erscheint mit dem Ausstellungsdatum unter der Bescheinigung. Leer lassen heißt: nur das Datum.</div>
      </div>

      <div class="field">
        <label>Unterschrift</label>
        ${einstellungenVorschauBild('unterschriftBild', 'Unterschrift')}
        <div class="field-hint">PNG mit durchsichtigem Hintergrund sieht am besten aus. Große Bilder werden automatisch verkleinert.</div>
      </div>

      <div class="field">
        <label>Name und Funktion unter der Unterschrift</label>
        <input id="einst-unterschrift-name" value="${escAttr(e.unterschriftName || '')}" placeholder="z. B. Dr. Julia Berg, Geschäftsführung" />
        <div class="field-hint">Bleibt das Feld leer, steht dort „Leitung / Referent:in".</div>
      </div>

      <div class="field">
        <label>Firmenstempel</label>
        ${einstellungenVorschauBild('stempelBild', 'Stempel')}
      </div>

      <div class="field">
        <label>Firmenangaben im Fuß der Bescheinigung</label>
        <textarea id="einst-firmenangaben" rows="3">${escHtml(e.firmenangaben || '')}</textarea>
        <div class="field-hint">Eine Zeile je Angabe. Sobald die Gesellschaft im Handelsregister eingetragen ist, gehören Registernummer und USt-IdNr. hier ergänzt.</div>
      </div>

      <div class="field">
        <label>Ablageordner für Dokumente und Sicherungen</label>
        <div id="einst-ablage-zustand" class="einst-ablage">wird geprüft …</div>
        <div class="einst-bildaktionen" style="margin-top:8px;">
          <button type="button" class="btn" id="einst-ablage-knopf" onclick="einstellungenAblageWaehlen()">Ordner wählen</button>
          <button type="button" class="btn" onclick="einstellungenSicherungJetzt()">Alles sichern und ablegen</button>
        </div>
        <div class="field-hint">
          Bescheinigungen, Listen und Berichte werden beim Erzeugen automatisch dort abgelegt —
          je Termin ein Unterordner. Liegt der Ordner in OneDrive, sind sie damit in der Cloud.
          Abgelegt wird HTML; jede Datei öffnet beim Doppelklick den Druckdialog, sodass daraus
          mit einem Klick ein PDF im selben Ordner entsteht.
        </div>
      </div>
    </div>
    <div class="dialog-foot">
      <button type="button" class="btn" onclick="schliesseDialog()">Schließen</button>
      <button type="button" class="btn btn-primary" onclick="einstellungenTexteSpeichern()">Speichern</button>
    </div>`);
  einstellungenAblageZustandZeigen();
}

// Der Zustand des Ablageordners laesst sich nur asynchron feststellen, der
// Dialog wird aber synchron aufgebaut - deshalb nachtraeglich eintragen.
function einstellungenAblageZustandZeigen() {
  const feld = document.getElementById('einst-ablage-zustand');
  const knopf = document.getElementById('einst-ablage-knopf');
  if (!feld) return;
  // Der gemerkte Name steht in den Einstellungen und laesst sich sofort
  // anzeigen - der Handle-Zustand kommt asynchron nach.
  const gemerkt = einstellungen().ablageOrdnerName || '';
  if (gemerkt) {
    feld.innerHTML = `<span class="einst-ablage-ordner">${escHtml(gemerkt)}</span> <span class="einst-ablage-aus">— Zugriff wird geprüft …</span>`;
    if (knopf) knopf.textContent = 'Anderen Ordner wählen';
  }
  ablageZustand().then(z => {
    if (!feld.isConnected) return;
    if (!z.moeglich) {
      feld.innerHTML = '<span class="einst-ablage-aus">Dieser Browser kann nicht in Ordner schreiben. '
        + 'In Chrome oder Edge funktioniert es.</span>';
      return;
    }
    if (!z.gewaehlt) {
      feld.innerHTML = '<span class="einst-ablage-aus">Noch kein Ordner gewählt — '
        + 'Dokumente werden nur gedruckt, nicht abgelegt.</span>';
      if (knopf) knopf.textContent = 'Ordner wählen';
      return;
    }
    if (knopf) knopf.textContent = 'Anderen Ordner wählen';
    feld.innerHTML = `<span class="einst-ablage-ordner">${escHtml(z.name)}</span> `
      + (z.bereit
        ? '<span class="einst-ablage-bereit">· bereit, Dokumente werden abgelegt</span>'
        : '<span class="einst-ablage-aus">· Zugriff wird beim ersten Ablegen einmal bestätigt</span>');
  }).catch(e => { feld.textContent = 'Zustand nicht feststellbar: ' + e.message; });
}

function einstellungenAblageWaehlen() {
  einstellungenTexteLesen();
  ablageOrdnerWaehlen().then(handle => {
    if (!handle) return;
    schliesseDialog();
    oeffneEinstellungenDialog();
  });
}

// Legt den Datenbestand ab und dazu die Dokumente aller Termine, die
// abgeschlossen sind - so ist nach einem Klick alles gesichert, was fertig ist.
function einstellungenSicherungJetzt() {
  const abgeschlossene = window.STATE.kurse
    .flatMap(k => k.termine)
    .filter(t => t.abschluss);

  const frage = abgeschlossene.length
    ? `Datenbestand sichern und die Dokumente von ${abgeschlossene.length} abgeschlossenen Termin(en) ablegen?\n\n`
      + 'Dabei werden fehlende Bescheinigungen erzeugt und ihre Nummern vergeben.'
    : 'Datenbestand jetzt im Ablageordner sichern?';
  if (!confirm(frage)) return;

  ablageSicherung().then(async ergebnis => {
    if (!ergebnis.abgelegt) {
      alert('Sicherung nicht abgelegt (' + ergebnis.grund + ').\n'
        + 'Über „Exportieren" in der Seitenleiste geht es weiterhin als Download.');
      return;
    }
    let dateien = 0;
    const fehler = [];
    for (const termin of abgeschlossene) {
      try {
        const r = await ablageAlleDokumente(termin.id);
        dateien += r.erledigt.length;
        fehler.push(...r.fehler);
      } catch (e) {
        fehler.push(e.message);
      }
    }
    const zeilen = ['Datensicherung: ' + ergebnis.pfad];
    if (abgeschlossene.length) zeilen.push(`${dateien} Dokument(e) abgelegt.`);
    if (fehler.length) zeilen.push('\nNicht abgelegt:\n' + fehler.join('\n'));
    alert(zeilen.join('\n'));
  }).catch(e => alert('Sicherung fehlgeschlagen: ' + e.message));
}

// Die Bilder werden sofort beim Auswaehlen uebernommen (mit Verkleinerung),
// die Textfelder erst ueber "Speichern" - deshalb der Dialog danach neu
// aufgebaut, damit die Vorschau den neuen Stand zeigt.
function einstellungenBildGewaehlt(ev, feld) {
  const datei = ev.target.files && ev.target.files[0];
  if (!datei) return;
  einstellungBildSetzen(feld, datei)
    .then(() => {
      einstellungenTexteLesen();
      schliesseDialog();
      oeffneEinstellungenDialog();
    })
    .catch(err => alert(err.message));
}

// Der mitgelieferte Firmenstempel - ein Klick statt Datei-Upload.
function einstellungenStempelVorlage() {
  einstellungenTexteLesen();
  aktualisiereEinstellungen({ stempelBild: window.STEMPEL_VORLAGE });
  schliesseDialog();
  oeffneEinstellungenDialog();
}

function einstellungenBildEntfernen(feld) {
  if (!confirm('Dieses Bild wirklich entfernen?')) return;
  einstellungenTexteLesen();
  aktualisiereEinstellungen({ [feld]: null });
  schliesseDialog();
  oeffneEinstellungenDialog();
}

// Liest die Textfelder aus dem offenen Dialog, ohne ihn zu schliessen.
function einstellungenTexteLesen() {
  const ort = document.getElementById('einst-ort');
  const name = document.getElementById('einst-unterschrift-name');
  const firma = document.getElementById('einst-firmenangaben');
  if (!ort || !name || !firma) return;
  aktualisiereEinstellungen({
    ausstellungsort: ort.value.trim(),
    unterschriftName: name.value.trim(),
    firmenangaben: firma.value.trim(),
  });
}

function einstellungenTexteSpeichern() {
  einstellungenTexteLesen();
  schliesseDialog();
}
