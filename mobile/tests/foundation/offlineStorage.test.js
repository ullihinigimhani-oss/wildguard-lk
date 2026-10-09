jest.mock("../../src/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true, isDemo: false, user: { id: "r", role: "RANGER" } }) }));
jest.mock("expo-network", () => ({ getNetworkStateAsync: jest.fn(), addNetworkStateListener: jest.fn() }));
jest.mock("../../src/services/patrolApi", () => ({ recordPatrolLocation: jest.fn(), getMyPatrol: jest.fn(), getPatrolLocations: jest.fn(), getPatrolRiskZones: jest.fn(), requestWalkingRoute: jest.fn() }));
jest.mock("../../src/services/incidentApi", () => ({ createIncident: jest.fn() }));
jest.mock("../../src/services/incidentEvidenceApi", () => ({ uploadIncidentEvidence: jest.fn() }));
jest.mock("../../src/utils/incidentEvidence", () => ({ ensureEvidencePrepared: jest.fn(async item => item) }));
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));
jest.mock("expo-sqlite", () => {
  const { DatabaseSync } = require("node:sqlite");
  const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wildguard-isolated-sqlite-"));
  let handles = [];
  return {
    openDatabaseAsync: async () => {
      const raw = new DatabaseSync(path.join(directory, "test.db")); handles.push(raw);
      const db = {
        execAsync: async sql => raw.exec(sql),
        getFirstAsync: async (sql, ...args) => raw.prepare(sql).get(...args),
        getAllAsync: async (sql, ...args) => raw.prepare(sql).all(...args),
        runAsync: async (sql, ...args) => raw.prepare(sql).run(...args),
        withExclusiveTransactionAsync: async callback => {
          raw.exec("BEGIN IMMEDIATE");
          try { const result = await callback(db); raw.exec("COMMIT"); return result; }
          catch (error) { raw.exec("ROLLBACK"); throw error; }
        },
      }; return db;
    },
    close: () => { handles.forEach(db => db.close()); handles = []; },
    cleanup: () => {
      if (!path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(directory).startsWith("wildguard-isolated-sqlite-")) throw new Error("Unsafe isolated test path");
      fs.rmSync(directory, { recursive: true });
    },
  };
});
import { configureSync, kickSync, retrySync, syncState } from "../../src/services/offlineSync";
import { getAssignedPatrol } from "../../src/services/offlinePatrol";
import { recordOfflineGps } from "../../src/services/offlineGps";
import { OfflineProvider, useOffline } from "../../src/hooks/useOffline";
import * as Network from "expo-network";
import { renderHook, waitFor, act } from "@testing-library/react-native";
import useLiveNavigation from "../../src/hooks/useLiveNavigation";
import { recordPatrolLocation, getMyPatrol, getPatrolLocations, getPatrolRiskZones, requestWalkingRoute } from "../../src/services/patrolApi";
import { createIncident } from "../../src/services/incidentApi";
import { uploadIncidentEvidence } from "../../src/services/incidentEvidenceApi";
import { ensureEvidencePrepared } from "../../src/utils/incidentEvidence";
import * as SQLite from "expo-sqlite";
import * as store from "../../src/storage/offlineStorage";
const sample = { latitude: 7.5, longitude: 80.7, accuracy: 10, recordedAt: "2026-10-08T10:00:00.000Z" };
const media = { uri: "file:///owned/photo.jpg", ownedUri: "file:///owned/photo.jpg", name: "photo.jpg", mimeType: "image/jpeg", size: 1000, uploadKey: "stable-upload-key", prepared: true };
beforeEach(async () => {
  jest.useFakeTimers(); await configureSync(null, false);
  recordPatrolLocation.mockReset().mockResolvedValue({ accepted: true });
  createIncident.mockReset().mockResolvedValue({ id: "server-incident" });
  uploadIncidentEvidence.mockReset().mockResolvedValue({ id: "server-evidence" });
  ensureEvidencePrepared.mockReset().mockImplementation(async item => item);
  const db = await store.database(); await db.execAsync("DELETE FROM evidence; DELETE FROM drafts; DELETE FROM gps; DELETE FROM patrol_cache;"); });
