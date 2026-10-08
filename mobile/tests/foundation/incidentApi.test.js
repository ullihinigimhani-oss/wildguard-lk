import { api } from "../../src/services/api";
import {
  createIncident,
  editIncident,
  getIncident,
  listPatrolIncidents,
  withdrawIncident,
} from "../../src/services/incidentApi";
import {
  canChangeIncident,
  dateFields,
  formFor,
  freshFix,
  incidentError,
  validateForm,
  INCIDENT_TYPES,
} from "../../src/utils/incident";
jest.mock("../../src/services/api", () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));
const record = {
  id: "i",
  reporterId: "r",
  status: "PENDING",
  patrol: { status: "IN_PROGRESS", ranger: { id: "r" } },
};
const body = {
  title: "Found snare",
  description: "Wire snare near the path",
  incidentType: "POACHING_SNARE",
  occurredAt: "2026-01-01T10:00:00+05:30",
  latitude: 7.2,
  longitude: 80.2,
};
beforeEach(() => {
  api.get.mockResolvedValue({ data: { success: true, incident: record } });
  api.post.mockResolvedValue({ data: { success: true, incident: record } });
  api.patch.mockResolvedValue({ data: { success: true, incident: record } });
});
test("create uses real patrol endpoint and text-only payload without identity or evidence fields", async () => {
  expect(await createIncident("p/a", body)).toEqual(record);
  expect(api.post).toHaveBeenCalledWith("/patrols/p%2Fa/incidents", body);
  expect(body).not.toHaveProperty("reporterId");
  expect(body).not.toHaveProperty("evidence");
});
test("edit and soft withdrawal target same incident, never delete or create", async () => {
  await editIncident("i/a", body);
  await withdrawIncident("i/a");
  expect(api.patch).toHaveBeenCalledWith("/incidents/i%2Fa", body);
  expect(api.post).toHaveBeenCalledWith("/incidents/i%2Fa/withdraw", {});
});
test("detail and paginated history use authenticated shared client and cancellation signal", async () => {
  const signal = new AbortController().signal;
  await getIncident("i", signal);
  expect(api.get).toHaveBeenCalledWith("/incidents/i", { signal });
  const page = {
    success: true,
    incidents: [record],
    total: 1,
    page: 2,
    pageSize: 25,
  };
  api.get.mockResolvedValue({ data: page });
  expect(
    await listPatrolIncidents("p", { page: 2, includeWithdrawn: true, signal }),
  ).toEqual(page);
  expect(api.get).toHaveBeenLastCalledWith("/patrols/p/incidents", {
    signal,
    params: { page: "2", includeWithdrawn: "true" },
  });
});
test("unconfirmed create cannot display success", async () => {
  api.post.mockResolvedValue({ data: { success: true } });
  await expect(createIncident("p", body)).rejects.toThrow("did not confirm");
});
test.each(["SCHEDULED", "COMPLETED", "CANCELLED"])(
  "%s incidents cannot be changed",
  (status) => {
    expect(
      canChangeIncident(
        { ...record, patrol: { ...record.patrol, status } },
        "r",
      ),
    ).toBe(false);
  },
);
test.each(["UNDER_REVIEW", "RESPONDING", "RESOLVED"])(
  "%s review locks editing",
  (status) => expect(canChangeIncident({ ...record, status }, "r")).toBe(false),
);
test("only assigned owner pending active report can change; withdrawn and legacy reports read-only", () => {
  expect(canChangeIncident(record, "r")).toBe(true);
  expect(canChangeIncident(record, "other")).toBe(false);
  expect(canChangeIncident({ ...record, withdrawnAt: "2026-01-01" }, "r")).toBe(
    false,
  );
  expect(canChangeIncident({ ...record, patrol: null }, "r")).toBe(false);
  expect(
    canChangeIncident(
      { ...record, patrol: { ...record.patrol, ranger: { id: "other" } } },
      "r",
    ),
  ).toBe(false);
});
test("validated codes, required fields, finite coordinates and occurrence time match backend", () => {
  expect(INCIDENT_TYPES.map((t) => t.code)).toEqual([
    "POACHING_SNARE",
    "ILLEGAL_CAMPSITE",
    "WILDLIFE_CONFLICT",
    "ANIMAL_CARCASS",
  ]);
  const form = {
    ...formFor(),
    title: body.title,
    description: body.description,
    incidentType: body.incidentType,
    date: "2026-01-01",
    time: "10:00",
    latitude: "7.2",
    longitude: "80.2",
  };
  expect(validateForm(form)).toEqual({ errors: {}, body });
  expect(Object.keys(validateForm(formFor()).errors)).toEqual(
    expect.arrayContaining([
      "title",
      "description",
      "incidentType",
      "latitude",
      "longitude",
    ]),
  );
  for (const overrides of [
    { date: "2026-02-30" },
    { time: "25:00" },
    { date: "2999-01-01" },
    { latitude: " " },
    { longitude: "Infinity" },
    { latitude: "91" },
  ])
    expect(
      Object.keys(validateForm({ ...form, ...overrides }).errors).length,
    ).toBeGreaterThan(0);
  expect(dateFields("2026-01-01T04:30:00Z")).toEqual({
    date: "2026-01-01",
    time: "10:00",
  });
  expect(formFor({ occurredAt: null }).date).toBe("");
});
test("GPS rejects stale, inaccurate and invalid fixes", () => {
  const fix = {
    latitude: 7,
    longitude: 80,
    accuracy: 10,
    timestamp: Date.now(),
  };
  expect(freshFix(fix)).toBe(true);
  for (const overrides of [
    { timestamp: Date.now() - 31000 },
    { accuracy: 101 },
    { accuracy: null },
    { latitude: NaN },
  ])
    expect(freshFix({ ...fix, ...overrides })).toBe(false);
});
test.each([400, 401, 403, 404, 409, 503, undefined])(
  "friendly API error %s never exposes server internals",
  (status) => {
    const message = incidentError({
      response: { status, data: { message: "private server details" } },
    });
    expect(message.length).toBeGreaterThan(20);
    expect(message).not.toContain("private");
  },
);
