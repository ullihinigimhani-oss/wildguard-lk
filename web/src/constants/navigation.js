export const modules = [
  ["patrols", "Patrol Management", "↗"],
  ["incidents", "Incidents", "◇"],
  ["community-reports", "Community Reports", "◎"],
  ["wildlife", "Wildlife Monitoring", "♧"],
  ["alerts", "Alerts", "△"],
  ["camera-traps", "Camera Traps", "▣"],
  ["analytics", "Analytics & Reports", "▥"],
  ["users", "Users / Access Management", "♙"],
  ["settings", "Settings", "⚙"],
].map(([path, title, icon]) => ({ path, title, icon }));
