import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import IncidentDetailsPage from "../../src/pages/Incidents/IncidentDetailsPage";
import PatrolReports from "../../src/pages/Incidents/PatrolReports";
import {
  getIncident,
  getEvidenceAccess,
  listAllIncidents,
  updateIncidentStatus,
} from "../../src/services/incidentApi";
import { getPatrol } from "../../src/services/patrolApi";

const account = vi.hoisted(() => ({ user: null }));
const map = vi.hoisted(() => ({
  invalidateSize: vi.fn(),
  getContainer: () => document.body,
}));
vi.mock("../../src/hooks/useAuth", () => ({ useAuth: () => account }));
vi.mock("../../src/services/incidentApi", async () => ({
  ...(await vi.importActual("../../src/services/incidentApi")),
  getIncident: vi.fn(),
  getEvidenceAccess: vi.fn(),
  listAllIncidents: vi.fn(),
  updateIncidentStatus: vi.fn(),
}));
vi.mock("../../src/services/patrolApi", () => ({ getPatrol: vi.fn() }));
vi.mock("react-leaflet", () => ({
  useMap: () => map,
  MapContainer: ({ children }) => <div>{children}</div>,
  TileLayer: () => null,
  Marker: ({ position, children }) => (
    <div data-testid="incident-marker">{children}</div>
  ),
  Popup: ({ children }) => <div>{children}</div>,
}));

const patrol = {
  id: "p1",
  routeName: "Northern boundary",
  status: "IN_PROGRESS",
  ranger: { id: "r1", name: "A. Perera" },
  park: { id: "park1", name: "Yala National Park" },
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
  manualLocation: "Near the water hole",
  evidenceCount: 1,
  evidence: [
    {
      id: "e1",
      fileType: "PHOTO",
      mediaAvailable: true,
      caption: "Field photo",
      metadata: null,
    },
  ],
};
const listResult = (items) => ({
  success: true,
  incidents: items,
  total: items.length,
  pageSize: 25,
});
const mountDetails = (path = "/incidents/patrol/p1/i1") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/incidents/patrol/:patrolId/:incidentId"
          element={<IncidentDetailsPage />}
        />
        <Route
          path="/incidents/unassigned/:incidentId"
          element={<IncidentDetailsPage />}
        />
        <Route
          path="/incidents/patrol/:patrolId"
          element={<PatrolReports />}
        />
      </Routes>
    </MemoryRouter>,
  );
const statusSelect = () => screen.getByLabelText("Update incident status");

beforeEach(() => {
  vi.clearAllMocks();
  account.user = {
    id: "manager",
    role: "PARK_MANAGER",
    approvalStatus: "APPROVED",
  };
  getIncident.mockResolvedValue(incident);
  getPatrol.mockResolvedValue(patrol);
  listAllIncidents.mockResolvedValue(listResult([incident]));
  getEvidenceAccess.mockResolvedValue({
    uri: "https://example.test/api/private?ticket=mock",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  });
  updateIncidentStatus.mockResolvedValue({
    ...incident,
    status: "UNDER_REVIEW",
  });
});

test("manager sees every Ranger-submitted detail with a status form", async () => {
  const { container } = mountDetails();
  await screen.findByText("Wire snare near stream");
  expect(screen.getAllByText("A. Perera").length).toBeGreaterThan(0);
  expect(screen.getByText("Yala National Park")).toBeVisible();
  expect(screen.getByText("Poaching / Snare")).toBeVisible();
  expect(screen.getByText("Near the water hole")).toBeVisible();
  expect(screen.getByText("Field photo")).toBeVisible();
  expect(container.querySelector(".badge")).toHaveTextContent("Pending");
  expect(statusSelect()).toHaveValue("PENDING");
  expect(
    screen.queryByRole("button", { name: /Save status|Approve|Reject|Withdraw/ }),
  ).toBeNull();
  expect(updateIncidentStatus).not.toHaveBeenCalled();
});

test("choosing a value in the select saves it without a save button", async () => {
  mountDetails();
  await screen.findByText("Wire snare near stream");
  fireEvent.change(statusSelect(), { target: { value: "UNDER_REVIEW" } });
  await screen.findByText("Status saved as Under review.");
  expect(updateIncidentStatus).toHaveBeenCalledWith("i1", "UNDER_REVIEW");
  expect(statusSelect()).toHaveValue("UNDER_REVIEW");
  expect(screen.queryByRole("button", { name: "Save status" })).toBeNull();
});

