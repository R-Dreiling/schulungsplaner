// Design/graph-auth.js
// Anmeldung mit dem tribeta-Microsoft-Konto per MSAL.js. Zwei getrennte
// Einstiege, weil Popups nur direkt aus einem Klick heraus funktionieren:
// graphSilentAnmeldung() beim Start (kein Popup, meldet nur ein vorhandenes
// Konto an), graphInteraktiveAnmeldung() nur aus einem Knopf-Klick heraus.

// Files.ReadWrite.All statt Files.ReadWrite: Letzteres deckt in Azure AD nur
// die eigenen Dateien der angemeldeten Person ab. Der Ablageordner gehoert
// aber der Admin-Nutzerin und ist mit den anderen nur GETEILT - ohne ".All"
// koennten Kolleginnen ihn nicht lesen/schreiben.
const GRAPH_SCOPES = ['Files.ReadWrite.All'];

let msalApp = null;

async function graphAuthKonfigurieren() {
  if (msalApp) return msalApp;
  msalApp = new msal.PublicClientApplication({
    auth: {
      clientId: window.GRAPH_CONFIG.clientId,
      authority: 'https://login.microsoftonline.com/' + window.GRAPH_CONFIG.tenantId,
      redirectUri: window.GRAPH_CONFIG.redirectUri,
    },
    cache: {
      cacheLocation: 'localStorage',
    },
  });
  await msalApp.initialize();
  return msalApp;
}

// Kein Popup: nutzt ein bereits im Browser vorhandenes Microsoft-Konto.
// Gibt null zurueck, wenn niemand angemeldet ist - dann muss
// graphInteraktiveAnmeldung() aus einem Knopf-Klick heraus folgen.
async function graphSilentAnmeldung() {
  const app = await graphAuthKonfigurieren();
  const konten = app.getAllAccounts();
  if (konten.length === 0) return null;
  app.setActiveAccount(konten[0]);
  try {
    return await app.acquireTokenSilent({ scopes: GRAPH_SCOPES, account: konten[0] });
  } catch (e) {
    return null;
  }
}

// Nur aus einem Klick-Handler aufrufen - der Browser blockiert Popups ohne
// direkte Nutzeraktion.
async function graphInteraktiveAnmeldung() {
  const app = await graphAuthKonfigurieren();
  const ergebnis = await app.loginPopup({ scopes: GRAPH_SCOPES });
  app.setActiveAccount(ergebnis.account);
  return ergebnis;
}

// Token fuer einen Graph-Aufruf nach erfolgreicher Anmeldung. Wirft, wenn
// niemand angemeldet ist - der Aufrufer zeigt dann den Anmelde-Bildschirm.
async function graphToken() {
  const app = await graphAuthKonfigurieren();
  const konto = app.getActiveAccount();
  if (!konto) throw new Error('Nicht angemeldet');
  const ergebnis = await app.acquireTokenSilent({ scopes: GRAPH_SCOPES, account: konto });
  return ergebnis.accessToken;
}

function graphAngemeldeterName() {
  if (!msalApp) return null;
  const konto = msalApp.getActiveAccount();
  return konto ? (konto.name || konto.username) : null;
}

async function graphAbmelden() {
  const app = await graphAuthKonfigurieren();
  const konto = app.getActiveAccount();
  return app.logoutPopup({ account: konto });
}