afterEach(async () => { await configureSync(null, false); jest.useRealTimers(); });
afterAll(() => { SQLite.close(); SQLite.cleanup(); store.resetOfflineConnection(); });
test("GPS survives closing/reopening SQLite and preserves original timestamp", async () => {
  await store.enqueueGps("r", "p", sample);
  SQLite.close(); store.resetOfflineConnection();
  expect(await store.localTrail("r", "p")).toEqual([sample]);
});
test("GPS duplicate insertion, ownership, trail order and server dedup", async () => {
  await store.enqueueGps("r", "p", sample); await store.enqueueGps("r", "p", sample);
  expect(await store.pending("r", "gps")).toHaveLength(1);
  expect(await store.localTrail("other", "p")).toEqual([]);
  const earlier = { ...sample, recordedAt: "2026-10-08T09:00:00.000Z" };
  expect(store.mergeTrail([sample], [sample, earlier])).toEqual([earlier, sample]);
});
test("draft editing and media references are transactional, scoped, and not automatically submitted", async () => {
  const id = await store.saveDraft("r", "p", null, { title: "Draft" }, null, [media]);
  expect(await store.pending("r", "evidence")).toEqual([]);
  await store.saveDraft("r", "p", id, { title: "Changed" }, null, [media]);
  expect((await store.readDraft("r", id)).form.title).toBe("Changed");
  expect((await store.readDraft("r", id)).items[0].uri).toBe(media.ownedUri);
  expect(await store.counts("r")).toEqual({ pending: 0, drafts: 1, failed: 0 });
  expect(await store.readDraft("other", id)).toBeNull();
  await expect(store.saveDraft("other", "p", id, {}, null, [])).rejects.toThrow("not available");
  await expect(store.saveDraft("r", "p", id, {}, null, Array(6).fill(media))).rejects.toThrow();
  expect((await store.readDraft("r", id)).form.title).toBe("Changed");
});
test("only interrupted own operations recover; synced records do not replay", async () => {
  await store.enqueueGps("r", "p", sample);
  const [row] = await store.pending("r", "gps");
  expect(await store.claim("r", "gps", row.id)).toBe(true);
  expect(await store.claim("r", "gps", row.id)).toBe(false);
  await store.recover("other"); expect(await store.pending("r", "gps")).toEqual([]);
  await store.recover("r"); expect(await store.pending("r", "gps")).toHaveLength(1);
  await store.finish("r", "gps", row.id, "SYNCED");
  expect(await store.pending("r", "gps")).toEqual([]);
});
test("queued evidence order and backend ID survive restart; no JWT is persisted", async () => {
  const id = await store.saveDraft("r", "p", null, { title: "Draft", token: "must-not-store" }, { title: "Valid", token: "must-not-store" }, [media, { ...media, name: "second.jpg", uploadKey: "second-key" }], true);
  await store.finish("r", "drafts", id, "PENDING_SYNC", null, 0, "server-id");
  SQLite.close(); store.resetOfflineConnection();
  const draft = await store.readDraft("r", id);
  expect(draft.server_id).toBe("server-id"); expect(draft.items.map(x => x.name)).toEqual(["photo.jpg", "second.jpg"]);
  expect(JSON.stringify(draft)).not.toContain("must-not-store");
  await expect(store.saveDraft("r", "p", id, {}, null, [])).rejects.toThrow("already attempted");
});
test("retry preserves review-blocked data and respects persisted backoff", async () => {
  await store.enqueueGps("r", "p", sample); const [row] = await store.pending("r", "gps");
  await store.finish("r", "gps", row.id, "SYNC_FAILED", "network", Date.now() + 60000);
  expect(await store.pending("r", "gps")).toEqual([]);
  await store.retryPending("r"); expect(await store.pending("r", "gps")).toEqual([]);
  jest.setSystemTime(Date.now() + 60001); expect(await store.pending("r", "gps")).toHaveLength(1);
  await store.finish("r", "gps", row.id, "NEEDS_REVIEW", "late"); await store.retryPending("r");
  expect(await store.pending("r", "gps")).toEqual([]); expect(await store.localTrail("r", "p")).toHaveLength(1);
});