test("the select locks while the save is in flight", async () => {
  let release;
  updateIncidentStatus.mockReturnValue(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  mountDetails();
  await screen.findByText("Wire snare near stream");
  fireEvent.change(statusSelect(), { target: { value: "VERIFIED" } });
  expect(statusSelect()).toBeDisabled();
  expect(screen.getByText("Saving…")).toBeVisible();
  expect(updateIncidentStatus).toHaveBeenCalledWith("i1", "VERIFIED");
  release({ ...incident, status: "VERIFIED" });
  await screen.findByText("Status saved as Verified.");
  expect(statusSelect()).toBeEnabled();
  expect(statusSelect()).toHaveValue("VERIFIED");
});

test("server rejection reverts the select and reports the exact reason", async () => {
  updateIncidentStatus.mockRejectedValueOnce({
    response: {
      status: 409,
      data: {
        success: false,
        code: "INCIDENT_WITHDRAWN",
        message: "This report has been withdrawn and cannot be updated.",
      },
    },
  });
  mountDetails();
  await screen.findByText("Wire snare near stream");
  fireEvent.change(statusSelect(), { target: { value: "VERIFIED" } });
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent(
    "This report has been withdrawn and cannot be updated.",
  );
  expect(alert).not.toHaveTextContent("Status saved");
  expect(statusSelect()).toHaveValue("PENDING");
  expect(screen.getByText("Wire snare near stream")).toBeVisible();
});

test("an unsupported status value surfaces the field reason", async () => {
  updateIncidentStatus.mockRejectedValueOnce({
    response: {
      status: 400,
      data: {
        success: false,
        message: "Please check your incident details.",
        errors: { status: "Select a supported incident status." },
      },
    },
  });
  mountDetails();
  await screen.findByText("Wire snare near stream");
  fireEvent.change(statusSelect(), { target: { value: "REJECTED" } });
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Select a supported incident status.",
  );
  expect(statusSelect()).toHaveValue("PENDING");
  expect(screen.getByText("Wire snare near stream")).toBeVisible();
});

test("a forbidden status change never renders the raw client error", async () => {
  updateIncidentStatus.mockRejectedValueOnce({
    message: "Request failed with status code 403",
    response: {
      status: 403,
      data: {
        success: false,
        message: "You do not have permission to perform this action.",
      },
    },
  });
  mountDetails();
  await screen.findByText("Wire snare near stream");
  fireEvent.change(statusSelect(), { target: { value: "VERIFIED" } });
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "You do not have permission to perform this action.",
  );
  expect(
    screen.queryByText("Request failed with status code 403"),
  ).toBeNull();
  expect(screen.getByText("Wire snare near stream")).toBeVisible();
});

test("missing incident after a status attempt stays recoverable", async () => {
  updateIncidentStatus.mockRejectedValueOnce({
    response: { status: 404, data: { success: false, code: "INCIDENT_UNAVAILABLE" } },
  });
  mountDetails();
  await screen.findByText("Wire snare near stream");
  fireEvent.change(statusSelect(), { target: { value: "REJECTED" } });
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "This incident is no longer available.",
  );
  expect(statusSelect()).toHaveValue("PENDING");
  expect(screen.getByText("Wire snare near stream")).toBeVisible();
});

test("withdrawn reports stay read-only instead of offering a status control", async () => {
  getIncident.mockResolvedValue({
    ...incident,
    withdrawnAt: "2026-10-08T06:00:00Z",
  });
  mountDetails();
  await screen.findByText("Wire snare near stream");
  expect(screen.queryByLabelText("Update incident status")).toBeNull();
  expect(screen.queryByRole("button", { name: "Save status" })).toBeNull();
  expect(screen.getByText(/can no longer be changed/)).toBeVisible();
  expect(updateIncidentStatus).not.toHaveBeenCalled();
});

test("Ranger accounts never reach the review form", () => {
  account.user = { id: "r1", role: "RANGER", approvalStatus: "APPROVED" };
  mountDetails();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Only approved Park Managers",
  );
  expect(getIncident).not.toHaveBeenCalled();
  expect(updateIncidentStatus).not.toHaveBeenCalled();
});

test("patrol reports page saves status inline and reloads the list", async () => {
  const stored = { ...incident };
  listAllIncidents.mockImplementation(async () => listResult([{ ...stored }]));
  updateIncidentStatus.mockImplementation(async (id, status) => {
    stored.status = status;
    stored.updatedAt = "2026-10-08T10:00:00Z";
    return { ...stored };
  });
  mountDetails("/incidents/patrol/p1");
  const row = (
    await screen.findByRole("link", { name: "View incident i1" })
  ).closest("tr");
  const select = within(row).getByLabelText("Status for incident i1");
  expect(select).toHaveValue("PENDING");
  fireEvent.change(select, { target: { value: "VERIFIED" } });
  await waitFor(() =>
    expect(updateIncidentStatus).toHaveBeenCalledWith("i1", "VERIFIED"),
  );
  await waitFor(() => expect(listAllIncidents).toHaveBeenCalledTimes(2));
  const refreshed = (
    await screen.findByRole("link", { name: "View incident i1" })
  ).closest("tr");
  expect(
    within(refreshed).getByLabelText("Status for incident i1"),
  ).toHaveValue("VERIFIED");
  expect(refreshed.querySelector(".badge")).toHaveTextContent("Verified");
});

test("withdrawn rows hide the inline control on the patrol reports page", async () => {
  listAllIncidents.mockResolvedValue(
    listResult([
      { ...incident, withdrawnAt: "2026-10-08T06:00:00Z", status: "VERIFIED" },
    ]),
  );
  mountDetails("/incidents/patrol/p1");
  await screen.findByRole("link", { name: "View incident i1" });
  expect(
    screen.queryByLabelText("Status for incident i1"),
  ).toBeNull();
  expect(screen.queryByRole("button", { name: "Save status" })).toBeNull();
  expect(updateIncidentStatus).not.toHaveBeenCalled();
});
