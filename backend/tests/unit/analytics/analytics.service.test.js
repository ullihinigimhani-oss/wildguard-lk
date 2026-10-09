// Verifies the aggregation logic against known in-memory records: the exact
// number of rows returned by the database is the exact number reported, and
// time series must bucket/zero-fill exactly as documented.
const service = require("../../../src/services/analytics.service");
const { _internal } = service;

jest.mock("../../../src/repositories/analytics.repository");
const repository = require("../../../src/repositories/analytics.repository");

const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const at = (iso) => new Date(iso);
const incidentRow = (over = {}) => ({
  status: "PENDING",
  incidentType: "POACHING_SNARE",
  reportedAt: at("2026-10-08T04:00:00.000Z"),
  manualLocation: "Weerawila",
  ...over,
});
const patrolRow = (over = {}) => ({
  status: "SCHEDULED",
  patrolType: "ROUTINE",
  priority: "MEDIUM",
  scheduledDate: at("2026-10-01T00:00:00.000Z"),
  actualStartTime: null,
  createdAt: at("2026-09-28T02:00:00.000Z"),
  startLocation: "Bundala gate",
  ...over,
});
const reportRow = (over = {}) => ({
  status: "PENDING",
  reportType: "WILDLIFE_SIGHTING",
  submittedAt: at("2026-10-06T10:00:00.000Z"),
  manualLocation: "Kataragama North",
  ...over,
});

const manager = { id: "manager", role: "PARK_MANAGER", parkId: "park-1" };

beforeEach(() => {
  jest.clearAllMocks();
  repository.findIncidentsForAnalytics.mockResolvedValue([]);
  repository.findPatrolsForAnalytics.mockResolvedValue([]);
  repository.findCommunityReportsForAnalytics.mockResolvedValue([]);
});

describe("analytics service - incident metrics", () => {
  test("reports exactly the number of incidents returned by the database", async () => {
    repository.findIncidentsForAnalytics.mockResolvedValue([
      incidentRow(),
      incidentRow({ status: "VERIFIED" }),
      incidentRow({ incidentType: "WILDLIFE_CONFLICT" }),
      incidentRow(),
      incidentRow(),
    ]);
    const data = await service.incidents(manager, {});
    expect(data.total).toBe(5);
  });

  test("buckets incidents monthly and zero-fills the requested range", async () => {
    repository.findIncidentsForAnalytics.mockResolvedValue([
      incidentRow({ reportedAt: at("2026-10-08T04:00:00.000Z") }),
      incidentRow({ reportedAt: at("2026-10-15T09:00:00.000Z") }),
      incidentRow({ reportedAt: at("2026-11-02T03:30:00.000Z") }),
    ]);
    const data = await service.incidents(manager, {
      period: "month",
      from: "2026-10-01",
      to: "2026-11-30",
    });
    expect(data.trend).toEqual([
      { bucket: "2026-10-01T00:00:00.000Z", label: "2026-10", count: 2 },
      { bucket: "2026-11-01T00:00:00.000Z", label: "2026-11", count: 1 },
    ]);
  });

  test("buckets incidents daily within a single day", async () => {
    repository.findIncidentsForAnalytics.mockResolvedValue([
      incidentRow({ reportedAt: at("2026-10-08T04:00:00.000Z") }),
      incidentRow({ reportedAt: at("2026-10-08T18:00:00.000Z") }),
    ]);
    const data = await service.incidents(manager, {
      period: "day",
      from: "2026-10-08",
      to: "2026-10-09",
    });
    expect(data.trend).toEqual([
      { bucket: "2026-10-08T00:00:00.000Z", label: "2026-10-08", count: 2 },
      { bucket: "2026-10-09T00:00:00.000Z", label: "2026-10-09", count: 0 },
    ]);
  });

  test("groups incidents by type and status, sorted by count desc", async () => {
    repository.findIncidentsForAnalytics.mockResolvedValue([
      incidentRow({ incidentType: "WILDLIFE_CONFLICT", status: "VERIFIED" }),
      incidentRow({ incidentType: "WILDLIFE_CONFLICT", status: "PENDING" }),
      incidentRow({ incidentType: "POACHING_SNARE", status: "PENDING" }),
    ]);
    const data = await service.incidents(manager, {});
    expect(data.byType).toEqual([
      { key: "WILDLIFE_CONFLICT", count: 2 },
      { key: "POACHING_SNARE", count: 1 },
    ]);
    expect(data.byStatus).toEqual([
      { key: "PENDING", count: 2 },
      { key: "VERIFIED", count: 1 },
    ]);
  });

  test("returns an empty series when no incidents match the range", async () => {
    repository.findIncidentsForAnalytics.mockResolvedValue([]);
    const data = await service.incidents(manager, {
      from: "2026-05-01",
      to: "2026-05-31",
    });
    expect(data.total).toBe(0);
    // A fully bounded range still returns a zero-filled series so charts can
    // render a flat line; the empty state is driven by `total === 0`.
    expect(data.trend).toEqual([
      { bucket: "2026-05-01T00:00:00.000Z", label: "2026-05", count: 0 },
    ]);
    expect(data.byType).toEqual([]);
  });

  test("scopes incident queries to the manager's park and applies filters", async () => {
    await service.incidents(manager, {
      type: "POACHING_SNARE",
      status: "PENDING",
      from: "2026-10-01",
      to: "2026-10-31",
      area: "weerawila",
    });
    expect(repository.findIncidentsForAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({
        parkId: "park-1",
        incidentType: "POACHING_SNARE",
        status: "PENDING",
        reportedAt: {
          gte: at("2026-10-01T00:00:00.000Z"),
          lte: at("2026-10-31T00:00:00.000Z"),
        },
        manualLocation: { contains: "weerawila", mode: "insensitive" },
      }),
    );
  });

  test("does not scope to a park when the manager has none assigned", async () => {
    await service.incidents({ id: "manager", role: "PARK_MANAGER" }, {});
    expect(repository.findIncidentsForAnalytics).toHaveBeenCalledWith(
      expect.not.objectContaining({ parkId: expect.anything() }),
    );
  });
});