test("offline GPS saves locally first; connectivity restore triggers one worker and confirms sync", async () => {
  await configureSync("r", false);
  const result = await recordOfflineGps("r", { id: "p", status: "IN_PROGRESS" }, sample);
  expect(result.savedOnDevice).toBe(true); expect(recordPatrolLocation).not.toHaveBeenCalled();
  expect(await store.localTrail("r", "p")).toEqual([sample]);
  let complete;
  recordPatrolLocation.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  const syncing = configureSync("r", true);
  while (!complete) await Promise.resolve();
  const other = kickSync(); expect(recordPatrolLocation).toHaveBeenCalledTimes(1);
  complete({ accepted: true }); await syncing; await other;
  expect(recordPatrolLocation.mock.calls[0][1]).toEqual(sample);
  expect(await store.pending("r", "gps")).toEqual([]);
});
test("incident and partial evidence sync retry reuse IDs and skip successful evidence", async () => {
  const id = await store.saveDraft("r", "p", null, {}, { title: "Report" }, [media, { ...media, uploadKey: "second" }], true);
  uploadIncidentEvidence.mockResolvedValueOnce({ id: "first" }).mockRejectedValueOnce(new Error("network"));
  await configureSync("r", true);
  let draft = await store.readDraft("r", id);
  expect(draft.server_id).toBe("server-incident"); expect(draft.items[0].status).toBe("uploaded"); expect(draft.items[1].status).toBe("failed");
  expect(createIncident.mock.calls[0][2].headers["Idempotency-Key"]).toBe(id);
  jest.setSystemTime(Date.now() + 6000); await retrySync(); draft = await store.readDraft("r", id);
  expect(createIncident).toHaveBeenCalledTimes(1); expect(uploadIncidentEvidence).toHaveBeenCalledTimes(3);
  expect(uploadIncidentEvidence.mock.calls[2][0]).toBe("server-incident"); expect(uploadIncidentEvidence.mock.calls[2][1].uploadKey).toBe("second");
  expect(draft.status).toBe("SYNCED");
});
test("401 pauses sync, account switch isolates it, and late/completed rejections remain local", async () => {
  await store.enqueueGps("r", "p", sample); recordPatrolLocation.mockRejectedValueOnce({ response: { status: 401 } });
  await configureSync("r", true); expect(syncState().paused).toBe(true);
  await retrySync(); expect(recordPatrolLocation).toHaveBeenCalledTimes(1);
  await configureSync("other", true); expect(recordPatrolLocation).toHaveBeenCalledTimes(1);
  await configureSync(null, false); await store.retryPending("r");
  recordPatrolLocation.mockRejectedValueOnce({ response: { status: 400 } });
  const id = await store.saveDraft("r", "p", null, {}, { title: "Late report" }, [], true);
  createIncident.mockRejectedValueOnce({ response: { status: 409 } });
  await configureSync("r", true);
  expect(await store.localTrail("r", "p")).toHaveLength(1); expect((await store.readDraft("r", id)).status).toBe("NEEDS_REVIEW");
});
test("429 Retry-After delays retries and invalid local media is retained for review", async () => {
  await store.enqueueGps("r", "p", sample);
  recordPatrolLocation.mockRejectedValueOnce({ response: { status: 429, headers: { "retry-after": "60" } } });
  const id = await store.saveDraft("r", "p", null, {}, {}, [media], true);
  ensureEvidencePrepared.mockRejectedValueOnce({ reselectRequired: true });
  await configureSync("r", true); await kickSync();
  expect(recordPatrolLocation).toHaveBeenCalledTimes(1);
  expect(createIncident).not.toHaveBeenCalled();
  const row = await (await store.database()).getFirstAsync("SELECT * FROM gps WHERE owner=?", "r");
  expect(row.next_at).toBeGreaterThanOrEqual(Date.now() + 60000);
  expect((await store.readDraft("r", id)).items[0].uri).toBe(media.ownedUri);
  expect(uploadIncidentEvidence).not.toHaveBeenCalled();
});

