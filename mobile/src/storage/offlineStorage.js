import * as SQLite from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
const connections = new Map();
export const offlineId = () => randomUUID();
export const schema = `
CREATE TABLE IF NOT EXISTS gps (id TEXT PRIMARY KEY, owner TEXT NOT NULL, patrol_id TEXT NOT NULL, payload TEXT NOT NULL, captured_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING_SYNC', retries INTEGER NOT NULL DEFAULT 0, error TEXT, next_at INTEGER NOT NULL DEFAULT 0, UNIQUE(owner,patrol_id,captured_at));
CREATE TABLE IF NOT EXISTS drafts (id TEXT PRIMARY KEY, owner TEXT NOT NULL, patrol_id TEXT NOT NULL, payload TEXT NOT NULL, form TEXT NOT NULL, captured_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'LOCAL_DRAFT', server_id TEXT, retries INTEGER NOT NULL DEFAULT 0, error TEXT, next_at INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS evidence (id TEXT PRIMARY KEY, owner TEXT NOT NULL, draft_id TEXT NOT NULL REFERENCES drafts(id), position INTEGER NOT NULL, payload TEXT NOT NULL, captured_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING_SYNC', server_id TEXT, retries INTEGER NOT NULL DEFAULT 0, error TEXT, next_at INTEGER NOT NULL DEFAULT 0, UNIQUE(owner,draft_id,position));
CREATE TABLE IF NOT EXISTS patrol_cache (owner TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, captured_at TEXT NOT NULL, PRIMARY KEY(owner,id));
CREATE INDEX IF NOT EXISTS gps_pending ON gps(owner,status,next_at,captured_at);
CREATE INDEX IF NOT EXISTS drafts_pending ON drafts(owner,status,next_at,captured_at);
CREATE INDEX IF NOT EXISTS evidence_pending ON evidence(owner,draft_id,status,next_at,position);`;
export async function database() {
  if (!connections.has('main')) connections.set('main', (async () => {
    const db = await SQLite.openDatabaseAsync('wildguard-offline.db');
    await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    const version = await db.getFirstAsync('PRAGMA user_version');
    if (version.user_version > 1) throw new Error('Local data uses a newer app version. Update the app before syncing.');
    await db.withExclusiveTransactionAsync(async tx => {
      await tx.execAsync(schema);
      await tx.execAsync('PRAGMA user_version = 1;');
    });
    return db;
  })().catch(error => {
    connections.delete('main');
    throw error;
  }));
  return connections.get('main');
}
export function resetOfflineConnection() {
  connections.clear();
}
const tables = new Set(['gps', 'drafts', 'evidence']);
const tableName = name => {
  if (!tables.has(name)) throw new Error('Invalid local queue.');
  return name;
};
const scoped = owner => {
  if (typeof owner !== 'string' || !owner) throw new Error('Authenticated Ranger required.');
  return owner;
};
const cleanMedia = item => Object.fromEntries(['uri', 'ownedUri', 'name', 'mimeType', 'size', 'source', 'uploadKey', 'prepared', 'extension', 'video', 'caption', 'cameraTrapId', 'capturedAt', 'notes', 'photoMode', 'originalSize'].filter(key => item[key] !== undefined).map(key => [key, item[key]]));
const cleanForm = form => Object.fromEntries(['title', 'incidentType', 'description', 'date', 'time', 'latitude', 'longitude'].map(key => [key, form[key] || '']));
const cleanBody = body => body ? Object.fromEntries(['title', 'incidentType', 'description', 'occurredAt', 'latitude', 'longitude', 'manualLocation'].filter(key => body[key] !== undefined).map(key => [key, body[key]])) : null;
export async function enqueueGps(owner, patrolId, sample) {
  scoped(owner);
  const {
    validCoordinate,
    NAVIGATION
  } = require('../../../shared/patrolNavigation');
  if (!validCoordinate(sample) || !Number.isFinite(Date.parse(sample.recordedAt)) || !Number.isFinite(sample.accuracy) || sample.accuracy < 0 || sample.accuracy > NAVIGATION.maximumAccuracyMeters) throw new Error('Invalid GPS sample.');
  const db = await database();
  const payload = {
    latitude: sample.latitude,
    longitude: sample.longitude,
    accuracy: sample.accuracy,
    recordedAt: sample.recordedAt
  };
  await db.runAsync('INSERT OR IGNORE INTO gps(id,owner,patrol_id,payload,captured_at) VALUES(?,?,?,?,?)', offlineId(), owner, patrolId, JSON.stringify(payload), sample.recordedAt);
  return payload;
}
export async function localTrail(owner, patrolId) {
  const rows = await (await database()).getAllAsync('SELECT payload FROM gps WHERE owner=? AND patrol_id=? ORDER BY captured_at DESC LIMIT 1000', scoped(owner), patrolId);
  return rows.reverse().map(row => JSON.parse(row.payload));
}
export function mergeTrail(server, local) {
  const entries = new Map();
  for (const sample of [...local, ...server]) entries.set(`${Date.parse(sample.recordedAt)}|${sample.latitude}|${sample.longitude}`, sample);
  return [...entries.values()].sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt)).slice(-1000);
}
export async function cachePatrol(owner, patrol) {
  scoped(owner);
  if (!patrol?.id || patrol.rangerId && patrol.rangerId !== owner) throw new Error('Assigned patrol required.');
  const safe = Object.fromEntries(['id', 'rangerId', 'status', 'routeName', 'parkId', 'park', 'plannedRoute', 'waypoints', 'actualStartTime', 'actualEndTime', 'scheduledDate', 'startTime', 'endTime', 'priority', 'patrolType'].filter(key => patrol[key] !== undefined).map(key => [key, patrol[key]]));
  await (await database()).runAsync('INSERT INTO patrol_cache(owner,id,payload,captured_at) VALUES(?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET payload=excluded.payload,captured_at=excluded.captured_at', owner, patrol.id, JSON.stringify(safe), new Date().toISOString());
}
export async function cachePatrols(owner, patrols) {
  const db = await database();
  scoped(owner);
  await db.withExclusiveTransactionAsync(async tx => {
    // Replace the authorized snapshot, removing stale assignments from the picker.
    await tx.runAsync('DELETE FROM patrol_cache WHERE owner=?', owner);
    for (const p of patrols) if (!p.rangerId || p.rangerId === owner) {
      const safe = Object.fromEntries(['id', 'rangerId', 'status', 'routeName', 'parkId', 'park', 'plannedRoute', 'waypoints', 'actualStartTime', 'actualEndTime', 'scheduledDate', 'startTime', 'endTime', 'priority', 'patrolType'].filter(key => p[key] !== undefined).map(key => [key, p[key]]));
      await tx.runAsync('INSERT INTO patrol_cache(owner,id,payload,captured_at) VALUES(?,?,?,?)', owner, p.id, JSON.stringify(safe), new Date().toISOString());
    }
  });
}
export async function cachedPatrols(owner) {
  return (await (await database()).getAllAsync('SELECT payload FROM patrol_cache WHERE owner=?', scoped(owner))).map(row => ({
    ...JSON.parse(row.payload),
    offlineSnapshot: true
  }));
}
export async function readDraft(owner, id) {
  const db = await database(),
    row = await db.getFirstAsync('SELECT * FROM drafts WHERE owner=? AND id=?', scoped(owner), id);
  if (!row) return null;
  const evidence = await db.getAllAsync('SELECT * FROM evidence WHERE owner=? AND draft_id=? ORDER BY position', owner, id);
  return {
    ...row,
    form: JSON.parse(row.form),
    payload: JSON.parse(row.payload),
    items: evidence.map(e => ({
      ...JSON.parse(e.payload),
      localEvidenceId: e.id,
      status: e.status === 'SYNCED' ? 'uploaded' : ['SYNC_FAILED', 'NEEDS_REVIEW'].includes(e.status) ? 'failed' : e.status === 'SYNCING' ? 'uploading' : 'selected',
      evidenceId: e.server_id,
      error: e.error
    }))
  };
}
export async function listDrafts(owner) {
  return (await (await database()).getAllAsync('SELECT id,patrol_id,form,status,server_id,error FROM drafts WHERE owner=? ORDER BY captured_at DESC', scoped(owner))).map(row => ({
    ...row,
    form: JSON.parse(row.form)
  }));
}
export async function saveDraft(owner, patrolId, id, form, body, items, submit = false) {
  const db = await database();
  scoped(owner);
  id ||= offlineId();
  if (items.length > 5 || items.some(i => !i.prepared || !i.ownedUri || i.uri !== i.ownedUri)) throw new Error('Select persistent evidence files before saving a draft.');
  await db.withExclusiveTransactionAsync(async tx => {
    const prior = await tx.getFirstAsync('SELECT * FROM drafts WHERE id=?', id);
    if (prior && prior.owner !== owner) throw new Error('Draft is not available to this account.');
    if (prior && (prior.status !== 'LOCAL_DRAFT' || prior.server_id || prior.retries > 0)) throw new Error('This report is syncing or already attempted on the server. Retry sync before changing its content.');
    await tx.runAsync('INSERT INTO drafts(id,owner,patrol_id,payload,form,captured_at,status) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,form=excluded.form,status=excluded.status,error=NULL,next_at=0 WHERE drafts.owner=excluded.owner', id, owner, patrolId, JSON.stringify(cleanBody(body)), JSON.stringify(cleanForm(form)), new Date().toISOString(), submit ? 'PENDING_SYNC' : 'LOCAL_DRAFT');
    // Reordering/removing a draft never deletes the actual media files.
    await tx.runAsync('DELETE FROM evidence WHERE owner=? AND draft_id=?', owner, id);
    for (let i = 0; i < items.length; i++) await tx.runAsync('INSERT INTO evidence(id,owner,draft_id,position,payload,captured_at,status) VALUES(?,?,?,?,?,?,?)', items[i].localEvidenceId || offlineId(), owner, id, i, JSON.stringify(cleanMedia(items[i])), items[i].capturedAt || new Date().toISOString(), submit ? 'PENDING_SYNC' : 'LOCAL_DRAFT');
  });
  return id;
}
export async function pending(owner, table, limit = 25) {
  return (await database()).getAllAsync(`SELECT * FROM ${tableName(table)} WHERE owner=? AND status IN ('PENDING_SYNC','SYNC_FAILED') AND next_at<=? ORDER BY captured_at LIMIT ?`, scoped(owner), Date.now(), Math.min(25, limit));
}
export async function claim(owner, table, id) {
  return (await (await database()).runAsync(`UPDATE ${tableName(table)} SET status='SYNCING',retries=retries+1 WHERE owner=? AND id=? AND status IN ('PENDING_SYNC','SYNC_FAILED')`, scoped(owner), id)).changes === 1;
}
export async function finish(owner, table, id, status, error = null, nextAt = 0, serverId = null) {
  const extra = table === 'gps' ? '' : ',server_id=COALESCE(?,server_id)';
  scoped(owner);
  await (await database()).runAsync(`UPDATE ${tableName(table)} SET status=?,error=?,next_at=? ${extra} WHERE owner=? AND id=?`, status, error, nextAt, ...(table === 'gps' ? [] : [serverId]), owner, id);
}
export async function recover(owner) {
  const db = await database();
  scoped(owner);
  await db.withExclusiveTransactionAsync(async tx => {
    for (const table of tables) await tx.runAsync(`UPDATE ${table} SET status='PENDING_SYNC',next_at=CASE WHEN error='Session expired. Sign in again to sync.' THEN 0 ELSE next_at END WHERE owner=? AND (status='SYNCING' OR error='Session expired. Sign in again to sync.')`, owner);
  });
}
export async function retryPending(owner) {
  const db = await database();
  for (const table of tables) await db.runAsync(`UPDATE ${table} SET status='PENDING_SYNC' WHERE owner=? AND status='SYNC_FAILED'`, scoped(owner));
}
export async function counts(owner) {
  const db = await database(),
    result = {
      pending: 0,
      failed: 0,
      drafts: 0
    };
  scoped(owner);
  for (const table of tables) {
    const rows = await db.getAllAsync(`SELECT status,count(*) AS count FROM ${table} WHERE owner=? GROUP BY status`, owner);
    for (const row of rows) {
      if (['PENDING_SYNC', 'SYNCING'].includes(row.status)) result.pending += row.count;
      if (['SYNC_FAILED', 'NEEDS_REVIEW'].includes(row.status)) result.failed += row.count;
      if (table === 'drafts' && row.status === 'LOCAL_DRAFT') result.drafts += row.count;
    }
  }
  return result;
}

// A server rate limit applies to the coordinator, including after process restart.
export async function retryAfter(owner) {
  scoped(owner);
  const db = await database();
  let latest = 0;
  for (const table of tables) {
    const row = await db.getFirstAsync(`SELECT MAX(next_at) AS until FROM ${table} WHERE owner=? AND status IN ('PENDING_SYNC','SYNCING','SYNC_FAILED') AND error='Rate limited. Sync will retry after the server delay.'`, owner);
    latest = Math.max(latest, row?.until || 0);
  }
  return latest;
}
