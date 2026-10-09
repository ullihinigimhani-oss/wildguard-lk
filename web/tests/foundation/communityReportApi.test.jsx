import { api } from "../../src/services/api";
import {
  getCommunityReport,
  listCommunityReports,
  mediaUrl,
  updateCommunityReportStatus,
} from "../../src/services/communityReportApi";
vi.mock("../../src/services/api", () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    defaults: { baseURL: "https://backend.example/api" },
  },
}));
beforeEach(() => vi.clearAllMocks());

test("manager list uses the authenticated shared API and drops unsupported filters", async () => {
  api.get.mockResolvedValue({
    data: { success: true, reports: [], total: 0, pageSize: 25 },
  });
  await listCommunityReports({
    page: 1,
    pageSize: 25,
    status: "PENDING",
    reportType: "WILDLIFE_SIGHTING",
    from: "2026-10-01T00:00:00+05:30",
    to: "2026-10-31T23:59:59.999+05:30",
    severity: "HIGH",
    priority: "not-supported",
  });
  expect(api.get).toHaveBeenCalledWith("/community-reports", {
    params: {
      page: 1,
      pageSize: 25,
      status: "PENDING",
      reportType: "WILDLIFE_SIGHTING",
      from: "2026-10-01T00:00:00+05:30",
      to: "2026-10-31T23:59:59.999+05:30",
    },
    signal: undefined,
  });
});

test.each([
  ["no success flag", { reports: [], total: 0, pageSize: 25 }],
  ["missing reports", { success: true, total: 0, pageSize: 25 }],
  ["string total", { success: true, reports: [], total: "0", pageSize: 25 }],
  ["string pageSize", { success: true, reports: [], total: 0, pageSize: "25" }],
])("list rejects %s envelope", async (_, payload) => {
  api.get.mockResolvedValue({ data: payload });
  await expect(listCommunityReports({})).rejects.toThrow(
    "Community report list unavailable.",
  );
});

test("detail rejects a malformed report payload", async () => {
  api.get.mockResolvedValue({ data: { success: true, report: {} } });
  await expect(getCommunityReport("cr1")).rejects.toThrow(
    "Community report unavailable.",
  );
  expect(api.get).toHaveBeenCalledWith("/community-reports/cr1", {
    signal: undefined,
  });
});

test("status update posts the requested status and returns the revised report", async () => {
  api.patch.mockResolvedValue({
    data: { success: true, report: { id: "cr1", status: "VERIFIED" } },
  });
  const report = await updateCommunityReportStatus("cr1", "VERIFIED");
  expect(report.status).toBe("VERIFIED");
  expect(api.patch).toHaveBeenCalledWith("/community-reports/cr1/status", {
    status: "VERIFIED",
  });
});

test("mediaUrl composes backend-relative evidence paths against the API origin", () => {
  expect(mediaUrl("/uploads/evidence/evidence-1.jpg")).toBe(
    "https://backend.example/uploads/evidence/evidence-1.jpg",
  );
  expect(mediaUrl("https://cdn.example/x.png")).toBe("https://cdn.example/x.png");
  expect(mediaUrl("")).toBe("");
});