// Design/graph-config.js
// Werte werden bei der einmaligen Einrichtung eingetragen (siehe HANDOFF.md,
// Abschnitt "Einmalige Einrichtung"). Keine davon ist geheim: die clientId
// einer Public-Client-SPA ist nicht vertraulich, das Deployment ist bewusst
// oeffentlich (siehe design-spec-cloud-sync.md, Abschnitt "Architektur").
window.GRAPH_CONFIG = {
  clientId: 'f3c14c0a-1442-4cd5-8231-692a7938ad02',
  tenantId: '473ae1a6-c24a-4f5e-a00b-1dc5ef3f4793',
  redirectUri: window.location.origin + window.location.pathname,
  driveId: 'b!GiT3AshxTkKC4WokEBT2_ZgZcbM3nFBGq1cmOqe960kFULvxODDmQZg1C6Bx5_jh',
  itemId: '01KOAOBFNQ4DAMMJZB3VBKZI3XBE56AILW',
  dateiname: 'schulungsdaten.json',
};
