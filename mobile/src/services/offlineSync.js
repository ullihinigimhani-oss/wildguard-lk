import * as store from '../storage/offlineStorage';
import { recordPatrolLocation } from './patrolApi';
import { createIncident } from './incidentApi';
import { uploadIncidentEvidence } from './incidentEvidenceApi';
import { ensureEvidencePrepared } from '../utils/incidentEvidence';
let owner = null,
  online = false,
  paused = false,
  generation = 0,
  worker = null,
  controller = null,
  timer = null,
  storageError = null,
  blockedUntil = 0,
  ready = Promise.resolve();
const listeners = new Set();
export const subscribeSync = listener => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
function notify() {
  for (const listener of listeners) listener();
}
export function syncState() {
  return {
    owner,
    online,
    paused,
    syncing: !!worker,
    error: storageError
  };
}
export async function configureSync(id, connected) {
  if (id !== owner) {
    generation++;
    controller?.abort();
    clearTimeout(timer);
    owner = id;
    paused = false;
    storageError = null;
    blockedUntil = 0;
    ready = id ? store.recover(id).then(() => store.retryAfter(id)) : Promise.resolve(0);
  }
  const version = generation;
  const persistedLimit = await ready;
  if (version !== generation || owner !== id) return;
  blockedUntil = Math.max(blockedUntil, persistedLimit || 0);
  online = !!connected;
  notify();
  if (owner && online) return kickSync();
}
export async function retrySync() {
  if (!owner || paused) return;
  if (storageError) {
    await store.recover(owner);
    storageError = null;
  }
  await store.retryPending(owner);
  return kickSync();
}
function delayFor(error, retries) {
  const raw = error.response?.headers?.['retry-after'];
  const seconds = raw != null ? Number(raw) : NaN;
  const date = Number.isFinite(seconds) ? seconds : (Date.parse(raw) - Date.now()) / 1000;
  return Math.max(Math.min(300000, 5000 * 2 ** Math.min(retries, 6)), Number.isFinite(date) ? date * 1000 : 0, Number(error.response?.data?.retryAfterSeconds || 0) * 1000);
}
async function failed(id, table, row, error, version, signal) {
  if (signal.aborted || generation !== version || owner !== id) {
    await store.finish(id, table, row.id, 'PENDING_SYNC');
    return;
  }
  const status = error.response?.status;
  const cleanupBlocked = error.response?.data?.code === "MEDIA_CLEANUP_FAILED";
  if (status === 401) {
    paused = true;
    await store.finish(id, table, row.id, 'SYNC_FAILED', 'Session expired. Sign in again to sync.', Date.now() + 300000);
    return;
  }
  if ([400, 403, 404, 409, 413, 422].includes(status) || error.reselectRequired || cleanupBlocked) {
    await store.finish(id, table, row.id, 'NEEDS_REVIEW', cleanupBlocked ? 'Private asset cleanup was not confirmed. Contact an administrator before retrying; evidence remains saved on this device.' : error.reselectRequired ? 'Evidence file is unavailable. Open the saved incident and select the file again; this queued item is retained for review.' : table === 'gps' ? 'GPS sample retained on device. The server rejected its age, accuracy or patrol authorization; reconciliation is required.' : 'Report/evidence retained on device. Patrol completion, authorization, review lock or invalid content requires attention.', 0);
    return;
  }
  const next = Date.now() + delayFor(error, row.retries);
  if (status === 429 || !status || status >= 500) blockedUntil = Math.max(blockedUntil, next);
  await store.finish(id, table, row.id, 'SYNC_FAILED', status === 429 ? 'Rate limited. Sync will retry after the server delay.' : 'Sync failed. Data remains saved on this device.', next);
}
async function drainGps(id, version, signal, active) {
  for (const row of await store.pending(id, 'gps')) {
    if (!active()) break;
    if (!(await store.claim(id, 'gps', row.id))) continue;
    try {
      const result = await recordPatrolLocation(row.patrol_id, JSON.parse(row.payload), signal);
      if (!result.accepted && result.reason !== 'DUPLICATE') throw {
        response: {
          status: 409
        }
      };
      await store.finish(id, 'gps', row.id, 'SYNCED');
    } catch (error) {
      await failed(id, 'gps', row, error, version, signal);
    }
  }
}
async function uploadWithGpsPriority(upload, id, version, signal, active) {
  let done = false,
    waitTimer,
    wake;
  const media = Promise.resolve().then(upload).finally(() => {
    done = true;
    clearTimeout(waitTimer);
    wake?.();
  });
  const gps = (async () => {
    while (!done && active()) {
      await drainGps(id, version, signal, active);
      if (done || !active()) break;
      await new Promise(resolve => {
        wake = resolve;
        waitTimer = setTimeout(resolve, 15000);
      });
    }
  })().catch(() => {
    if (owner === id && generation === version) storageError = 'Local GPS sync storage failed. Data is retained; retry sync.';
  });
  // One coordinator, at most one GPS request alongside one media request.
  // Settle both lanes before releasing the worker, even when media fails.
  const [result] = await Promise.allSettled([media, gps]);
  if (result.status === 'rejected') throw result.reason;
  return result.value;
}
export function kickSync() {
  if (worker) return worker;
  if (!owner || !online || paused || storageError) return Promise.resolve();
  if (Date.now() < blockedUntil) {
    clearTimeout(timer);
    timer = setTimeout(() => kickSync(), blockedUntil - Date.now());
    return Promise.resolve();
  }
  const id = owner,
    version = generation;
  controller = new AbortController();
  const signal = controller.signal;
  const active = () => owner === id && generation === version && online && !paused && !storageError && !signal.aborted && Date.now() >= blockedUntil;
  worker = (async () => {
    await drainGps(id, version, signal, active);
    if (active()) for (const row of await store.pending(id, 'drafts', 10)) {
      if (!active()) break;
      if (!(await store.claim(id, 'drafts', row.id))) continue;
      try {
        // Recover a lost response through server idempotency, including after completion.
        if (row.server_id) {
          await store.finish(id, 'drafts', row.id, 'PENDING_SYNC', null, 0, row.server_id);
          continue;
        }
        if (!active()) throw {
          response: {
            status: 401
          }
        };
        const result = row.server_id ? {
          id: row.server_id
        } : await createIncident(row.patrol_id, JSON.parse(row.payload), {
          signal,
          headers: {
            'Idempotency-Key': row.id
          }
        });
        await store.finish(id, 'drafts', row.id, 'PENDING_SYNC', null, 0, result.id);
      } catch (error) {
        await failed(id, 'drafts', row, error, version, signal);
      }
    }
    if (active()) for (const row of await store.pending(id, 'evidence', 10)) {
      if (!active()) break;
      const draft = await store.readDraft(id, row.draft_id);
      if (!draft?.server_id || draft.status === 'NEEDS_REVIEW') continue;
      if (!(await store.claim(id, 'evidence', row.id))) continue;
      try {
        const item = JSON.parse(row.payload);
        await ensureEvidencePrepared(item);
        if (!active()) throw {
          response: {
            status: 401
          }
        };
        const evidence = await uploadWithGpsPriority(() => uploadIncidentEvidence(draft.server_id, item, undefined, {
          signal,
          retainLocal: true
        }), id, version, signal, active);
        await store.finish(id, 'evidence', row.id, 'SYNCED', null, 0, evidence.id);
      } catch (error) {
        await failed(id, 'evidence', row, error, version, signal);
      }
    }
    if (active()) for (const draft of await store.listDrafts(id)) if (draft.server_id && draft.status !== 'NEEDS_REVIEW') {
      const full = await store.readDraft(id, draft.id);
      if (full.items.every(item => item.status === 'uploaded')) await store.finish(id, 'drafts', draft.id, 'SYNCED');
    }
  })().catch(() => {
    if (owner === id && generation === version) storageError = 'Local sync storage failed. Data is retained; free device storage and retry sync.';
  }).finally(() => {
    worker = null;
    notify();
    clearTimeout(timer);
    // Bounded passes prevent foreground starvation; persisted next_at enforces backoff.
    if (owner && online && !paused && !storageError) timer = setTimeout(() => kickSync(), Math.max(15000, blockedUntil - Date.now()));
  });
  notify();
  return worker;
}
