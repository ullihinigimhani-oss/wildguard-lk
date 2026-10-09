import { api } from "../../src/services/api";
import {
  analyticsError,
  communityAnalytics,
  incidentAnalytics,
  kpis,
  patrolAnalytics,
} from "../../src/services/analyticsApi";
vi.mock("../../src/services/api", () => ({
  api: {
    get: vi.fn(),
    defaults: { baseURL: "http://localhost:5000/api" },
  },
}));
beforeEach(() => vi.clearAllMocks());

const payload = { success: true, data: { total: 1 } };

test("kpis passes only date range and area filters and rejects junk", async () => {
  api.get.mockResolvedValue({ data: payload });
  await kpis({
    from: "2026-10-01T00:00:00+05:30",
    to: "2026-10-31T23:59:59.999+05:30",
    area: "Kataragama",
    period: "week",
    type: "WILDLIFE_CONFLICT",
    status: "PENDING",
    priority: "HIGH",
  });
  expect(api.get).toHaveBeenCalledWith("/analytics/kpis", {
    params: {
      from: "2026-10-01T00:00:00+05:30",
      to: "2026-10-31T23:59:59.999+05:30",
      area: "Kataragama",
    },
    signal: undefined,
  });
});

test("incident analytics keeps type/status/period but never priority", async () => {
  api.get.mockResolvedValue({ data: payload });
  await incidentAnalytics({
    from: "2026-10-01T00:00:00+05:30",
    to: "2026-10-31T23:59:59.999+05:30",
    period: "week",
    area: "Buttala",
    type: "WILDLIFE_CONFLICT",
    status: "RESOLVED",
    priority: "HIGH",
  });
  expect(api.get).toHaveBeenCalledWith("/analytics/incidents", {
    params: {
      from: "2026-10-01T00:00:00+05:30",
      to: "2026-10-31T23:59:59.999+05:30",
      period: "week",
      area: "Buttala",
      type: "WILDLIFE_CONFLICT",
      status: "RESOLVED",
    },
    signal: undefined,
  });
});

test("patrol analytics passes patrol period/type/status/priority", async () => {
  api.get.mockResolvedValue({ data: payload });
  await patrolAnalytics({
    from: "",
    to: "",
    period: "day",
    type: "ANTI_POACHING",
    status: "IN_PROGRESS",
    priority: "HIGH",
  });
  expect(api.get).toHaveBeenCalledWith("/analytics/patrols", {
    params: {
      period: "day",
      type: "ANTI_POACHING",
      status: "IN_PROGRESS",
      priority: "HIGH",
    },
    signal: undefined,
  });
});

test("community analytics passes report filters and drops empty values", async () => {
  api.get.mockResolvedValue({ data: payload });
  await communityAnalytics({
    from: "",
    to: "",
    period: "month",
    area: "",
    type: "HUMAN_WILDLIFE_CONFLICT",
    status: "",
  });
  expect(api.get).toHaveBeenCalledWith("/analytics/community-reports", {
    params: { period: "month", type: "HUMAN_WILDLIFE_CONFLICT" },
    signal: undefined,
  });
});

test.each([
  ["missing data", { success: true }, "Analytics metrics unavailable."],
  ["no success flag", { data: { total: 1 } }, "Analytics metrics unavailable."],
  ["non-object data", { success: true, data: 3 }, "Analytics metrics unavailable."],
])("kpis rejects %s envelope", async (_, response, message) => {
  api.get.mockResolvedValue({ data: response });
  await expect(kpis({})).rejects.toThrow(message);
});

test("analyticsError surfaces field errors before generic messages", () => {
  expect(
    analyticsError({
      response: {
        status: 400,
        data: { errors: { period: "Period must be day, week or month." } },
      },
    }),
  ).toBe("Period must be day, week or month.");
});

test("analyticsError maps HTTP statuses to readable guidance", () => {
  expect(
    analyticsError({
      response: {
        status: 401,
        data: { message: "" },
      },
    }),
  ).toBe("Your session expired. Sign in again.");
  expect(
    analyticsError({
      response: { status: 403, data: {} },
    }),
  ).toBe("You do not have permission to view analytics.");
  expect(
    analyticsError({
      response: {
        status: 400,
        data: { message: "Area is too long." },
      },
    }),
  ).toBe("Area is too long.");
  expect(analyticsError({ response: { status: 500, data: {} } })).toBe(
    "Unable to load analytics. Please retry.",
  );
  expect(analyticsError(new Error("Network down"))).toBe(
    "Unable to load analytics. Please retry.",
  );
});