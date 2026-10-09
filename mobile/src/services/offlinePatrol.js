import { getMyPatrol } from "./patrolApi";
import { cachePatrol, cachedPatrols } from "../storage/offlineStorage";
export async function getAssignedPatrol(id, owner, signal, offline = false) {
  async function cached() {
    return (await cachedPatrols(owner)).find(p => p.id === id);
  }
  if (offline) {
    const snapshot = await cached();
    if (snapshot) return snapshot;
    throw new Error("Open this assigned patrol online once to save its field snapshot.");
  }
  try {
    const patrol = await getMyPatrol(id, signal);
    cachePatrol(owner, patrol).catch(() => {});
    return patrol;
  } catch (error) {
    if (!error.response && !signal?.aborted) {
      try {
        const snapshot = await cached();
        if (snapshot) return snapshot;
      } catch {/* Preserve original network/storage error. */}
    }
    throw error;
  }
}
