const {
  validateIncident,
  validateFilters,
  validateEvidence,
  validateMetadata
} = require("../../../src/validators/incident.validator");
const payload = () => ({
  title: "Boundary snare",
  incidentType: "POACHING_SNARE",
  description: "Snare found near the boundary.",
  occurredAt: "2026-01-01T09:00:00+05:30",
  latitude: 7.5,
  longitude: 80.7
});
const evidence = () => ({
  uploadId: "uploaded-object",
  fileType: "VIDEO",
  metadata: {
    source: "CAMERA_TRAP",
    originalFileName: "footage.mp4",
    mimeType: "video/mp4",
    fileSize: 2048,
    capturedAt: "2026-01-01T08:00:00Z",
    cameraTrapId: "camera-1",
    notes: "Imported manually"
  }
});
test("all four explicit types retain their meaning", () => {
  for (const type of ["POACHING_SNARE", "ILLEGAL_CAMPSITE", "WILDLIFE_CONFLICT", "ANIMAL_CARCASS"]) expect(validateIncident({
    ...payload(),
    incidentType: type
  })).toMatchObject({
    incidentType: type,
    evidence: [],
    occurredAt: expect.any(Date)
  });
});
test.each([null, [], {}, {
  ...payload(),
  title: "a"
}, {
  ...payload(),
  incidentType: "FIRE"
}, {
  ...payload(),
  occurredAt: "2026-02-30T00:00:00Z"
}, {
  ...payload(),
  occurredAt: "2030-01-01T00:00:00Z"
}, {
  ...payload(),
  occurredAt: "2026-01-01"
}, {
  ...payload(),
  occurredAt: "2026-01-01T24:00:00Z"
}, {
  ...payload(),
  latitude: null
}, {
  ...payload(),
  longitude: "80.7"
}, {
  ...payload(),
  latitude: 91
}, {
  ...payload(),
  longitude: -181
}])("rejects invalid creation input %#", input => {
  expect(() => validateIncident(input)).toThrow();
});
test.each(["reporterId", "parkId", "patrolId", "status", "withdrawnAt", "createdAt", "severity", "notes", "id", "syncStatus"])("rejects client-owned field %s", field => {
  expect(() => validateIncident({
    ...payload(),
    [field]: "forged"
  })).toThrow();
  expect(() => validateIncident({
    title: "Safe title",
    [field]: "forged"
  }, true)).toThrow();
});
test("patch is explicit, supports clearing manual location and requires GPS pairs", () => {
  expect(validateIncident({
    title: "Updated title",
    manualLocation: null
  }, true)).toEqual({
    title: "Updated title",
    manualLocation: null
  });
  expect(() => validateIncident({}, true)).toThrow();
  expect(() => validateIncident({
    latitude: 0
  }, true)).toThrow();
  expect(validateIncident({
    latitude: 0,
    longitude: 0
  }, true)).toEqual({
    latitude: 0,
    longitude: 0
  });
});
test("string allowlists reject coerced arrays and inherited object keys", () => {
  expect(() => validateIncident({
    ...payload(),
    incidentType: ["POACHING_SNARE"]
  })).toThrow();
  expect(() => validateFilters({
    incidentType: ["POACHING_SNARE"]
  }, true)).toThrow();
  expect(() => validateMetadata({
    ...evidence().metadata,
    mimeType: "constructor"
  })).toThrow();
});
test("multiple photo/video metadata foundations include imported camera footage", () => {
  const photo = {
    ...evidence(),
    fileType: "PHOTO",
    metadata: {
      ...evidence().metadata,
      source: "PHONE_CAMERA",
      mimeType: "image/jpeg",
      originalFileName: "photo.jpg"
    }
  };
  expect(validateEvidence([photo, evidence()])).toHaveLength(2);
});
test.each([item => ({
  ...item,
  fileUrl: "https://unverified.example/file.mp4"
}), item => ({
  ...item,
  fileType: "PHOTO"
}), item => ({
  ...item,
  metadata: {
    ...item.metadata,
    bytes: "binary"
  }
}), item => ({
  ...item,
  metadata: {
    ...item.metadata,
    source: "DEVICE_STREAM"
  }
}), item => ({
  ...item,
  metadata: {
    ...item.metadata,
    mimeType: "application/javascript"
  }
}), item => ({
  ...item,
  metadata: {
    ...item.metadata,
    fileSize: -1
  }
}), item => ({
  ...item,
  metadata: {
    ...item.metadata,
    fileSize: 600 * 1024 * 1024
  }
}), item => ({
  ...item,
  metadata: {
    ...item.metadata,
    fileSize: 1.2
  }
}), item => ({
  ...item,
  metadata: {
    ...item.metadata,
    notes: "a".repeat(1001)
  }
}), item => ({
  ...item,
  metadata: {
    ...item.metadata,
    capturedAt: "bad"
  }
})])("rejects unsafe evidence metadata %#", change => expect(() => validateEvidence([change(evidence())])).toThrow());
test("metadata and evidence count are bounded", () => {
  expect(() => validateMetadata({
    ...evidence().metadata,
    notes: "💚".repeat(1000)
  })).toThrow();
  expect(() => validateEvidence(Array.from({
    length: 21
  }, evidence))).toThrow();
});
test("manager filters map Ranger to reporter and keep withdrawn history optional", () => {
  const result = validateFilters({
    page: "2",
    patrolId: "p",
    rangerId: "r",
    parkId: "park",
    incidentType: "ANIMAL_CARCASS",
    status: "PENDING",
    from: "2026-01-01T00:00:00Z",
    to: "2026-02-01T00:00:00Z",
    includeWithdrawn: "true"
  }, true);
  expect(result).toMatchObject({
    page: 2,
    where: {
      patrolId: "p",
      reporterId: "r",
      parkId: "park",
      incidentType: "ANIMAL_CARCASS",
      status: "PENDING",
      occurredAt: {
        gte: expect.any(Date),
        lte: expect.any(Date)
      }
    }
  });
  expect(result.where.withdrawnAt).toBeUndefined();
  expect(validateFilters({}).where.withdrawnAt).toBeNull();
});
test.each([{
  page: "0"
}, {
  page: []
}, {
  status: "WITHDRAWN"
}, {
  includeWithdrawn: "yes"
}, {
  from: "2026-03-01T00:00:00Z",
  to: "2026-02-01T00:00:00Z"
}, {
  reporterId: "forged"
}])("rejects invalid manager filters %#", query => expect(() => validateFilters(query, true)).toThrow());
