export const modules = [
  ["reporting", "Reporting", "▤", ["RESEARCHER"]],
  ["patrols", "Patrol Management", "↗", ["PARK_MANAGER", "RANGER", "COMMUNITY_LIAISON"]],
  ["incidents", "Incidents", "◇", ["PARK_MANAGER", "RANGER", "COMMUNITY_LIAISON"]],
  ["map", "Field Map", "⌖", ["PARK_MANAGER", "RANGER", "COMMUNITY_LIAISON", "RESEARCHER"]],
  ["community-reports", "Community Reports", "◎", ["PARK_MANAGER"]],
  ["wildlife", "Wildlife Monitoring", "♧", ["PARK_MANAGER", "RANGER", "COMMUNITY_LIAISON", "RESEARCHER"]],
  ["alerts", "Alerts", "△", ["PARK_MANAGER", "RANGER", "COMMUNITY_LIAISON"]],
  ["camera-traps", "Camera Traps", "▣", ["PARK_MANAGER", "RANGER", "COMMUNITY_LIAISON"]],
  ["analytics", "Analytics & Reports", "▥", ["PARK_MANAGER", "RANGER", "COMMUNITY_LIAISON"]],
  ["conservation-reports", "Conservation Reports", "◈", ["PARK_MANAGER"]],
  ["users", "Users / Access Management", "♙", ["PARK_MANAGER"]],
  ["settings", "Settings", "⚙", ["PARK_MANAGER", "RANGER", "COMMUNITY_LIAISON"]],
].map(([path, title, icon, roles]) => ({
  path,
  title,
  icon,
  ...(roles && { roles }),
}));
