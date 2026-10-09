// Exact UserRole values from backend/prisma/schema.prisma.
export const userRoles = ["RANGER", "PARK_MANAGER", "COMMUNITY_LIAISON", "RESEARCHER", "COMMUNITY_USER"];
export function authenticatedDestination(user) {
  if (!user?.id || !userRoles.includes(user.role)) return null;
  return user.role === "RANGER" ? "Home" : "Profile";
}
