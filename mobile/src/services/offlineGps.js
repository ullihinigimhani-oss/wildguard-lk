import { Platform } from 'react-native';
import { enqueueGps, localTrail, mergeTrail } from '../storage/offlineStorage';
import { recordPatrolLocation } from './patrolApi';
import { kickSync } from './offlineSync';
export async function recordOfflineGps(owner, patrol, sample, signal) {
  if (Platform.OS === 'web') return recordPatrolLocation(patrol.id, sample, signal);
  const assigned = patrol.rangerId || patrol.ranger?.id;
  if (assigned && assigned !== owner) throw new Error('This patrol is not assigned to the authenticated Ranger.');
  if (patrol.status !== 'IN_PROGRESS') throw new Error('Patrol is not active.');
  const location = await enqueueGps(owner, patrol.id, sample);
  kickSync();
  return {
    accepted: true,
    location,
    savedOnDevice: true
  };
}
export async function mergeLocalGps(owner, patrolId, server) {
  if (Platform.OS === 'web') return server;
  return mergeTrail(server, await localTrail(owner, patrolId));
}
