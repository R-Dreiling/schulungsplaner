// functions/api/daten.js
// Liest/schreibt schulungsdaten.json in R2. Cloudflare Access schuetzt die
// gesamte Domain bereits davor - jede Anfrage, die hier ankommt, kommt
// zwangslaeufig von einer zugelassenen E-Mail-Adresse (siehe
// design-spec-cloudflare-native.md).
const SCHLUESSEL = 'schulungsdaten.json';

export async function onRequestGet(context) {
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
}

export async function onRequestPut(context) {
  const ifMatch = context.request.headers.get('If-Match');
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
}
