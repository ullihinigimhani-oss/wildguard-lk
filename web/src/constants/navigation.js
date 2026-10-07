export const modules = [
  ["patrols", "Patrol Management", "↗", ["PARK_MANAGER"]],
  ["incidents", "Incidents", "◇", ["PARK_MANAGER"]],
  ["map", "Field Map", "⌖"],
  ["community-reports", "Community Reports", "◎", ["COMMUNITY_LIAISON"]],
  ["wildlife", "Wildlife Monitoring", "♧"],
  ["alerts", "Alerts", "△"],
  ["camera-traps", "Camera Traps", "▣"],
  ["analytics", "Analytics & Reports", "▥"],
  ["users", "Users / Access Management", "♙"],
  ["settings", "Settings", "⚙"],
].map(([path, title, icon, roles]) => ({
  path,
  title,
  icon,
  ...(roles && { roles }),
}));
