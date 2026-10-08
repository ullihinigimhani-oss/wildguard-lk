import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Incidents from "../../src/pages/Incidents/Incidents";
import PatrolReports from "../../src/pages/Incidents/PatrolReports";
import IncidentDetailsPage from "../../src/pages/Incidents/IncidentDetailsPage";
import {
  listAllIncidents,
  getIncident,
  getEvidenceAccess,
} from "../../src/services/incidentApi";
import { getPatrol } from "../../src/services/patrolApi";
import { groupPatrols } from "../../src/pages/Incidents/incidentNavigation";
const account = vi.hoisted(() => ({ user: null }));
const map = vi.hoisted(() => ({
  invalidateSize: vi.fn(),
  getContainer: () => document.body,
}));
vi.mock("../../src/hooks/useAuth", () => ({ useAuth: () => account }));
vi.mock("../../src/services/incidentApi", async () => ({
  ...(await vi.importActual("../../src/services/incidentApi")),
  listAllIncidents: vi.fn(),
  getIncident: vi.fn(),
  getEvidenceAccess: vi.fn(),
}));
vi.mock("../../src/services/patrolApi", () => ({ getPatrol: vi.fn() }));
vi.mock("react-leaflet", () => ({
  useMap: () => map,
  MapContainer: ({ children }) => <div>{children}</div>,
  TileLayer: () => null,
  Marker: ({ position, children }) => (
    <div data-testid="incident-marker">
      {position.join(",")}
      {children}
    </div>
  ),
  Popup: ({ children }) => <div>{children}</div>,
}));
const patrol = {
  id: "p1",
  routeName: "Northern boundary",
  status: "IN_PROGRESS",
  ranger: { id: "r1", name: "Actual Ranger" },
  park: { id: "park1", name: "Actual Park" },
};
const photo = {
  id: "e1",
  fileType: "PHOTO",
  mediaAvailable: true,
  caption: "Field photo",
  metadata: {
    source: "CAMERA_TRAP",
    cameraTrapId: "trap-a",
    originalFileName: "photo.jpg",
    notes: "Manual import",
  },
};
const incident = {
  id: "i1",
  title: "Snare report",
  incidentType: "POACHING_SNARE",
  description: "Wire snare near stream",
  status: "PENDING",
  reporter: patrol.ranger,
  patrolId: "p1",
  patrol,
  park: patrol.park,
  occurredAt: "2026-10-08T04:00:00Z",
  createdAt: "2026-10-08T04:05:00Z",
  updatedAt: "2026-10-08T04:05:00Z",
  latitude: 7.2,
  longitude: 80.2,
  evidenceCount: 2,
  evidence: [
    photo,
    {
      ...photo,
      id: "e2",
      fileType: "VIDEO",
      caption: "Video report",
      metadata: { source: "GALLERY_UPLOAD" },
    },
  ],
};
const second = {
  ...incident,
  id: "i2",
  title: "Illegal campsite",
  incidentType: "ILLEGAL_CAMPSITE",
};
const community = {
  ...incident,
  id: "c1",
  title: "Community wildlife report",
  patrolId: null,
  patrol: null,
  reporter: { id: "community1", name: "Community Reporter" },
};
const result = (items) => ({
  success: true,
  incidents: items,
  total: items.length,
  pageSize: 25,
});
const mount = (path = "/incidents") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/incidents/patrol/:patrolId" element={<PatrolReports />} />
        <Route
          path="/incidents/patrol/:patrolId/:incidentId"
          element={<IncidentDetailsPage />}
        />
        <Route
          path="/incidents/unassigned/:incidentId"
          element={<IncidentDetailsPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
beforeEach(() => {
  vi.clearAllMocks();
  account.user = {
    id: "manager",
    role: "PARK_MANAGER",
    approvalStatus: "APPROVED",
  };
  listAllIncidents.mockImplementation(async (filters) =>
    result(
      filters.patrolId ? [incident, second] : [incident, second, community],
    ),
  );
  getIncident.mockImplementation(async (id) =>
    id === "c1" ? community : id === "i2" ? second : incident,
  );
  getPatrol.mockResolvedValue(patrol);
  getEvidenceAccess.mockResolvedValue({
    uri: "https://example.test/api/private?ticket=mock",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  });
});

test("one row per patrol with unique matching counts and separate community reports", async () => {
  mount();
  const region = await screen.findByRole("region", {
    name: "Patrol incident groups",
  });
  await within(region).findByRole("link", {
    name: "View reports for Northern boundary",
  });
  const table = within(region).getByRole("table");
  expect(within(table).getAllByRole("row")).toHaveLength(2);
  expect(within(table).getByText("2")).toBeVisible();
  expect(within(table).getByText("Actual Ranger")).toBeVisible();
  expect(within(table).getByText("Actual Park")).toBeVisible();
  expect(within(table).getByText("In progress")).toBeVisible();
  expect(within(region).queryByText("Snare report")).toBeNull();
  const other = screen.getByRole("region", {
    name: "Other / Unassigned Incidents",
  });
  expect(within(other).getByText("Community wildlife report")).toBeVisible();
  expect(within(other).getByText("Community Reporter")).toBeVisible();
  expect(groupPatrols([incident, second, incident]).patrols[0].count).toBe(2);
});

test("three-level navigation preserves filters/search and reuses details, map and private gallery", async () => {
  mount("/incidents?parkId=park1&status=PENDING&search=report");
  fireEvent.click(
    await screen.findByRole("link", {
      name: "View reports for Northern boundary",
    }),
  );
  await screen.findByRole("heading", { name: "Patrol Incident Reports" });
  const link = await screen.findByRole("link", { name: "View incident i1" });
  expect(listAllIncidents).toHaveBeenLastCalledWith(
    expect.objectContaining({
      patrolId: "p1",
      parkId: "park1",
      status: "PENDING",
    }),
    expect.any(AbortSignal),
  );
  expect(getPatrol).toHaveBeenCalledWith("p1");
  expect(screen.queryByText("Community wildlife report")).toBeNull();
  fireEvent.click(link);
  const panel = await screen.findByRole("region", { name: "Incident details" });
  await within(panel).findByText("Wire snare near stream");
  expect(getIncident).toHaveBeenCalledWith("i1", expect.any(AbortSignal));
  expect(within(panel).getByTestId("incident-marker")).toHaveTextContent(
    "7.2,80.2",
  );
  await waitFor(() =>
    expect(map.invalidateSize).toHaveBeenCalledWith({ pan: false }),
  );
  expect(within(panel).getByText("Camera trap: trap-a")).toBeVisible();
  fireEvent.click(
    within(panel).getAllByRole("button", { name: "View private evidence" })[0],
  );
  await within(panel).findByRole("img", { name: "Field photo" });
  expect(getEvidenceAccess).toHaveBeenCalledWith(
    "i1",
    "e1",
    expect.any(AbortSignal),
  );
  expect(
    screen.queryByRole("button", {
      name: /Approve|Reject|Withdraw|Edit incident/,
    }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("link", { name: /Back to Patrol Reports/ }));
  await screen.findByRole("link", { name: "View incident i1" });
  fireEvent.click(screen.getByRole("link", { name: /Back to Incidents/ }));
  await screen.findByRole("link", {
    name: "View reports for Northern boundary",
  });
  expect(screen.getByLabelText("Park")).toHaveValue("park1");
  expect(screen.getByLabelText("Incident status")).toHaveValue("PENDING");
  expect(screen.getByLabelText("Search matching incidents")).toHaveValue(
    "report",
  );
});

test("unassigned community details remain readable with back navigation", async () => {
  mount();
  fireEvent.click(
    await screen.findByRole("link", { name: "View incident c1" }),
  );
  await screen.findByText("Wire snare near stream");
  expect(screen.getByText("Community wildlife report")).toBeVisible();
  expect(
    screen.getByRole("link", { name: /Back to Incidents/ }),
  ).toHaveAttribute("href", "/incidents");
});

test("a mismatched patrol or linked report on the unassigned route is blocked", async () => {
  mount("/incidents/patrol/another/i1");
  expect(await screen.findByRole("alert")).toHaveTextContent("does not belong");
  expect(screen.queryByTestId("incident-marker")).toBeNull();
});

test("supported filters retain date semantics and reset group pagination", async () => {
  mount("/incidents?page=2");
  await screen.findByRole("link", {
    name: "View reports for Northern boundary",
  });
  for (const [label, value] of [
    ["Patrol", "p1"],
    ["Ranger", "r1"],
    ["Park", "park1"],
    ["Incident type", "POACHING_SNARE"],
    ["Incident status", "PENDING"],
    ["From date (Sri Lanka)", "2026-10-01"],
    ["To date (Sri Lanka)", "2026-10-08"],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  await waitFor(() =>
    expect(listAllIncidents).toHaveBeenLastCalledWith(
      expect.objectContaining({
        patrolId: "p1",
        rangerId: "r1",
        parkId: "park1",
        incidentType: "POACHING_SNARE",
        status: "PENDING",
        from: "2026-10-01T00:00:00+05:30",
        to: "2026-10-08T23:59:59.999+05:30",
      }),
      expect.any(AbortSignal),
    ),
  );
  expect(
    screen
      .getByRole("link", { name: "View reports for Northern boundary" })
      .getAttribute("href"),
  ).not.toContain("page=2");
});

test("withdrawn history is opt-in and preserves existing withdrawn badge", async () => {
  listAllIncidents.mockImplementation(async (filters) =>
    result(
      filters.includeWithdrawn === "true"
        ? [{ ...community, withdrawnAt: "2026-10-08T05:00:00Z" }]
        : [community],
    ),
  );
  mount();
  await screen.findByText("Community wildlife report");
  expect(screen.queryByText("Withdrawn")).toBeNull();
  fireEvent.click(screen.getByLabelText("Include withdrawn history"));
  await screen.findByText("Withdrawn");
});

test("complete matching search adjusts counts without hiding other matched patrols", async () => {
  mount();
  await screen.findByRole("link", {
    name: "View reports for Northern boundary",
  });
  fireEvent.change(screen.getByLabelText("Search matching incidents"), {
    target: { value: "Snare report" },
  });
  const region = screen.getByRole("region", { name: "Patrol incident groups" });
  expect(within(region).getByText("1")).toBeVisible();
  expect(screen.queryByText("Community wildlife report")).toBeNull();
});

test("patrol and report pagination operate on complete sets without recount requests", async () => {
  const items = Array.from({ length: 26 }, (_, i) => ({
    ...incident,
    id: `i${i}`,
    patrolId: `p${i}`,
    patrol: { ...patrol, id: `p${i}`, routeName: `Patrol ${i}` },
  }));
  listAllIncidents.mockResolvedValue(result(items));
  mount();
  await screen.findByRole("link", { name: "View reports for Patrol 0" });
  expect(
    screen.queryByRole("link", { name: "View reports for Patrol 25" }),
  ).toBeNull();
  fireEvent.click(
    within(
      screen.getByRole("navigation", { name: "Patrol pagination" }),
    ).getByRole("button", { name: "Next" }),
  );
  expect(
    screen.getByRole("link", { name: "View reports for Patrol 25" }),
  ).toBeVisible();
  expect(listAllIncidents).toHaveBeenCalledTimes(1);
});

test("patrol report pagination keeps all reports and the correct patrol total", async () => {
  listAllIncidents.mockResolvedValue(
    result(
      Array.from({ length: 26 }, (_, i) => ({
        ...incident,
        id: `report${i}`,
        title: `Report ${i}`,
      })),
    ),
  );
  mount("/incidents/patrol/p1");
  await screen.findByRole("link", { name: "View incident report0" });
  expect(screen.getByText("26")).toBeVisible();
  fireEvent.click(
    within(
      screen.getByRole("navigation", { name: "Report pagination" }),
    ).getByRole("button", { name: "Next" }),
  );
  expect(
    screen.getByRole("link", { name: "View incident report25" }),
  ).toBeVisible();
  expect(
    screen.getByRole("link", { name: "View incident report25" }),
  ).toHaveAttribute("href", "/incidents/patrol/p1/report25?reportPage=2");
});

test.each([401, 403, 404, undefined])(
  "API error %s is safe and retryable",
  async (status) => {
    listAllIncidents.mockRejectedValueOnce({
      response: { status },
      message: "DO_NOT_RENDER_RAW_ERROR",
    });
    mount();
    await screen.findByRole("alert");
    expect(screen.queryByText("DO_NOT_RENDER_RAW_ERROR")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry incidents" }));
    await screen.findByRole("link", {
      name: "View reports for Northern boundary",
    });
  },
);

test.each([
  "/incidents",
  "/incidents/patrol/p1",
  "/incidents/patrol/p1/i1",
  "/incidents/unassigned/c1",
])("unauthorized access to %s makes no data requests", (path) => {
  account.user = { role: "RANGER", approvalStatus: "APPROVED" };
  mount(path);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Only approved Park Managers",
  );
  expect(listAllIncidents).not.toHaveBeenCalled();
  expect(getIncident).not.toHaveBeenCalled();
  expect(getPatrol).not.toHaveBeenCalled();
});

test("loading waits for complete dataset; empty state has no invented patrols", async () => {
  let finish;
  listAllIncidents.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  mount();
  expect(screen.getByRole("status")).toHaveTextContent("Loading incidents");
  expect(screen.queryByRole("table")).toBeNull();
  await act(async () => finish(result([])));
  expect(
    screen.getByText("No patrol reports match these filters."),
  ).toBeVisible();
  expect(
    screen.getByText("No unassigned incidents match these filters."),
  ).toBeVisible();
});

test("patrol without matching reports retains real header and empty state", async () => {
  listAllIncidents.mockResolvedValue(result([]));
  mount("/incidents/patrol/p1");
  await screen.findByText("Northern boundary");
  expect(
    screen.getByText(
      "No incident reports match this patrol and its current filters.",
    ),
  ).toBeVisible();
});
test.each([null, { role: "PARK_MANAGER", approvalStatus: "PENDING" }])(
  "unauthenticated and unapproved manager accounts cannot load incidents",
  (user) => {
    account.user = user;
    mount();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Only approved Park Managers",
    );
    expect(listAllIncidents).not.toHaveBeenCalled();
  },
);
test("patrol totals include more than one backend page worth of distinct reports", async () => {
  listAllIncidents.mockResolvedValue(
    result(
      Array.from({ length: 26 }, (_, i) => ({ ...incident, id: `many${i}` })),
    ),
  );
  mount();
  const link = await screen.findByRole("link", {
    name: "View reports for Northern boundary",
  });
  expect(within(link.closest("tr")).getByText("26")).toBeVisible();
  expect(
    within(
      screen.getByRole("region", { name: "Patrol incident groups" }),
    ).getAllByRole("row"),
  ).toHaveLength(2);
});
test("unassigned route rejects a patrol-linked incident", async () => {
  mount("/incidents/unassigned/i1");
  expect(await screen.findByRole("alert")).toHaveTextContent("does not belong");
  expect(screen.queryByTestId("incident-marker")).toBeNull();
});

test("details logout removes private evidence immediately", async () => {
  const view = mount("/incidents/patrol/p1/i1");
  const panel = await screen.findByRole("region", { name: "Incident details" });
  fireEvent.click(
    (
      await within(panel).findAllByRole("button", {
        name: "View private evidence",
      })
    )[0],
  );
  await screen.findByRole("img");
  account.user = null;
  view.rerender(
    <MemoryRouter>
      <IncidentDetailsPage />
    </MemoryRouter>,
  );
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.queryByRole("region", { name: "Incident details" })).toBeNull();
});