test("real navigation hook draws persisted offline orange GPS while routing/risk API is unavailable", async () => {
  await configureSync("r", false);
  getPatrolLocations.mockRejectedValue(new Error("offline")); getPatrolRiskZones.mockRejectedValue(new Error("offline"));
  const points = [{ waypointId: "start", type: "START", order: 0, latitude: 7.51, longitude: 80.7 }, { waypointId: "end", type: "END", order: 1, latitude: 7.52, longitude: 80.7 }];
  const captured = { ...sample, recordedAt: new Date().toISOString() };
  const patrol = { id: "p", status: "IN_PROGRESS", actualStartTime: new Date(Date.now() - 60000).toISOString() };
  const location = { active: true, position: { latitude: sample.latitude, longitude: sample.longitude, accuracy: 10, timestamp: Date.parse(captured.recordedAt) } };
  const hook = renderHook(() => useLiveNavigation(patrol, points, "r", location));
  await waitFor(() => expect(hook.result.current.trail).toEqual([captured]));
  expect(await store.localTrail("r", "p")).toEqual([captured]);
  expect(recordPatrolLocation).not.toHaveBeenCalled(); expect(requestWalkingRoute).not.toHaveBeenCalled();
  expect(hook.result.current.riskError).toBeTruthy(); hook.unmount();
});

test("missing queued media is retained with a reselection message, without an upload", async () => {
  const id = await store.saveDraft("r", "p", null, {}, {}, [media], true);
  ensureEvidencePrepared.mockRejectedValueOnce({ reselectRequired: true });
  await configureSync("r", true);
  const draft = await store.readDraft("r", id);
  expect(draft.items[0].status).toBe("failed"); expect(draft.items[0].error).toContain("select the file again");
  expect(draft.items[0].uri).toBe(media.uri); expect(uploadIncidentEvidence).not.toHaveBeenCalled();
});
test("an old account's interrupted response cannot pause the new account", async () => {
  await store.enqueueGps("r", "p", sample);
  let reject;
  recordPatrolLocation.mockImplementation(() => new Promise((_resolve, failure) => { reject = failure; }));
  const first = configureSync("r", true); while (!reject) await Promise.resolve();
  const switched = configureSync("other", true);
  reject({ response: { status: 401 } }); await first; await switched;
  expect(syncState().owner).toBe("other"); expect(syncState().paused).toBe(false);
  expect(await store.pending("r", "gps")).toHaveLength(1);
});
test("429 coordinator cooldown survives restart and manual retry cannot bypass it", async () => {
  await store.enqueueGps("r", "p", sample);
  recordPatrolLocation.mockRejectedValueOnce({ response: { status: 429, headers: { "retry-after": "60" } } });
  await configureSync("r", true); await retrySync(); expect(recordPatrolLocation).toHaveBeenCalledTimes(1);
  await configureSync(null, false); await configureSync("r", true); expect(recordPatrolLocation).toHaveBeenCalledTimes(1);
  jest.setSystemTime(Date.now() + 60001); await kickSync(); expect(recordPatrolLocation).toHaveBeenCalledTimes(2);
});