describe("analytics service - patrol metrics", () => {
  test("counts patrol statuses from real rows", async () => {
    repository.findPatrolsForAnalytics.mockResolvedValue([
      patrolRow({ status: "SCHEDULED" }),
      patrolRow({ status: "SCHEDULED" }),
      patrolRow({ status: "IN_PROGRESS" }),
      patrolRow({ status: "COMPLETED" }),
    ]);
    const data = await service.patrols(manager, {});
    expect(data.total).toBe(4);
    expect(data.byStatus).toEqual([
      { key: "SCHEDULED", count: 2 },
      { key: "COMPLETED", count: 1 },
      { key: "IN_PROGRESS", count: 1 },
    ]);
  });

  test("attributes patrols to their actual start date when present", async () => {
    repository.findPatrolsForAnalytics.mockResolvedValue([
      patrolRow({
        scheduledDate: at("2026-10-01T00:00:00.000Z"),
        actualStartTime: at("2026-11-05T06:00:00.000Z"),
      }),
      patrolRow({
        scheduledDate: at("2026-10-02T00:00:00.000Z"),
        actualStartTime: null,
        createdAt: at("2026-09-29T00:00:00.000Z"),
      }),
    ]);
    const data = await service.patrols(manager, {
      period: "month",
      from: "2026-10-01",
      to: "2026-11-30",
    });
    expect(data.total).toBe(2);
    expect(data.trend).toEqual([
      { bucket: "2026-10-01T00:00:00.000Z", label: "2026-10", count: 1 },
      { bucket: "2026-11-01T00:00:00.000Z", label: "2026-11", count: 1 },
    ]);
  });

  test("filters patrols by type, status and priority (patrol-only fields)", async () => {
    const where = { parkId: "park-1", patrolType: "ANTI_POACHING", status: "COMPLETED", priority: "HIGH" };
    await service.patrols(manager, {
      type: "ANTI_POACHING",
      status: "COMPLETED",
      priority: "HIGH",
    });
    expect(repository.findPatrolsForAnalytics).toHaveBeenCalledWith(
      expect.objectContaining(where),
    );
  });
});

