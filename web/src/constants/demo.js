// Static presentation data only. Never merge this with API responses.
export const demoUser = {
  name: "Nimali Perera",
  email: "manager@example.test",
  role: "Park Manager",
  park: "Yala National Park",
};
export const metrics = [
  {
    label: "Active patrols",
    value: "08",
    detail: "Across 3 sectors",
    icon: "↗",
    color: "green",
  },
  {
    label: "Open incidents",
    value: "12",
    detail: "4 awaiting review",
    icon: "◇",
    color: "amber",
  },
  {
    label: "Active wildlife alerts",
    value: "03",
    detail: "Monitoring required",
    icon: "△",
    color: "rose",
  },
  {
    label: "Pending community reports",
    value: "06",
    detail: "Ready for assessment",
    icon: "◎",
    color: "blue",
  },
];
export const incidents = [
  [
    "INC-024",
    "Unusual activity reported",
    "Block I · North boundary",
    "High",
    "12 min ago",
  ],
  [
    "INC-023",
    "Injured animal sighting",
    "Block II · Water point",
    "Medium",
    "38 min ago",
  ],
  [
    "INC-022",
    "Boundary fence damage",
    "Block I · East sector",
    "Low",
    "1 hour ago",
  ],
];
export const patrols = [
  ["Alpha team", "North boundary", "On patrol"],
  ["Bravo team", "Coastal sector", "On patrol"],
  ["Delta team", "Block II", "Scheduled"],
];
