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
    </div>
    <div class="dialog-foot">
      <button type="button" class="btn" onclick="schliesseDialog()">Schließen</button>
      <button type="button" class="btn btn-primary" onclick="einstellungenTexteSpeichern()">Speichern</button>
    </div>`);
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
  if (!ort || !name) return;
  aktualisiereEinstellungen({
    ausstellungsort: ort.value.trim(),
    unterschriftName: name.value.trim(),
  });
}

function einstellungenTexteSpeichern() {
  einstellungenTexteLesen();
  schliesseDialog();
}
