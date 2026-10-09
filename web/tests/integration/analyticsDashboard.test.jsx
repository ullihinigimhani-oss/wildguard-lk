import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Dashboard from "../../src/pages/Dashboard/Dashboard";
import {
  communityAnalytics,
  incidentAnalytics,
  kpis,
  patrolAnalytics,
} from "../../src/services/analyticsApi";

const account = vi.hoisted(() => ({ user: null }));
vi.mock("../../src/hooks/useAuth", () => ({ useAuth: () => account }));
vi.mock("../../src/services/analyticsApi", async () => ({
  ...(await vi.importActual("../../src/services/analyticsApi")),
  kpis: vi.fn(),
  incidentAnalytics: vi.fn(),
  patrolAnalytics: vi.fn(),
  communityAnalytics: vi.fn(),
}));

const kpiData = {
  patrols: { total: 9, scheduled: 3, inProgress: 2, completed: 4, cancelled: 0 },
  incidents: { total: 5 },
  community: { total: 6, conflictCount: 2 },
};

const monthPoint = { bucket: "2026-10-01T00:00:00.000Z", label: "2026-10", count: 5 };

const incidentData = {
  period: "month",
  total: 5,
  trend: [monthPoint],
  byType: [
    { key: "WILDLIFE_CONFLICT", count: 4 },
    { key: "POACHING_SNARE", count: 1 },
  ],
  byStatus: [{ key: "RESOLVED", count: 5 }],
};

const patrolData = {
  period: "month",
  total: 9,
  trend: [{ ...monthPoint, count: 9 }],
  byStatus: [
    { key: "COMPLETED", count: 4 },
    { key: "IN_PROGRESS", count: 2 },
    { key: "SCHEDULED", count: 3 },
  ],
  byType: [{ key: "ROUTINE", count: 9 }],
  byPriority: [
    { key: "LOW", count: 5 },
    { key: "HIGH", count: 4 },
  ],
};

const communityData = {
  period: "month",
  total: 6,
  conflictCount: 2,
  trend: [{ ...monthPoint, count: 6 }],
  byType: [
    { key: "HUMAN_WILDLIFE_CONFLICT", count: 2 },
    { key: "WILDLIFE_SIGHTING", count: 4 },
  ],
  byStatus: [{ key: "PENDING", count: 6 }],
  byArea: [
    { key: "Kataragama North", count: 4 },
    { key: "Buttala", count: 2 },
  ],
};

const mount = (path = "/dashboard") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  account.user = {
    id: "manager",
    name: "Manager",
    role: "PARK_MANAGER",
    approvalStatus: "APPROVED",
  };
  kpis.mockResolvedValue(kpiData);
  incidentAnalytics.mockResolvedValue(incidentData);
  patrolAnalytics.mockResolvedValue(patrolData);
  communityAnalytics.mockResolvedValue(communityData);
});

test("authorized manager sees metric cards, trends and breakdown bars on the dashboard", async () => {
  mount();
  expect(
    await screen.findByRole("heading", { name: "Welcome back, Manager" }),
  ).toBeInTheDocument();
  await screen.findByText("Patrols scheduled");
  const metrics = screen.getAllByText("9");
  expect(metrics.length).toBeGreaterThan(0);
  expect(screen.getByText("Human-wildlife conflicts")).toBeInTheDocument();
  const conflictCard = screen
    .getByText("Human-wildlife conflicts")
    .closest(".metric-card");
  expect(within(conflictCard).getByText("2")).toBeInTheDocument();
  expect(
    screen.getByRole("img", { name: "Incidents over time" }),
  ).toBeInTheDocument();
  expect(screen.getByText("2026-10: 5")).toBeInTheDocument();
  const incidentBlocks = screen.getAllByText("By type");
  const byTypeBlock = incidentBlocks[0].closest(".analytics-chart-block");
  expect(within(byTypeBlock).getByText("Wildlife Conflict")).toBeInTheDocument();
  expect(within(byTypeBlock).getByText("Poaching / Snare")).toBeInTheDocument();
  expect(
    screen.getByRole("img", { name: "Patrols over time" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("img", { name: "Community reports over time" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Kataragama North")).toBeInTheDocument();
});

test("non-manager roles see the fallback dashboard and no analytics fetch", async () => {
  account.user = { id: "ranger", name: "Ranger", role: "RANGER", approvalStatus: "APPROVED" };
  mount();
  expect(
    await screen.findByRole("heading", { name: "Welcome back, Ranger" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Active Patrol")).toBeInTheDocument();
  expect(kpis).not.toHaveBeenCalled();
  expect(incidentAnalytics).not.toHaveBeenCalled();
  expect(patrolAnalytics).not.toHaveBeenCalled();
  expect(communityAnalytics).not.toHaveBeenCalled();
});

test("dashboard shows a loading state while a fetch is pending", async () => {
  patrolAnalytics.mockImplementation(() => new Promise(() => {}));
  mount();
  expect(await screen.findByTestId("loading-analytics-state")).toBeInTheDocument();
});

test("panel error renders with a working retry action", async () => {
  incidentAnalytics.mockRejectedValue({ response: { status: 500, data: {} } });
  mount();
  expect(
    await screen.findByText("Unable to load analytics. Please retry."),
  ).toBeInTheDocument();
  const retry = screen.getByRole("button", { name: "Retry analytics" });
  incidentAnalytics.mockResolvedValue(incidentData);
  fireEvent.click(retry);
  expect(
    await screen.findByRole("img", { name: "Incidents over time" }),
  ).toBeInTheDocument();
});

test("panels show an empty state when a dataset has no records", async () => {
  incidentAnalytics.mockResolvedValue({ ...incidentData, total: 0, trend: [] });
  mount();
  expect(
    await screen.findByText("No incidents match these filters."),
  ).toBeInTheDocument();
});

test("filters convert dates to Sri Lanka time and drive the APIs", async () => {
  mount(
    "/dashboard?from=2026-10-01&to=2026-10-31&period=week&area=Kataragama&incidentType=WILDLIFE_CONFLICT",
  );
  await screen.findByText("Patrols scheduled");
  await waitFor(() =>
    expect(kpis).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "2026-10-01T00:00:00+05:30",
        to: "2026-10-31T23:59:59.999+05:30",
        area: "Kataragama",
      }),
      expect.anything(),
    ),
  );
  expect(incidentAnalytics).toHaveBeenCalledWith(
    expect.objectContaining({
      period: "week",
      type: "WILDLIFE_CONFLICT",
      area: "Kataragama",
    }),
    expect.anything(),
  );
});

test("changing a panel filter refetches with the new value", async () => {
  mount();
  await screen.findByText("Patrols scheduled");
  const select = screen.getByLabelText("Report type");
  fireEvent.change(select, { target: { value: "SUSPICIOUS_ACTIVITY" } });
  await waitFor(() =>
    expect(communityAnalytics).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "SUSPICIOUS_ACTIVITY" }),
      expect.anything(),
    ),
  );
});

test("date range reversal surfaces a validation error without a network call", async () => {
  mount("/dashboard?from=2026-10-31&to=2026-10-01");
  const errors = await screen.findAllByText(
    "End date must not precede start date.",
  );
  expect(errors.length).toBeGreaterThan(0);
  expect(kpis).not.toHaveBeenCalled();
});

test("metric cards keep accessible labels that stay in view", async () => {
  mount();
  await screen.findByText("Patrols scheduled");
  const card = screen
    .getByText("Patrols in progress")
    .closest(".metric-card");
  expect(within(card).getByText("2")).toBeInTheDocument();
});