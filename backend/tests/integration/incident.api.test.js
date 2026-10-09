const request = require("supertest");
const jwt = require("jsonwebtoken");
const {
  AsyncLocalStorage
} = require("node:async_hooks");
jest.mock("../../src/config/database", () => ({
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
  user: {
    findUnique: jest.fn()
  },
  patrol: {
    findFirst: jest.fn(),
    updateMany: jest.fn()
  },
  incident: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn()
  },
  incidentEvidence: {
    create: jest.fn(),
    deleteMany: jest.fn()
  },
  patrolLocation: {
    create: jest.fn(),
    deleteMany: jest.fn()
  },
  patrolWaypoint: {
    update: jest.fn()
  },
  riskZone: {
    update: jest.fn()
  }
}));
const db = require("../../src/config/database");
const app = require("../../src/app");
const contexts = new AsyncLocalStorage();
let users, patrol, incidents, evidence, sequence, tail, afterPatrolLock, beforeIncidentLock, completionGate, onCompletionLock, onCompletionAttempt, onMutationAttempt, events;
const token = id => "Bearer " + jwt.sign({}, process.env.JWT_SECRET, {
  subject: id,
  issuer: "wildguard-lk",
  audience: "wildguard-web",
  expiresIn: "1h"
});
const payload = extra => ({
  title: "Boundary snare",
  incidentType: "POACHING_SNARE",
  description: "Wire snare found near the boundary.",
  occurredAt: "2026-01-01T09:00:00+05:30",
  latitude: 7.5,
  longitude: 80.7,
  ...extra
});
const create = (body = payload(), who = "a", patrolId = "patrol") => request(app).post(`/api/patrols/${patrolId}/incidents`).set("Authorization", token(who)).send(body);
const patch = (body = {
  title: "Updated snare report"
}, who = "a") => request(app).patch("/api/incidents/i-1").set("Authorization", token(who)).send(body);
const withdraw = (who = "a", body = {}) => request(app).post("/api/incidents/i-1/withdraw").set("Authorization", token(who)).send(body);
const details = (who = "a") => request(app).get("/api/incidents/i-1").set("Authorization", token(who));
const list = (who = "a", query = {}) => request(app).get("/api/patrols/patrol/incidents").set("Authorization", token(who)).query(query);
const managerList = (who = "manager", query = {}) => request(app).get("/api/incidents").set("Authorization", token(who)).query(query);
const review = (status, who = "manager", incidentId = "i-1", extra) => request(app).patch(`/api/incidents/${incidentId}/status`).set("Authorization", token(who)).send({
  status,
  ...extra
});
const complete = () => request(app).post("/api/patrols/mine/patrol/complete").set("Authorization", token("a"));
const deferred = () => {
  let resolve;
  const promise = new Promise(r => {
    resolve = r;
  });
  return {
    promise,
    resolve
  };
};
async function acquire() {
  const previous = tail;
  const gate = deferred();
  tail = gate.promise;
  await previous;
  return gate.resolve;
}
function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === "OR") return value.some(item => matches(row, item));
    if (key === "patrol") return row.patrolId === patrol.id && value.is.rangerId === patrol.rangerId;
    if (key === "occurredAt" && value && !(value instanceof Date)) return row.occurredAt && (!value.gte || row.occurredAt >= value.gte) && (!value.lte || row.occurredAt <= value.lte);
    return value === null ? row[key] == null : row[key] === value;
  });
}
function project(row, select) {
  if (!row) return null;
  const result = Object.fromEntries(Object.entries(select).filter(([, value]) => value === true).map(([key]) => [key, row[key]]));
  const identity = user => user ? {
    id: user.id,
    name: user.name
  } : null;
  if (select.reporter) result.reporter = identity(users[row.reporterId]);
  if (select.park) result.park = {
    id: row.parkId,
    name: "Confirmed Park"
  };
  if (select.patrol) result.patrol = row.patrolId ? {
    id: patrol.id,
    routeName: patrol.routeName,
    status: patrol.status,
    ranger: identity(users[patrol.rangerId])
  } : null;
  const media = evidence.filter(item => item.incidentId === row.id);
  if (select._count) result._count = {
    evidence: media.length
  };
  if (select.evidence) result.evidence = media.map(item => Object.fromEntries(Object.entries(select.evidence.select).filter(([, v]) => v === true).map(([key]) => [key, item[key]])));
  return result;
}
function seed() {
  const row = {
    id: "i-1",
    ...payload(),
    occurredAt: new Date(payload().occurredAt),
    reportedAt: new Date("2026-01-01T04:00:00Z"),
    status: "PENDING",
    syncStatus: "SYNCED",
    reporterId: "a",
    patrolId: "patrol",
    parkId: "park",
    withdrawnAt: null,
    manualLocation: null,
    createdAt: new Date("2026-01-01T04:00:00Z"),
    updatedAt: new Date("2026-01-01T04:00:00Z")
  };
  incidents.set(row.id, row);
  sequence = 1;
  return row;
}
beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = "isolated-incident-api-test-secret-at-least-32-chars";
  users = Object.fromEntries(["a", "b", "manager", "other"].map(id => [id, {
    id,
    name: id,
    role: id === "manager" ? "PARK_MANAGER" : id === "other" ? "RESEARCHER" : "RANGER",
    approvalStatus: "APPROVED",
    isActive: true,
    passwordHash: "NEVER_EXPOSE"
  }]));
  patrol = {
    id: "patrol",
    routeName: "Boundary patrol",
    status: "IN_PROGRESS",
    rangerId: "a",
    parkId: "park",
    updatedAt: new Date("2026-01-01"),
    actualStartTime: new Date("2026-01-01")
  };
  incidents = new Map();
  evidence = [];
  sequence = 0;
  tail = Promise.resolve();
  events = [];
  afterPatrolLock = beforeIncidentLock = completionGate = onCompletionLock = onCompletionAttempt = onMutationAttempt = null;
  db.user.findUnique.mockImplementation(async ({
    where
  }) => users[where.id] || null);
  db.patrol.findFirst.mockImplementation(async ({
    where
  }) => where.id === patrol.id && (!where.rangerId || where.rangerId === patrol.rangerId) ? {
    ...patrol
  } : null);
  db.$transaction.mockImplementation(callback => contexts.run({
    releases: [],
    undo: []
  }, async () => {
    const context = contexts.getStore();
    try {
      const result = await callback(db);
      events.push("incident-commit");
      return result;
    } catch (error) {
      for (const undo of context.undo.reverse()) undo();
      throw error;
    } finally {
      for (const release of context.releases.reverse()) release();
    }
  }));
  db.$queryRaw.mockImplementation(async (sql, ...values) => {
    if (sql.join("?").includes('FROM "Patrol"')) {
      onMutationAttempt?.();
      contexts.getStore().releases.push(await acquire());
      if (afterPatrolLock) {
        const action = afterPatrolLock;
        afterPatrolLock = null;
        await action();
      }
      return values[0] === patrol.id && values[1] === patrol.rangerId ? [{
        ...patrol
      }] : [];
    }
    beforeIncidentLock?.();
    beforeIncidentLock = null;
    const row = incidents.get(values[0]);
    return row && row.patrolId === values[1] && row.reporterId === values[2] ? [{
      ...row
    }] : [];
  });
  db.incident.findFirst.mockImplementation(async ({
    where,
    select
  }) => project([...incidents.values()].find(row => matches(row, where)), select));
  db.incident.findMany.mockImplementation(async ({
    where,
    select,
    skip,
    take
  }) => [...incidents.values()].filter(row => matches(row, where)).sort((a, b) => (b.occurredAt?.getTime() ?? -Infinity) - (a.occurredAt?.getTime() ?? -Infinity) || b.createdAt - a.createdAt || b.id.localeCompare(a.id)).slice(skip, skip + take).map(row => project(row, select)));
  db.incident.count.mockImplementation(async ({
    where
  }) => [...incidents.values()].filter(row => matches(row, where)).length);
  db.incident.create.mockImplementation(async ({
    data,
    select
  }) => {
    const row = {
      id: "i-" + ++sequence,
      withdrawnAt: null,
      manualLocation: null,
      reportedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data
    };
    incidents.set(row.id, row);
    contexts.getStore().undo.push(() => incidents.delete(row.id));
    return project(row, select);
  });
  db.incident.updateMany.mockImplementation(async ({
    where,
    data
  }) => {
    const row = [...incidents.values()].find(item => matches(item, where));
    if (!row) return {
      count: 0
    };
    const previous = {
      ...row
    };
    contexts.getStore().undo.push(() => incidents.set(row.id, previous));
    Object.assign(row, data, {
      updatedAt: new Date()
    });
    return {
      count: 1
    };
  });
  db.patrol.updateMany.mockImplementation(async ({
    where,
    data
  }) => {
    onCompletionAttempt?.();
    const release = await acquire();
    try {
      onCompletionLock?.();
      if (completionGate) await completionGate;
      if (where.id !== patrol.id || where.rangerId !== patrol.rangerId || where.status !== patrol.status || where.updatedAt && +where.updatedAt !== +patrol.updatedAt) return {
        count: 0
      };
      Object.assign(patrol, data);
      events.push("patrol-completed");
      return {
        count: 1
      };
    } finally {
      release();
    }
  });
});
afterEach(() => {
  expect(db.incident.delete).not.toHaveBeenCalled();
  expect(db.incident.deleteMany).not.toHaveBeenCalled();
  expect(db.incidentEvidence.create).not.toHaveBeenCalled();
  expect(db.incidentEvidence.deleteMany).not.toHaveBeenCalled();
  expect(db.patrolLocation.create).not.toHaveBeenCalled();
  expect(db.patrolLocation.deleteMany).not.toHaveBeenCalled();
  expect(db.patrolWaypoint.update).not.toHaveBeenCalled();
  expect(db.riskZone.update).not.toHaveBeenCalled();
});
test("multiple distinct incidents reference the same patrol with server-derived identity", async () => {
  const before = JSON.stringify(patrol);
  const ids = [];
  for (const type of ["POACHING_SNARE", "ILLEGAL_CAMPSITE", "WILDLIFE_CONFLICT", "ANIMAL_CARCASS"]) {
    const response = await create(payload({
      incidentType: type
    })).expect(201);
    expect(response.body.incident).toMatchObject({
      patrolId: "patrol",
      parkId: "park",
      reporterId: "a",
      status: "PENDING",
      withdrawn: false
    });
    ids.push(response.body.incident.id);
    expect(response.body.incident.evidence).toEqual([]);
  }
  expect(new Set(ids).size).toBe(4);
  expect(incidents.size).toBe(4);
  expect(JSON.stringify(patrol)).toBe(before);
});
test("wrong Ranger cannot create, list, read, edit or withdraw another Ranger's report", async () => {
  seed();
  await create(payload(), "b").expect(404);
  await list("b").expect(404);
  await details("b").expect(404);
  await patch(undefined, "b").expect(404);
  await withdraw("b").expect(404);
  expect(db.incident.create).not.toHaveBeenCalled();
  expect(db.incident.updateMany).not.toHaveBeenCalled();
});
test("reassignment revokes access; new Ranger cannot impersonate the original reporter", async () => {
  seed();
  patrol.rangerId = "b";
  await details("a").expect(404);
  await details("b").expect(404);
  const res = await list("b").expect(200);
  expect(res.body.incidents).toEqual([]);
  await details("manager").expect(200);
});
test.each(["SCHEDULED", "COMPLETED", "CANCELLED"])("%s blocks every mutation and preserves authorized reads", async status => {
  seed();
  patrol.status = status;
  await create().expect(409);
  await patch().expect(409);
  await withdraw().expect(409);
  await details().expect(200);
  await list().expect(200);
  expect(db.incident.create).not.toHaveBeenCalled();
  expect(db.incident.updateMany).not.toHaveBeenCalled();
});
test.each(["PENDING", "REJECTED", "inactive"])("%s Ranger and Manager accounts cannot access incidents", async restriction => {
  seed();
  for (const id of ["a", "manager"]) {
    if (restriction === "inactive") users[id].isActive = false;else users[id].approvalStatus = restriction;
    for (const action of [() => create(payload(), id), () => list(id), () => details(id), () => patch(undefined, id), () => withdraw(id), () => managerList(id)]) {
      const response = await action();
      expect([401, 403]).toContain(response.status);
    }
  }
  expect(db.incident.create).not.toHaveBeenCalled();
});
test("manager reads only; other roles and anonymous sessions are denied", async () => {
  seed();
  await create(payload(), "manager").expect(403);
  await patch(undefined, "manager").expect(403);
  await withdraw("manager").expect(403);
  for (const id of ["a", "b", "other"]) await managerList(id).expect(403);
  await details("other").expect(403);
  await create(payload(), "other").expect(403);
  await request(app).get("/api/incidents").expect(401);
  await request(app).post("/api/patrols/patrol/incidents").send(payload()).expect(401);
});
test("invalid input and mass assignment never write", async () => {
  seed();
  for (const change of [{
    latitude: null
  }, {
    longitude: 181
  }, {
    incidentType: "UNKNOWN"
  }, {
    reporterId: "b"
  }, {
    status: "VERIFIED"
  }, {
    occurredAt: "invalid"
  }]) await create(payload(change)).expect(400);
  for (const field of ["id", "patrolId", "reporterId", "parkId", "status", "withdrawnAt", "createdAt", "syncStatus", "severity"]) await patch({
    title: "Safe title",
    [field]: "forged"
  }).expect(400);
  await withdraw("a", {
    withdrawnAt: "forged"
  }).expect(400);
  expect(db.incident.updateMany).not.toHaveBeenCalled();
});
test("pagination is stable, newest first and withdrawn rows require an explicit history query", async () => {
  for (let n = 0; n < 27; n++) await create(payload({
    title: "Incident " + n,
    occurredAt: "2026-01-" + String(n + 1).padStart(2, "0") + "T00:00:00Z"
  })).expect(201);
  incidents.get("i-1").withdrawnAt = new Date();
  const first = await list().expect(200),
    second = await list("a", {
      page: "2"
    }).expect(200);
  expect(first.body).toMatchObject({
    total: 26,
    page: 1,
    pageSize: 25
  });
  expect(second.body.incidents).toHaveLength(1);
  expect(first.body.incidents[0].id).toBe("i-27");
  expect(second.body.incidents[0].id).toBe("i-2");
  const history = await list("a", {
    includeWithdrawn: "true",
    page: "2"
  }).expect(200);
  expect(history.body.total).toBe(27);
  expect(history.body.incidents.some(row => row.id === "i-1" && row.withdrawn)).toBe(true);
  const query = db.incident.findMany.mock.calls[0][0];
  expect(query.orderBy).toEqual([{
    occurredAt: {
      sort: "desc",
      nulls: "last"
    }
  }, {
    createdAt: "desc"
  }, {
    id: "desc"
  }]);
});
test("safe editing preserves ownership, status and evidence; withdrawal retains record and media", async () => {
  seed();
  evidence.push({
    id: "e-1",
    incidentId: "i-1",
    fileUrl: "https://media.example/photo.jpg",
    fileType: "PHOTO",
    caption: "Existing photo",
    metadata: null,
    createdAt: new Date()
  });
  await patch({
    title: "Updated title",
    latitude: 0,
    longitude: 0,
    description: "Updated description"
  }).expect(200);
  expect(incidents.get("i-1")).toMatchObject({
    reporterId: "a",
    patrolId: "patrol",
    status: "PENDING",
    latitude: 0,
    longitude: 0
  });
  const response = await withdraw().expect(200);
  const withdrawnAt = response.body.incident.withdrawnAt;
  expect(withdrawnAt).toBeTruthy();
  expect(response.body.incident.withdrawn).toBe(true);
  expect(incidents.size).toBe(1);
  expect(evidence).toHaveLength(1);
  await withdraw().expect(409);
  await patch().expect(409);
  expect(incidents.get("i-1").withdrawnAt.toISOString()).toBe(withdrawnAt);
  await details().expect(200);
  expect((await list().expect(200)).body.incidents).toEqual([]);
});
test.each(["UNDER_REVIEW", "VERIFIED", "REJECTED"])("%s incidents are locked even on active patrols", async status => {
  seed().status = status;
  await patch().expect(409);
  await withdraw().expect(409);
  await details().expect(200);
});
test("review changes while edit is waiting are rechecked under lock", async () => {
  seed();
  beforeIncidentLock = () => {
    incidents.get("i-1").status = "UNDER_REVIEW";
  };
  await patch().expect(409);
  expect(db.incident.updateMany).not.toHaveBeenCalled();
});
test("guarded update conflict and internal failure are safe and atomic", async () => {
  seed();
  db.incident.updateMany.mockResolvedValueOnce({
    count: 0
  });
  const conflict = await patch().expect(409);
  expect(conflict.body.code).toBe("INCIDENT_CHANGED");
  const original = {
    ...incidents.get("i-1")
  };
  db.incident.findFirst.mockImplementationOnce(async ({
    select
  }) => project(original, select)).mockRejectedValueOnce(new Error("private-database-connection-credential"));
  const failed = await patch().expect(500);
  expect(failed.body.message).toBe("Internal server error");
  expect(JSON.stringify(failed.body)).not.toContain("private-database");
  expect(incidents.get("i-1")).toEqual(original);
});
test("manager filters and safe details support existing and withdrawn history", async () => {
  seed();
  const filtered = await managerList("manager", {
    patrolId: "patrol",
    rangerId: "a",
    parkId: "park",
    incidentType: "POACHING_SNARE",
    status: "PENDING",
    from: "2026-01-01T00:00:00Z",
    to: "2026-01-02T00:00:00Z"
  }).expect(200);
  expect(filtered.body.total).toBe(1);
  expect(filtered.body.incidents[0]).toMatchObject({
    patrol: {
      id: "patrol",
      routeName: "Boundary patrol",
      ranger: {
        id: "a"
      }
    },
    reporter: {
      id: "a"
    },
    park: {
      id: "park"
    },
    evidenceCount: 0
  });
  expect(JSON.stringify(filtered.body)).not.toContain("NEVER_EXPOSE");
  expect((await managerList("manager", {
    rangerId: "b"
  }).expect(200)).body.total).toBe(0);
  incidents.get("i-1").withdrawnAt = new Date();
  expect((await managerList().expect(200)).body.total).toBe(0);
  expect((await managerList("manager", {
    includeWithdrawn: "true"
  }).expect(200)).body.total).toBe(1);
  await details("manager").expect(200);
});
test("unconfigured storage rejects evidence without fake rows; reads support multiple sanitized references", async () => {
  const media = {
    uploadId: "uploaded-object",
    fileType: "VIDEO",
    metadata: {
      source: "CAMERA_TRAP",
      originalFileName: "footage.mp4",
      mimeType: "video/mp4",
      fileSize: 2048,
      cameraTrapId: "camera-1"
    }
  };
  const unavailable = await create(payload({
    evidence: [media, media]
  })).expect(409);
  expect(unavailable.body.code).toBe("EVIDENCE_UPLOAD_REQUIRED");
  expect(incidents.size).toBe(0);
  await create(payload({
    evidence: [{
      ...media,
      fileUrl: "https://unverified.example/video.mp4"
    }]
  })).expect(400);
  seed();
  evidence.push({
    id: "e-1",
    incidentId: "i-1",
    fileUrl: "https://media.example/video.mp4?secret=storage-token",
    fileType: "VIDEO",
    metadata: media.metadata,
    createdAt: new Date()
  }, {
    id: "e-2",
    incidentId: "i-1",
    fileUrl: "https://user:password@media.example/photo.jpg",
    fileType: "PHOTO",
    metadata: {
      privateKey: "DO_NOT_EXPOSE"
    },
    createdAt: new Date()
  });
  const response = await details("manager").expect(200);
  expect(response.body.incident.evidenceCount).toBe(2);
  expect(response.body.incident.evidence).toHaveLength(2);
  expect(response.body.incident.evidence[0]).toMatchObject({
    fileUrl: null,
    metadata: {
      source: "CAMERA_TRAP"
    }
  });
  expect(response.body.incident.evidence[1].fileUrl).toBeNull();
  expect(JSON.stringify(response.body)).not.toMatch(/storage-token|password@|DO_NOT_EXPOSE/);
});
test("missing resources and legacy unlinked reports have predictable behavior", async () => {
  await create(payload(), "a", "missing").expect(404);
  await details().expect(404);
  await patch().expect(404);
  seed().patrolId = null;
  await details().expect(200);
  await details("manager").expect(200);
  await patch().expect(409);
  await withdraw().expect(409);
});
test.each(["create", "edit", "withdraw"])("completion winning before %s mutation rejects without a write", async action => {
  seed();
  const locked = deferred(),
    release = deferred(),
    attempt = deferred();
  onCompletionLock = locked.resolve;
  completionGate = release.promise;
  const completing = complete().then(response => response);
  await locked.promise;
  onMutationAttempt = attempt.resolve;
  const changing = (action === "create" ? create() : action === "edit" ? patch() : withdraw()).then(response => response);
  await attempt.promise;
  release.resolve();
  expect((await completing).status).toBe(200);
  const response = await changing;
  expect(response.status).toBe(409);
  expect(response.body.code).toBe("PATROL_NOT_ACTIVE");
  expect(incidents.size).toBe(1);
  expect(db.incident.create).not.toHaveBeenCalled();
  expect(db.incident.updateMany).not.toHaveBeenCalled();
});
test.each(["create", "edit", "withdraw"])("%s mutation holding the row lock commits before waiting completion", async action => {
  seed();
  const locked = deferred(),
    release = deferred(),
    attempt = deferred();
  afterPatrolLock = async () => {
    locked.resolve();
    await release.promise;
  };
  const changing = (action === "create" ? create() : action === "edit" ? patch() : withdraw()).then(response => response);
  await locked.promise;
  onCompletionAttempt = attempt.resolve;
  const completing = complete().then(response => response);
  await attempt.promise;
  release.resolve();
  expect((await changing).status).toBe(action === "create" ? 201 : 200);
  expect((await completing).status).toBe(200);
  expect(events.indexOf("incident-commit")).toBeLessThan(events.indexOf("patrol-completed"));
  expect(patrol.status).toBe("COMPLETED");
  await patch().expect(409);
  await withdraw().expect(409);
});

