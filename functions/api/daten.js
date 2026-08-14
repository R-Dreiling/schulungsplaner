// functions/api/daten.js
// Liest/schreibt schulungsdaten.json in R2. Cloudflare Access schuetzt die
// gesamte Domain bereits davor - jede Anfrage, die hier ankommt, kommt
// zwangslaeufig von einer zugelassenen E-Mail-Adresse (siehe
// design-spec-cloudflare-native.md).
const SCHLUESSEL = 'schulungsdaten.json';

// Faengt unerwartete Fehler ab (z.B. transiente R2-Stoerungen) und liefert
// eine auswertbare JSON-Antwort statt Cloudflares generischer Absturzseite -
// cf-sync.js erkennt jeden Nicht-2xx-Status bereits korrekt als "nicht
// gespeichert", aber ohne diesen Fang war der Grund dafuer nie einsehbar.
function fehlerAntwort(nachricht, err) {
  console.error(nachricht, err);
  return new Response(
    JSON.stringify({ fehler: nachricht, meldung: err && err.message ? err.message : String(err) }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
}

export async function onRequestGet(context) {
  try {
    const objekt = await context.env.SCHULUNGSDATEN.get(SCHLUESSEL);
    if (!objekt) {
      return new Response(null, { status: 404 });
    }
    const text = await objekt.text();
    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'ETag': objekt.httpEtag,
      },
    });
  } catch (err) {
    return fehlerAntwort('Lesen aus R2 fehlgeschlagen', err);
  }
}

export async function onRequestPut(context) {
  try {
    const ifMatchRoh = context.request.headers.get('If-Match');
    // R2 vergleicht gegen den unquotierten Etag-Wert; ETag-Header werden
    // aber in Anfuehrungszeichen uebertragen (RFC 7232) - ungestrippt
    // wuerde jeder bedingte Schreibversuch faelschlich als Konflikt gelten.
    const ifMatch = ifMatchRoh ? ifMatchRoh.replace(/^W\//, '').replace(/^"|"$/g, '') : null;
    const body = await context.request.text();
    const optionen = { httpMetadata: { contentType: 'application/json' } };
    if (ifMatch) {
      optionen.onlyIf = { etagMatches: ifMatch };
    }
    const ergebnis = await context.env.SCHULUNGSDATEN.put(SCHLUESSEL, body, optionen);
    if (!ergebnis) {
      // onlyIf griff nicht: die Datei hat sich seit dem letzten Lesen geaendert.
      return new Response(JSON.stringify({ konflikt: true }), { status: 412 });
    }
    return new Response(JSON.stringify({ gespeichert: true }), {
      status: 200,
      headers: { 'ETag': ergebnis.httpEtag },
    });
  } catch (err) {
    return fehlerAntwort('Schreiben nach R2 fehlgeschlagen', err);
  }
}
