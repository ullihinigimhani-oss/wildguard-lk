// Foreground session progress only. No claim of persistent waypoint completion.
const sessions = new Map();
export const sessionKey = (userId, patrol) =>
  `${userId}:${patrol.id}:${patrol.actualStartTime}`;
export const reachedFor = (key) => new Set(sessions.get(key) || []);
export const saveReached = (key, reached) => sessions.set(key, [...reached]);
export const clearNavigationSessions = () => sessions.clear();
export const clearNavigationSession = (key) => sessions.delete(key);