describe("analytics service - community metrics", () => {
  test("counts conflict reports and common areas without private data", async () => {
    repository.findCommunityReportsForAnalytics.mockResolvedValue([
      reportRow({ reportType: "HUMAN_WILDLIFE_CONFLICT", manualLocation: "Weerawila" }),
      reportRow({ reportType: "HUMAN_WILDLIFE_CONFLICT", manualLocation: "Weerawila" }),
      reportRow({ reportType: "WILDLIFE_SIGHTING", manualLocation: "Kataragama North" }),
    ]);
    const data = await service.communityReports(manager, {});
    expect(data.total).toBe(3);
    expect(data.conflictCount).toBe(2);
    expect(data.byArea).toEqual([
      { key: "Weerawila", count: 2 },
      { key: "Kataragama North", count: 1 },
    ]);
  });

  test("never injects a parkId into community queries (the model has no park column)", async () => {
    await service.communityReports(manager, {});
    expect(repository.findCommunityReportsForAnalytics).toHaveBeenCalledWith(
      expect.not.objectContaining({ parkId: expect.anything() }),
    );
  });

  test("community filters still flow through area and status", async () => {
    await service.communityReports(manager, {
      type: "HUMAN_WILDLIFE_CONFLICT",
      status: "VERIFIED",
      area: "weerawila",
    });
    expect(repository.findCommunityReportsForAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({
        reportType: "HUMAN_WILDLIFE_CONFLICT",
        status: "VERIFIED",
        manualLocation: { contains: "weerawila", mode: "insensitive" },
      }),
    );
  });
});

describe("analytics service - kpis", () => {
  test("composes patrol, incident and community metrics", async () => {
    repository.findPatrolsForAnalytics.mockResolvedValue([
      patrolRow({ status: "SCHEDULED" }),
      patrolRow({ status: "SCHEDULED" }),
      patrolRow({ status: "IN_PROGRESS" }),
      patrolRow({ status: "COMPLETED" }),
      patrolRow({ status: "CANCELLED" }),
    ]);
    repository.findIncidentsForAnalytics.mockResolvedValue([
      incidentRow(),
      incidentRow({ status: "VERIFIED" }),
    ]);
    repository.findCommunityReportsForAnalytics.mockResolvedValue([
      reportRow(),
      reportRow({ reportType: "HUMAN_WILDLIFE_CONFLICT" }),
    ]);
    const data = await service.kpis(manager, {});
    expect(data.patrols).toEqual({
      total: 5,
      scheduled: 2,
      inProgress: 1,
      completed: 1,
      cancelled: 1,
    });
    expect(data.incidents).toEqual({ total: 2 });
    expect(data.community).toEqual({ total: 2, conflictCount: 1 });
  });

  test("scopes patrols and incidents to the park but not community rows", async () => {
    await service.kpis(manager, {});
    expect(repository.findPatrolsForAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ parkId: "park-1" }),
    );
    expect(repository.findIncidentsForAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ parkId: "park-1" }),
    );
    expect(repository.findCommunityReportsForAnalytics).toHaveBeenCalledWith(
      expect.not.objectContaining({ parkId: expect.anything() }),
    );
  });

  test("kpis do not accept entity-specific filters", async () => {
    await expect(service.kpis(manager, { type: "POACHING_SNARE" })).rejects.toThrow(
      "Please check the analytics filters.",
    );
  });
});

describe("analytics service - bucket helpers", () => {
  test("bucketStart gives UTC day/week/month boundaries", () => {
    const date = at("2026-10-08T14:30:00.000Z"); // Thursday
    expect(_internal.bucketStart(date, "day").toISOString()).toBe(
      "2026-10-08T00:00:00.000Z",
    );
    expect(_internal.bucketStart(date, "week").toISOString()).toBe(
      "2026-10-05T00:00:00.000Z", // Monday
    );
    expect(_internal.bucketStart(date, "month").toISOString()).toBe(
      "2026-10-01T00:00:00.000Z",
    );
  });

  test("buildTrend produces weekly buckets on Mondays", () => {
    const rows = [incidentRow({ reportedAt: at("2026-10-08T04:00:00.000Z") })];
    const trend = _internal.buildTrend(
      rows,
      "week",
      (row) => row.reportedAt,
      at("2026-10-05T00:00:00.000Z"),
      at("2026-10-18T00:00:00.000Z"),
    );
    expect(trend).toEqual([
      { bucket: "2026-10-05T00:00:00.000Z", label: "2026-10-05", count: 1 },
      { bucket: "2026-10-12T00:00:00.000Z", label: "2026-10-12", count: 0 },
    ]);
  });
});