test("root coordinator detects network restoration and cleans up its subscriptions", async () => {
  let networkChanged; const remove = jest.fn();
  Network.getNetworkStateAsync.mockResolvedValue({ isConnected: false });
  Network.addNetworkStateListener.mockImplementation(listener => { networkChanged = listener; return { remove }; });
  const hook = renderHook(() => useOffline(), { wrapper: OfflineProvider });
  await waitFor(() => expect(syncState().owner).toBe("r"));
  await act(async () => { await recordOfflineGps("r", { id: "p", status: "IN_PROGRESS" }, sample); });
  expect(recordPatrolLocation).not.toHaveBeenCalled();
  await act(async () => { await networkChanged({ isConnected: true, isInternetReachable: true }); });
  expect(recordPatrolLocation).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(hook.result.current.pending).toBe(0));
  hook.unmount(); expect(remove).toHaveBeenCalledTimes(1); expect(syncState().owner).toBeNull();
});

test("offline patrol snapshots are owned; explicit authorization rejection never falls back to cache", async () => {
  const patrol = { id: "p", rangerId: "r", status: "IN_PROGRESS", routeName: "Isolated patrol", waypoints: [{ latitude: 7.5, longitude: 80.7 }] };
  await store.cachePatrol("r", patrol); getMyPatrol.mockReset();
  expect((await getAssignedPatrol("p", "r", undefined, true)).offlineSnapshot).toBe(true);
  expect(getMyPatrol).not.toHaveBeenCalled(); expect(await store.cachedPatrols("other")).toEqual([]);
  getMyPatrol.mockRejectedValue({ response: { status: 403 } });
  await expect(getAssignedPatrol("p", "r")).rejects.toMatchObject({ response: { status: 403 } });
});

test("a slow media upload does not starve newly captured GPS samples", async () => {
  await store.saveDraft("r", "p", null, {}, {}, [media], true);
  let uploaded;
  uploadIncidentEvidence.mockImplementation(() => new Promise(resolve => { uploaded = resolve; }));
  const syncing = configureSync("r", true); while (!uploaded) await Promise.resolve();
  await recordOfflineGps("r", { id: "p", status: "IN_PROGRESS" }, sample);
  await jest.advanceTimersByTimeAsync(15000);
  expect(recordPatrolLocation).toHaveBeenCalledTimes(1);
  uploaded({ id: "uploaded" }); await syncing;
  expect(await store.pending("r", "gps")).toEqual([]);
});

test("crash after claiming a draft preserves its payload and idempotency key until acknowledgement", async () => {
  const id = await store.saveDraft("r", "p", null, { title: "Original" }, { title: "Original" }, [], true);
  await store.claim("r", "drafts", id); await store.recover("r");
  await expect(store.saveDraft("r", "p", id, { title: "Changed" }, { title: "Changed" }, [], true)).rejects.toThrow("already attempted");
  await configureSync("r", true);
  expect(createIncident.mock.calls[0][1].title).toBe("Original"); expect(createIncident.mock.calls[0][2].headers["Idempotency-Key"]).toBe(id);
  expect((await store.readDraft("r", id)).server_id).toBe("server-incident");
});

test("private asset cleanup failure blocks automatic/manual upload retries and keeps evidence", async () => {
  const id = await store.saveDraft("r", "p", null, {}, {}, [media], true);
  uploadIncidentEvidence.mockRejectedValueOnce({ response: { status: 503, data: { code: "MEDIA_CLEANUP_FAILED" } } });
  await configureSync("r", true); await retrySync();
  expect(uploadIncidentEvidence).toHaveBeenCalledTimes(1);
  const draft = await store.readDraft("r", id);
  expect(draft.items[0].uri).toBe(media.uri); expect(draft.items[0].error).toContain("administrator");
  expect(await store.pending("r", "evidence")).toEqual([]);
});


test("queued but unattempted reports cannot become editable drafts or replace evidence", async () => {
  const id = await store.saveDraft("r", "p", null, { title: "Submitted" }, { title: "Submitted" }, [media], true);
  await expect(store.saveDraft("r", "p", id, { title: "Changed" }, null, [], false)).rejects.toThrow();
  const saved = await store.readDraft("r", id);
  expect(saved.status).toBe("PENDING_SYNC");
  expect(saved.form.title).toBe("Submitted");
  expect(saved.items).toHaveLength(1);
});