test("Park Manager reviews a Ranger incident end to end and the status persists", async () => {
  await create(payload(), "a").expect(201);
  evidence.push({
    id: "e-1",
    incidentId: "i-1",
    fileUrl: "https://media.example/snare.jpg",
    fileType: "PHOTO",
    caption: "Snare photo",
    metadata: {
      source: "PHONE_CAMERA",
      originalFileName: "snare.jpg",
      mimeType: "image/jpeg",
      fileSize: 2048
    },
    createdAt: new Date("2026-01-01T04:10:00Z")
  });
  const listed = await managerList().expect(200);
  expect(listed.body.incidents).toHaveLength(1);
  expect(listed.body.incidents[0]).toMatchObject({
    id: "i-1",
    status: "PENDING",
    reporter: {
      id: "a",
      name: "a"
    },
    evidenceCount: 1
  });
  const updated = await review("UNDER_REVIEW").expect(200);
  expect(updated.body.incident).toMatchObject({
    id: "i-1",
    status: "UNDER_REVIEW",
    patrolId: "patrol",
    reporter: {
      id: "a"
    },
    evidenceCount: 1
  });
  expect(updated.body.incident.evidence[0]).toMatchObject({
    id: "e-1",
    fileType: "PHOTO",
    caption: "Snare photo",
    fileUrl: null,
    metadata: {
      source: "PHONE_CAMERA",
      originalFileName: "snare.jpg"
    }
  });
  expect(db.incident.updateMany).toHaveBeenCalledWith({
    where: {
      id: "i-1",
      withdrawnAt: null
    },
    data: {
      status: "UNDER_REVIEW"
    }
  });
  expect((await details("manager")).body.incident.status).toBe("UNDER_REVIEW");
  expect((await managerList()).body.incidents[0].status).toBe("UNDER_REVIEW");
  expect((await details("a")).body.incident.status).toBe("UNDER_REVIEW");
});
test.each(["RESPONDING", "RESOLVED", "in review", "IN_REVIEW", "", "PENDING,UNDER_REVIEW"])("unsupported status %s is rejected without writing", async status => {
  await create(payload(), "a").expect(201);
  const response = await review(status);
  expect(response.status).toBe(400);
  expect(response.body.errors.status).toBeTruthy();
  expect(db.incident.updateMany).not.toHaveBeenCalled();
  expect(incidents.get("i-1").status).toBe("PENDING");
});
test("manager status update rejects unknown fields and never writes them", async () => {
  await create(payload(), "a").expect(201);
  await review("VERIFIED", "manager", "i-1", {
    reporterId: "b"
  }).expect(400);
  await review("VERIFIED", "manager", "i-1", {
    withdrawnAt: "forged"
  }).expect(400);
  await request(app).patch("/api/incidents/i-1/status").set("Authorization", token("manager")).expect(400);
  expect(db.incident.updateMany).not.toHaveBeenCalled();
  expect(incidents.get("i-1").status).toBe("PENDING");
});
test("only approved Park Managers may change incident status", async () => {
  await create(payload(), "a").expect(201);
  for (const who of ["a", "b", "other"]) await review("UNDER_REVIEW", who).expect(403);
  await request(app).patch("/api/incidents/i-1/status").send({
    status: "UNDER_REVIEW"
  }).expect(401);
  await review("UNDER_REVIEW", "manager", "missing-id").expect(404);
  expect(db.incident.updateMany).not.toHaveBeenCalled();
  expect(incidents.get("i-1").status).toBe("PENDING");
});
test("withdrawn reports stay read-only for review", async () => {
  await create(payload(), "a").expect(201);
  await withdraw("a").expect(200);
  await review("VERIFIED").expect(409);
  expect(incidents.get("i-1").status).toBe("PENDING");
});
test("review still works after the patrol finishes while Ranger edits stay locked", async () => {
  await create(payload(), "a").expect(201);
  await complete().expect(200);
  expect(patrol.status).toBe("COMPLETED");
  await patch().expect(409);
  await review("VERIFIED").expect(200);
  expect((await details("manager")).body.incident.status).toBe("VERIFIED");
  expect((await details("a")).body.incident.status).toBe("VERIFIED");
});
test("status changes follow the existing Incident lifecycle values only", async () => {
  await create(payload(), "a").expect(201);
  for (const status of ["UNDER_REVIEW", "VERIFIED", "REJECTED"]) await review(status).expect(200);
  expect(incidents.get("i-1").status).toBe("REJECTED");
  expect((await details("manager")).body.incident.status).toBe("REJECTED");
});
