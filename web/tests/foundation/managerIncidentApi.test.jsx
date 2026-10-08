import { api } from "../../src/services/api";
import {
  listIncidents,
  getEvidenceAccess,
  listAllIncidents,
} from "../../src/services/incidentApi";
vi.mock("../../src/services/api", () => ({
  api: { get: vi.fn(), defaults: { baseURL: "https://backend.example/api" } },
}));
beforeEach(() => vi.clearAllMocks());
test("complete results fetch every backend page before returning accurate totals", async () => {
  const items = Array.from({ length: 26 }, (_, index) => ({
    id: `i${index}`,
    patrolId: "p1",
  }));
  api.get
    .mockResolvedValueOnce({
      data: {
        success: true,
        incidents: items.slice(0, 25),
        total: 26,
        pageSize: 25,
      },
    })
    .mockResolvedValueOnce({
      data: {
        success: true,
        incidents: items.slice(25),
        total: 26,
        pageSize: 25,
      },
    });
  const result = await listAllIncidents({ parkId: "park1" });
  expect(result.incidents).toHaveLength(26);
  expect(api.get).toHaveBeenNthCalledWith(2, "/incidents", {
    params: { parkId: "park1", page: 2 },
    signal: undefined,
  });
});
test.each(["duplicate", "changed total", "missing page"])(
  "%s prevents incomplete grouping from being displayed",
  async (kind) => {
    api.get
      .mockResolvedValueOnce({
        data: {
          success: true,
          incidents: [{ id: "a" }],
          total: 2,
          pageSize: 1,
        },
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          incidents:
            kind === "missing page"
              ? []
              : [{ id: kind === "duplicate" ? "a" : "b" }],
          total: kind === "changed total" ? 3 : 2,
          pageSize: 1,
        },
      });
    await expect(listAllIncidents({})).rejects.toThrow("Incident list changed");
  },
);
test("aborted pagination does not start another API request", async () => {
  const controller = new AbortController();
  api.get.mockResolvedValue({
    data: { success: true, incidents: [{ id: "a" }], total: 2, pageSize: 1 },
  });
  controller.abort();
  await expect(listAllIncidents({}, controller.signal)).rejects.toThrow(
    "cancelled",
  );
  expect(api.get).toHaveBeenCalledTimes(1);
});
test("manager list uses the authenticated shared API and drops unsupported filters", async () => {
  api.get.mockResolvedValue({
    data: { success: true, incidents: [], total: 0, pageSize: 25 },
  });
  await listIncidents({
    page: 1,
    patrolId: "p",
    search: "not supported",
    severity: "HIGH",
  });
  expect(api.get).toHaveBeenCalledWith("/incidents", {
    params: { page: 1, patrolId: "p" },
    signal: undefined,
  });
});
test("private access composes only the expected backend path and rejects permanent public URLs", async () => {
  api.get.mockResolvedValue({
    data: {
      success: true,
      access: {
        path: "/incidents/i/evidence/e/media?ticket=test-only",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      },
    },
  });
  expect((await getEvidenceAccess("i", "e")).uri).toBe(
    "https://backend.example/api/incidents/i/evidence/e/media?ticket=test-only",
  );
  api.get.mockResolvedValue({
    data: {
      success: true,
      access: {
        path: "https://res.cloudinary.com/public",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      },
    },
  });
  await expect(getEvidenceAccess("i", "e")).rejects.toThrow(
    "Private media access unavailable",
  );
});
