import { getMyPatrol, getPatrolRiskZones } from "./patrolApi";
import { database, offlineId } from '../storage/offlineStorage';
import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';
import { File, Directory, Paths } from 'expo-file-system';
import { approvedOfflineMapProvider } from './offlineMapProvider';
import { validCoordinate, distanceMeters } from '../../../shared/patrolNavigation';
import { validRing } from '../../../shared/riskGeometry';

export const MAP_LIMITS = Object.freeze({ marginMeters: 500, minZoom: 12, maxZoom: 15, maxTiles: 2000, maxBytes: 50 * 1024 * 1024, maxExtentMeters: 30000 });
const hash = text => digestStringAsync(CryptoDigestAlgorithm.SHA256, text);
const rejection = (code, message) => Object.assign(new Error(message), { navigationCacheCode: code });
export function navigationCacheError(error) {
  return ['OWNER_MISSING','OWNER_MISMATCH','PATROL_UNAVAILABLE','HAZARDS_INVALID','ROUTE_INVALID','HAZARD_FINGERPRINT_MISMATCH','SNAPSHOT_DIGEST_MISMATCH','SNAPSHOT_VERSION_INVALID','PARK_MISMATCH','SNAPSHOT_PARSE_FAILED'].includes(error?.navigationCacheCode) ? error.navigationCacheCode : 'SNAPSHOT_STORAGE_FAILED';
}
function diagnostic(stage, reason, route = null, zones = []) {
  console.info(JSON.stringify({ stage: 'offline_navigation_' + stage, reason, geometryPoints: route?.geometry?.coordinates?.length || 0, zoneCount: Array.isArray(zones) ? zones.length : 0 }));
}
const scope = owner => { if (!owner || typeof owner !== 'string') throw new Error('Authenticated Ranger required.'); return owner; };
export const pointIdentity = patrol => JSON.stringify({ park: patrol.parkId || patrol.park?.id, points: (patrol.plannedRoute || []).map(p => [p.id || p.waypointId, p.type, p.order, p.latitude, p.longitude]), session: patrol.actualStartTime || null });
export const riskIdentity = zones => JSON.stringify([...zones].sort((a,b) => String(a.id).localeCompare(String(b.id))));
export const validZones = zones => Array.isArray(zones) && zones.length <= 32 && zones.every(z => z && ['HIGH', 'CRITICAL'].includes(z.riskLevel) && z.geometry?.type === 'Polygon' && z.geometry.coordinates?.length === 1 && validRing(z.geometry.coordinates[0]));
export const validRoute = route => route?.geometry?.type === 'LineString' && Array.isArray(route.geometry.coordinates) && route.geometry.coordinates.length >= 2 && route.geometry.coordinates.length <= 50000 && route.geometry.coordinates.every(p => Array.isArray(p) && p.length === 2 && validCoordinate({ longitude: p[0], latitude: p[1] })) && Number.isFinite(route.distanceMeters) && route.distanceMeters >= 0 && Number.isFinite(route.durationSeconds) && route.durationSeconds >= 0;
async function db() {
  const connection = await database();
  await connection.execAsync(`CREATE TABLE IF NOT EXISTS navigation_cache (owner TEXT NOT NULL, patrol_id TEXT NOT NULL, payload TEXT NOT NULL, digest TEXT NOT NULL, PRIMARY KEY(owner,patrol_id));
CREATE TABLE IF NOT EXISTS map_packages (id TEXT PRIMARY KEY, owner TEXT NOT NULL, patrol_id TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL, error TEXT, UNIQUE(owner,patrol_id));`);
  return connection;
}
function authorized(owner, patrol) {
  scope(owner);
  const assigned = patrol?.rangerId || patrol?.ranger?.id;
  if (!assigned) throw rejection('OWNER_MISSING','Refresh this patrol online using the updated backend to verify its Ranger owner.');
  if (assigned !== owner) throw rejection('OWNER_MISMATCH','This patrol is not assigned to this Ranger.');
  if (!patrol?.id || !['SCHEDULED','IN_PROGRESS','COMPLETED'].includes(patrol.status)) throw rejection('PATROL_UNAVAILABLE','This patrol is not available for cached navigation.');
}
export async function cacheNavigation(owner, patrol, zones, route = null) {
  try { await writeNavigation(owner,patrol,zones,route); diagnostic('saved',route ? 'VERIFIED_ROUTE_AND_HAZARDS' : 'VERIFIED_HAZARDS',route,zones); }
  catch(error) { diagnostic('save_rejected',navigationCacheError(error)); throw error; }
}
async function writeNavigation(owner, patrol, zones, route = null) {
  authorized(owner, patrol);
  if (!validZones(zones)) throw rejection('HAZARDS_INVALID','Unverified route or hazard snapshot.');
  if (route && !validRoute(route)) throw rejection('ROUTE_INVALID','Unverified route geometry.');
  if (route && (!validZones(route.riskZones) || riskIdentity(route.riskZones) !== riskIdentity(zones))) throw rejection('HAZARD_FINGERPRINT_MISMATCH','Unverified route or hazard snapshot.');
  const connection = await db();
  const value = { version: 1, identity: pointIdentity(patrol), park: patrol.parkId || patrol.park?.id, zones, riskFingerprint: riskIdentity(zones), route: route ? { geometry: route.geometry, distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds, riskZones: zones, profile: 'foot-walking', validatedAt: new Date().toISOString() } : null, capturedAt: new Date().toISOString() };
  await connection.withExclusiveTransactionAsync(async tx => {
    const old = await tx.getFirstAsync('SELECT payload,digest FROM navigation_cache WHERE owner=? AND patrol_id=?', owner, patrol.id);
    if (!route && old && await hash(old.payload) === old.digest) {
      const prior = JSON.parse(old.payload);
      if (prior.identity === value.identity && prior.riskFingerprint === value.riskFingerprint) value.route = prior.route;
    }
    const payload = JSON.stringify(value);
    await tx.runAsync('INSERT INTO navigation_cache(owner,patrol_id,payload,digest) VALUES(?,?,?,?) ON CONFLICT(owner,patrol_id) DO UPDATE SET payload=excluded.payload,digest=excluded.digest', owner, patrol.id, payload, await hash(payload));
  });
}
export async function readNavigation(owner, patrol) {
  try { return await loadNavigation(owner,patrol); }
  catch(error) { diagnostic('read_rejected',navigationCacheError(error)); throw error; }
}
async function loadNavigation(owner, patrol) {
  authorized(owner, patrol);
  const row = await (await db()).getFirstAsync('SELECT payload,digest FROM navigation_cache WHERE owner=? AND patrol_id=?', owner, patrol.id);
  if (!row) { diagnostic('read_rejected','SNAPSHOT_MISSING'); return { route: null, zones: [], warning: 'Hazard information is missing. No current route safety can be verified offline.' }; }
  if (await hash(row.payload) !== row.digest) throw rejection('SNAPSHOT_DIGEST_MISMATCH','Cached navigation integrity check failed.');
  let value;
  try { value = JSON.parse(row.payload); } catch { throw rejection('SNAPSHOT_PARSE_FAILED','Cached navigation is invalid.'); }
  if (value.version !== 1) throw rejection('SNAPSHOT_VERSION_INVALID','Cached navigation version is invalid.');
  if (value.park !== (patrol.parkId || patrol.park?.id)) throw rejection('PARK_MISMATCH','Cached park association changed.');
  if (!validZones(value.zones)) throw rejection('HAZARDS_INVALID','Cached hazard snapshot is invalid.');
  if (value.riskFingerprint !== riskIdentity(value.zones)) throw rejection('HAZARD_FINGERPRINT_MISMATCH','Cached hazard fingerprint does not match.');
  const matches = value.identity === pointIdentity(patrol);
  const routeValid = validRoute(value.route) && value.route.profile === 'foot-walking' && validZones(value.route.riskZones) && riskIdentity(value.route.riskZones) === value.riskFingerprint;
  diagnostic('read',!matches ? 'WAYPOINT_SESSION_MISMATCH' : !routeValid ? 'VERIFIED_ROUTE_MISSING_OR_INVALID' : 'VERIFIED_CACHED_ROUTE',routeValid ? value.route : null,value.zones);
  return { ...value, route: matches && routeValid ? value.route : null, warning: matches ? 'Cached hazards may have changed since download. Current safety cannot be verified offline.' : 'Patrol waypoints changed. Cached planned route unavailable; hazards may also be outdated.' };
}
const tileX = (lng,z) => Math.floor((lng+180)/360 * 2**z);
const tileY = (lat,z) => Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2 * 2**z);
export function packagePlan(patrol, route, margin = MAP_LIMITS.marginMeters) {
  if (!validRoute(route) || !Number.isFinite(margin) || margin < 100 || margin > 2000) throw new Error('A verified walking route and bounded safety margin are required.');
  const coordinates = [...route.geometry.coordinates, ...(patrol.plannedRoute || []).map(p => [p.longitude,p.latitude])];
  if (!coordinates.every(p => validCoordinate({ longitude:p[0],latitude:p[1] }) && Math.abs(p[1]) < 80)) throw new Error('Invalid offline coverage coordinates.');
  const lng = coordinates.map(p=>p[0]), lat = coordinates.map(p=>p[1]);
  const padLat = margin/111320, padLng = padLat/Math.cos(Math.max(...lat.map(Math.abs))*Math.PI/180);
  const bounds = [Math.min(...lng)-padLng,Math.min(...lat)-padLat,Math.max(...lng)+padLng,Math.max(...lat)+padLat];
  if (bounds[0] < -180 || bounds[2] > 180 || distanceMeters({longitude:bounds[0],latitude:bounds[1]}, {longitude:bounds[2],latitude:bounds[3]}) > MAP_LIMITS.maxExtentMeters) throw new Error('Offline coverage exceeds the bounded patrol area.');
  let tiles = 0;
  for(let z=MAP_LIMITS.minZoom;z<=MAP_LIMITS.maxZoom;z++) tiles += (tileX(bounds[2],z)-tileX(bounds[0],z)+1)*(tileY(bounds[1],z)-tileY(bounds[3],z)+1);
  if (tiles > MAP_LIMITS.maxTiles) throw new Error('Offline coverage requires too many tiles.');
  return { bounds, minZoom:MAP_LIMITS.minZoom, maxZoom:MAP_LIMITS.maxZoom, tileCount:tiles, estimatedBytes:tiles*40000, marginMeters:margin };
}
export async function packageStatus(owner, patrolId) {
  scope(owner);
  const row = await (await db()).getFirstAsync('SELECT * FROM map_packages WHERE owner=? AND patrol_id=?',owner,patrolId);
  return row ? { ...JSON.parse(row.payload), status:row.status, error:row.error } : null;
}
async function savePackage(owner, patrolId, metadata, status, error=null) {
  await (await db()).runAsync('INSERT INTO map_packages(id,owner,patrol_id,payload,status,error) VALUES(?,?,?,?,?,?) ON CONFLICT(owner,patrol_id) DO UPDATE SET id=excluded.id,payload=excluded.payload,status=excluded.status,error=excluded.error',metadata.id,owner,patrolId,JSON.stringify(metadata),status,error);
}
export const providerBlocker = 'Offline basemap provider is not configured. Public OSM tile downloads are prohibited.';
export function verifyProvider(provider) {
  if (!provider || provider.offlineAllowed !== true || !provider.licenseReference || !provider.attribution || typeof provider.download !== 'function') throw new Error(providerBlocker);
  return provider;
}
const inFlight = new Set();
export async function downloadPackage(owner, patrol, snapshot, { signal, onProgress, fieldDataPending = false } = {}) {
  authorized(owner,patrol);
  const provider = verifyProvider(approvedOfflineMapProvider); // Fail before any network/file operation.
  if (fieldDataPending) throw new Error('Sync pending field data before downloading optional maps.');
  const current = await getMyPatrol(patrol.id,signal);
  authorized(owner,current);
  const hazards = await getPatrolRiskZones(patrol.id,signal);
  if (!validZones(hazards) || pointIdentity(current) !== pointIdentity(patrol) || riskIdentity(hazards) !== snapshot?.riskFingerprint) throw new Error('Patrol or hazards changed. Refresh navigation before download.');
  if (!snapshot?.route || snapshot.identity !== pointIdentity(patrol) || snapshot.riskFingerprint !== riskIdentity(snapshot.zones) || !validZones(snapshot.zones)) throw new Error('Refresh the verified route and hazards before download.');
  const plan = packagePlan(patrol,snapshot.route), key = owner+'|'+patrol.id;
  if (plan.estimatedBytes > MAP_LIMITS.maxBytes) throw new Error('Estimated offline map exceeds the package size limit.');
  if (inFlight.has(key)) throw new Error('This map download is already running.');
  inFlight.add(key);
  let previous;
  const directory = new Directory(Paths.document,'offline-patrol-maps');
  const metadata = { id:offlineId(), owner, patrolId:patrol.id, ...plan, provider:provider.id, licenseReference:provider.licenseReference, attribution:provider.attribution, version:1, downloadedAt:null, uri:null, size:0, integrity:'UNVERIFIED', snapshot };
  let partial, complete;
  try {
    previous = await packageStatus(owner,patrol.id);
    if (signal?.aborted) throw new Error('Download cancelled.');
    const available = Paths.availableDiskSpace;
    if (!Number.isFinite(available) || available < plan.estimatedBytes*2 + 10*1024*1024) throw new Error('Insufficient device storage for the offline map.');
    directory.create({ intermediates:true, idempotent:true });
    partial = new File(directory,metadata.id+'.partial');
    complete = new File(directory,metadata.id+'.json');
    await savePackage(owner,patrol.id,metadata,'DOWNLOADING');
    const result = await provider.download(plan,{signal,onProgress});
    if (signal?.aborted) throw new Error('Download cancelled.');
    if (typeof result?.text !== 'string' || result.text.length > MAP_LIMITS.maxBytes || await hash(result.text) !== result.sha256) throw new Error('Offline package integrity check failed.');
    const bundle = JSON.parse(result.text);
    validateBundle(bundle,plan);
    partial.write(result.text);
    if (await hash(await partial.text()) !== result.sha256) throw new Error('Offline package integrity check failed.');
    if (signal?.aborted) throw new Error('Download cancelled.');
    partial.move(complete);
    metadata.uri = complete.uri; metadata.size = complete.size; metadata.digest = result.sha256; metadata.downloadedAt = new Date().toISOString(); metadata.integrity = 'VERIFIED';
    await savePackage(owner,patrol.id,metadata,'READY');
    onProgress?.(1);
    // Keep any superseded file for now; deletion never touches field-data directories.
    return metadata;
  } catch(error) {
    if (partial?.exists) partial.delete();
    if (complete?.exists) complete.delete();
    if (previous?.status === 'READY') await savePackage(owner,patrol.id,previous,'READY');
    else await savePackage(owner,patrol.id,metadata,signal?.aborted ? 'CANCELLED' : 'FAILED', signal?.aborted ? 'Download cancelled.' : 'Map download failed. Check storage/provider and retry.');
    throw error;
  } finally { inFlight.delete(key); }
}
export function validateBundle(bundle,plan) {
  if (!Number.isInteger(plan.tileCount) || plan.tileCount < 1 || plan.tileCount > MAP_LIMITS.maxTiles || plan.minZoom !== MAP_LIMITS.minZoom || plan.maxZoom !== MAP_LIMITS.maxZoom || !Array.isArray(plan.bounds) || plan.bounds.length !== 4 || !plan.bounds.every(Number.isFinite)) throw new Error('Invalid package coverage metadata.');
  if (bundle?.version !== 1 || bundle.format !== 'wildguard-raster-v1' || bundle.minZoom !== plan.minZoom || bundle.maxZoom !== plan.maxZoom || !Array.isArray(bundle.tiles) || bundle.tiles.length !== plan.tileCount) throw new Error('Unsupported or incomplete offline map bundle.');
  const keys = new Set();
  for (const t of bundle.tiles) {
    if (![t.z,t.x,t.y].every(Number.isInteger) || t.z < plan.minZoom || t.z > plan.maxZoom || t.x < tileX(plan.bounds[0],t.z) || t.x > tileX(plan.bounds[2],t.z) || t.y < tileY(plan.bounds[3],t.z) || t.y > tileY(plan.bounds[1],t.z) || typeof t.data !== 'string' || t.data.length > 1000000 || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(t.data) || !(t.data.startsWith('data:image/png;base64,iVBORw0KGgo') || t.data.startsWith('data:image/jpeg;base64,/9j/')) || keys.has(`${t.z}/${t.x}/${t.y}`)) throw new Error('Invalid or duplicate offline raster tile.');
    keys.add(`${t.z}/${t.x}/${t.y}`);
  }
  return bundle;
}
export async function readPackage(owner,patrol) {
  authorized(owner,patrol);
  const metadata = await packageStatus(owner,patrol.id);
  if (!metadata || metadata.status !== 'READY') {
    if (metadata?.status === 'DOWNLOADING') await savePackage(owner,patrol.id,metadata,'INTERRUPTED','Download interrupted. Retry while online.');
    return null;
  }
  if (metadata.snapshot?.identity !== pointIdentity(patrol)) {
    await savePackage(owner,patrol.id,metadata,'STALE','Patrol waypoints/session changed. Update the offline map while online.');
    return null;
  }
  try {
    if (!/^[a-f0-9-]{36}$/i.test(metadata.id) || metadata.owner !== owner || metadata.patrolId !== patrol.id) throw new Error('Invalid scoped package identity.');
    const directory = new Directory(Paths.document,'offline-patrol-maps');
    const file = new File(directory,metadata.id+'.json');
    if (metadata.version !== 1 || metadata.integrity !== 'VERIFIED' || metadata.uri !== file.uri || !file.exists || file.size > MAP_LIMITS.maxBytes) throw new Error('Invalid map file.');
    const text = await file.text();
    if (await hash(text) !== metadata.digest) throw new Error('Corrupted map file.');
    return { ...metadata, bundle:validateBundle(JSON.parse(text),metadata) };
  } catch {
    await savePackage(owner,patrol.id,metadata,'CORRUPT','Offline map failed integrity verification. Download again while online.');
    return null;
  }
}
export async function deletePackage(owner,patrolId) {
  scope(owner);
  if (inFlight.has(owner+'|'+patrolId)) throw new Error('Cancel the map download before deleting it.');
  const metadata = await packageStatus(owner,patrolId);
  if (!metadata) return;
  if (!/^[a-f0-9-]{36}$/i.test(metadata.id)) throw new Error('Invalid package file identity.');
  const dir = new Directory(Paths.document,'offline-patrol-maps');
  for (const suffix of ['.json','.partial']) { const file = new File(dir,metadata.id+suffix); if(file.exists) file.delete(); }
  await (await db()).runAsync('DELETE FROM map_packages WHERE owner=? AND patrol_id=?',owner,patrolId);
}
