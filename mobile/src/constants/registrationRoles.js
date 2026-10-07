export const roleChoices = [
  [
    "RANGER",
    "Park Ranger",
    "Patrol the field, report incidents and help protect wildlife.",
  ],
  [
    "PARK_MANAGER",
    "Park Manager",
    "Manage park operations, teams and conservation activities.",
  ],
  [
    "COMMUNITY_LIAISON",
    "Community Liaison",
    "Connect communities with wildlife conservation teams.",
  ],
  [
    "RESEARCHER",
    "Wildlife Researcher",
    "Support conservation through wildlife research and monitoring.",
  ],
  [
    "COMMUNITY_USER",
    "Community Member",
    "Report wildlife incidents and receive community alerts.",
  ],
];
export const roleLabel = (role) =>
  roleChoices.find(([value]) => value === role)?.[1] || role;

// Manager labels remain available for internal profiles and access-management filters.
export const publicRegistrationRoles = roleChoices.filter(
  ([role]) => role !== "PARK_MANAGER",
);
