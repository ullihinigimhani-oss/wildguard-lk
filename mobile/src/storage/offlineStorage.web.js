// Native offline queues require SQLite and persistent native media. Do not silently
// replace them with volatile memory or claim durable browser support.
const unavailable = async () => {
  throw new Error('Offline field storage is available in the native iPhone/Android app.');
};
export const database = unavailable,
  enqueueGps = unavailable,
  localTrail = unavailable,
  cachePatrol = unavailable,
  cachePatrols = unavailable,
  cachedPatrols = unavailable,
  readDraft = unavailable,
  listDrafts = unavailable,
  saveDraft = unavailable,
  pending = unavailable,
  claim = unavailable,
  finish = unavailable,
  recover = unavailable,
  retryPending = unavailable,
  counts = unavailable;
export const retryAfter = unavailable;
export const offlineId = () => globalThis.crypto.randomUUID();
export function mergeTrail(server, local) {
  const points = new Map([...local, ...server].map(p => [`${Date.parse(p.recordedAt)}|${p.latitude}|${p.longitude}`, p]));
  return [...points.values()].sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
}
