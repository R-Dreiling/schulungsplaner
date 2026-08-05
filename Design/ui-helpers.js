// Design/ui-helpers.js
// Generische UI-Helfer: Dialog-Overlay oeffnen/schliessen, Formular auslesen.
// Destruktive Bestaetigungen (Loeschen) laufen bewusst ueber das native
// confirm(), nicht ueber einen eigenen Dialog - konsistent mit
// zuruecksetzenAufBeispieldaten() aus state-engine.js.

function oeffneDialog(innerHtml) {
  const overlay = document.getElementById('dialog-overlay');
  const container = document.getElementById('dialog-container');
  container.innerHTML = innerHtml;
  overlay.style.display = 'flex';
}

function schliesseDialog() {
  const overlay = document.getElementById('dialog-overlay');
  document.getElementById('dialog-container').innerHTML = '';
  overlay.style.display = 'none';
}

function formularWerte(formElement) {
  return Object.fromEntries(new FormData(formElement).entries());
}

// Maskiert Werte, die in ein HTML-Attribut interpoliert werden (value="...",
// title="...", label="..."). Ohne das kuerzt ein " im Kurstitel das Feld ab.
function escAttr(text) {
  return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Fuer Werte, die zusaetzlich in einem JS-String-Argument eines inline
// onclick="..." landen. Der Browser dekodiert Entities BEVOR das JS geparst
// wird - escAttr allein wuerde ein &#39; wieder zu ' machen und den Handler
// zerbrechen. Daher zuerst JS-escapen (Backslash), dann Attribut-escapen.
function escJsArg(text) {
  return escAttr(String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
}

function formatiereDatum(isoDatum) {
  const [jahr, monat, tag] = isoDatum.split('-');
  return `${tag}.${monat}.${jahr}`;
}

// Einheitliche Status-Farb-Zuordnung app-weit (siehe design-spec.md):
// Gruen=bestaetigt/aktiv, Amber=angemeldet/geplant, Grau=abgeschlossen,
// Rot=abgesagt, Indigo=ausgebucht/voll (Indigo wird direkt an den
// Aufrufstellen mit terminAuslastung() gesetzt, nicht hier).

function statusBadgeHtml(status) {
  const zuordnung = {
    geplant: ['badge-amber', 'geplant'],
    laufend: ['badge-green', 'laufend'],
    abgeschlossen: ['badge-gray', 'abgeschlossen'],
  };
  const [klasse, label] = zuordnung[status] || ['badge-gray', status];
  return `<span class="badge ${klasse}">${label}</span>`;
}

function anmeldestatusBadgeHtml(status) {
  const zuordnung = {
    angemeldet: ['badge-amber', 'angemeldet'],
    bestätigt: ['badge-green', 'bestätigt'],
    abgesagt: ['badge-red', 'abgesagt'],
  };
  const [klasse, label] = zuordnung[status] || ['badge-gray', status];
  return `<span class="badge ${klasse}">${label}</span>`;
}

document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('dialog-overlay');
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) schliesseDialog();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') schliesseDialog();
  });
});
