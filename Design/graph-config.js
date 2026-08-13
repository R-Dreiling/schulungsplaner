// Design/graph-config.js
// Werte werden bei der einmaligen Einrichtung eingetragen (siehe HANDOFF.md,
// Abschnitt "Einmalige Einrichtung"). Keine davon ist geheim: die clientId
// einer Public-Client-SPA ist nicht vertraulich, das Deployment ist bewusst
// oeffentlich (siehe design-spec-cloud-sync.md, Abschnitt "Architektur").
window.GRAPH_CONFIG = {
  clientId: '',    // Anwendungs-ID (Client) aus der Azure-AD-App-Registrierung
  tenantId: '',    // Verzeichnis-ID (Mandant) aus der Azure-AD-App-Registrierung
  redirectUri: window.location.origin + window.location.pathname,
  driveId: '',     // OneDrive-Laufwerks-ID des freigegebenen Ordners
  itemId: '',      // Element-ID des Ordners "Schulungsplaner" in diesem Laufwerk
  dateiname: 'schulungsdaten.json',
};
