// The analytics repository must never project private reporter information.
// These tests pin the exact read-only select projections used by aggregations.
jest.mock("../../../src/config/database", () => ({
  patrol: { findMany: jest.fn() },
  incident: { findMany: jest.fn() },
  communityReport: { findMany: jest.fn() },
}));

const db = require("../../../src/config/database");
const repository = require("../../../src/repositories/analytics.repository");

beforeEach(() => jest.clearAllMocks());

async function projection(fn, model) {
  db[model].findMany.mockResolvedValue([]);
  await fn({ parkId: "park-1" });
  const [{ select }] = db[model].findMany.mock.calls[0];
  return select;
}

describe("analytics repository projections", () => {
  test("incident projection contains only aggregate fields", async () => {
    const select = await projection(
      (where) => repository.findIncidentsForAnalytics(where),
      "incident",
    );
    expect(select).toEqual({
      status: true,
      incidentType: true,
      reportedAt: true,
      manualLocation: true,
    });
    for (const privateField of [
      "reporterId",
      "reporterName",
      "reporterPhone",
      "description",
      "title",
      "evidence",
    ]) {
      expect(select).not.toHaveProperty(privateField);
    }
  });

  test("patrol projection contains only aggregate fields", async () => {
    const select = await projection(
      (where) => repository.findPatrolsForAnalytics(where),
      "patrol",
    );
    expect(select).not.toHaveProperty("description");
    expect(select).not.toHaveProperty("rangerId");
    expect(select).not.toHaveProperty("createdById");
  });

  test("community report projection contains only aggregate fields", async () => {
    const select = await projection(
      (where) => repository.findCommunityReportsForAnalytics(where),
      "communityReport",
    );
    expect(select).not.toHaveProperty("reporterId");
    expect(select).not.toHaveProperty("reporterName");
    expect(select).not.toHaveProperty("reporterPhone");
    expect(select).not.toHaveProperty("description");
    expect(select).not.toHaveProperty("evidence");
  });
});