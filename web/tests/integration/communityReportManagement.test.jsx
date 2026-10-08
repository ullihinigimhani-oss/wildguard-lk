import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CommunityReports from "../../src/pages/CommunityReports/CommunityReports";
import CommunityReportDetailsPage from "../../src/pages/CommunityReports/CommunityReportDetailsPage";
import {
  getCommunityReport,
  listCommunityReports,
  updateCommunityReportStatus,
} from "../../src/services/communityReportApi";

const account = vi.hoisted(() => ({ user: null }));
const map = vi.hoisted(() => ({
  invalidateSize: vi.fn(),
  getContainer: () => document.body,
}));
vi.mock("react-leaflet", () => ({
  useMap: () => map,
  MapContainer: ({ children }) => <div>{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }) => <div data-testid="community-marker">{children}</div>,
  Popup: ({ children }) => <div>{children}</div>,
}));
vi.mock("../../src/hooks/useAuth", () => ({ useAuth: () => account }));
vi.mock("../../src/services/communityReportApi", async () => ({
  ...(await vi.importActual("../../src/services/communityReportApi")),
  getCommunityReport: vi.fn(),
  listCommunityReports: vi.fn(),
  updateCommunityReportStatus: vi.fn(),
}));

const report = {
  id: "cr1",
  reportType: "WILDLIFE_SIGHTING",
  species: "Asian Elephant",
  description: "Herd of elephants near the tank",
  status: "UNDER_REVIEW",
  isAnonymous: false,
  reporterName: "Sunil Silva",
  reporterPhone: "0771234567",
  manualLocation: "Kataragama North",
  latitude: 6.4,
  longitude: 81.3,
  submittedAt: "2026-10-08T04:00:00Z",
  evidence: [
    {
      id: "e1",
      fileUrl: "/uploads/evidence/evidence-1.jpg",
      fileType: "image/jpeg",
    },
  ],
};
const listResult = (items) => ({
  success: true,
  reports: items,
  total: items.length,
  pageSize: 25,
});
const mountList = (path = "/community-reports") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/community-reports" element={<CommunityReports />} />
        <Route
          path="/community-reports/:reportId"
          element={<CommunityReportDetailsPage />}
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
  listCommunityReports.mockResolvedValue(listResult([report]));
  getCommunityReport.mockResolvedValue(report);
  updateCommunityReportStatus.mockResolvedValue({ ...report, status: "VERIFIED" });
});

test("authorized manager can list reports and open the details link", async () => {
  mountList();
  expect(await screen.findByText("Asian Elephant")).toBeInTheDocument();
  expect(screen.getAllByText("Wildlife Sighting").length).toBeGreaterThan(0);
  expect(screen.getByRole("link", { name: "View report cr1" })).toHaveAttribute(
    "href",
    "/community-reports/cr1",
  );
});

test("non-manager roles are blocked from the list", async () => {
  account.user = { id: "ranger", role: "RANGER", approvalStatus: "APPROVED" };
  mountList();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Only approved Park Managers",
  );
  expect(listCommunityReports).not.toHaveBeenCalled();
});

test("filters and page are passed to the list API", async () => {
  mountList(
    "/community-reports?status=UNDER_REVIEW&from=2026-10-01&to=2026-10-31",
  );
  await screen.findByText("Asian Elephant");
  expect(listCommunityReports).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "UNDER_REVIEW",
      reportType: "",
      from: "2026-10-01T00:00:00+05:30",
      to: "2026-10-31T23:59:59.999+05:30",
      page: 1,
    }),
    expect.anything(),
  );
  fireEvent.change(screen.getByLabelText("Report status"), {
    target: { value: "PENDING" },
  });
  await waitFor(() =>
    expect(listCommunityReports).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "PENDING" }),
      expect.anything(),
    ),
  );
});

test("details page shows report fields, reporter and evidence", async () => {
  mountList("/community-reports/cr1");
  expect(
    await screen.findByText("Herd of elephants near the tank"),
  ).toBeInTheDocument();
  expect(screen.getByText("Sunil Silva")).toBeInTheDocument();
  expect(screen.getByText("0771234567")).toBeInTheDocument();
  expect(screen.getByAltText("Evidence e1")).toHaveAttribute(
    "src",
    expect.stringContaining("/uploads/evidence/evidence-1.jpg"),
  );
  expect(screen.getByTestId("community-marker")).toBeInTheDocument();
});

test("details page withholds anonymous reporter identity", async () => {
  getCommunityReport.mockResolvedValue({
    ...report,
    isAnonymous: true,
    reporterName: "Secret Person",
    reporterPhone: "0770000000",
  });
  mountList("/community-reports/cr1");
  expect(
    await screen.findByText("Anonymous community member"),
  ).toBeInTheDocument();
  expect(screen.getByText("Withheld")).toBeInTheDocument();
  expect(screen.queryByText("Secret Person")).not.toBeInTheDocument();
});

test("details page blocked for non-manager", async () => {
  account.user = {
    id: "liaison",
    role: "COMMUNITY_LIAISON",
    approvalStatus: "APPROVED",
  };
  mountList("/community-reports/cr1");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Only approved Park Managers",
  );
  expect(getCommunityReport).not.toHaveBeenCalled();
});

test("status form proposes the current plus valid transitions", async () => {
  mountList("/community-reports/cr1");
  const select = await screen.findByLabelText("Update report status");
  const options = within(select)
    .getAllByRole("option")
    .map((option) => option.value);
  expect(options.sort()).toEqual(["REJECTED", "UNDER_REVIEW", "VERIFIED"]);
});

test("a PENDING report can be verified directly", async () => {
  getCommunityReport.mockResolvedValue({ ...report, status: "PENDING" });
  mountList("/community-reports/cr1");
  const select = await screen.findByLabelText("Update report status");
  const options = within(select)
    .getAllByRole("option")
    .map((option) => option.value);
  expect(options.sort()).toEqual(["PENDING", "REJECTED", "UNDER_REVIEW", "VERIFIED"]);
  fireEvent.change(select, { target: { value: "VERIFIED" } });
  fireEvent.click(screen.getByRole("button", { name: "Update Status" }));
  await waitFor(() =>
    expect(updateCommunityReportStatus).toHaveBeenCalledWith("cr1", "VERIFIED"),
  );
});

test("Update Status button applies the selected status", async () => {
  mountList("/community-reports/cr1");
  const select = await screen.findByLabelText("Update report status");
  fireEvent.change(select, { target: { value: "VERIFIED" } });
  const button = screen.getByRole("button", { name: "Update Status" });
  expect(button).toBeEnabled();
  fireEvent.click(button);
  await waitFor(() =>
    expect(updateCommunityReportStatus).toHaveBeenCalledWith("cr1", "VERIFIED"),
  );
  expect(
    await screen.findByText("Report status saved as Verified."),
  ).toBeInTheDocument();
});

test("Update Status is disabled while unchanged and while saving", async () => {
  updateCommunityReportStatus.mockImplementation(
    () =>
      new Promise((resolve) =>
        setTimeout(() => resolve({ ...report, status: "VERIFIED" }), 50),
      ),
  );
  mountList("/community-reports/cr1");
  const button = await screen.findByRole("button", { name: "Update Status" });
  expect(button).toBeDisabled();
  const select = screen.getByLabelText("Update report status");
  fireEvent.change(select, { target: { value: "VERIFIED" } });
  expect(button).toBeEnabled();
  fireEvent.click(button);
  expect(screen.getByRole("button", { name: "Updating…" })).toBeDisabled();
  expect(
    await screen.findByText("Report status saved as Verified."),
  ).toBeInTheDocument();
});

test("a rejected transition reverts the select and reports the error", async () => {
  updateCommunityReportStatus.mockRejectedValue({
    response: {
      status: 400,
      data: {
        message: "Cannot transition report from UNDER_REVIEW to REJECTED.",
      },
    },
  });
  mountList("/community-reports/cr1");
  const select = await screen.findByLabelText("Update report status");
  fireEvent.change(select, { target: { value: "REJECTED" } });
  fireEvent.click(screen.getByRole("button", { name: "Update Status" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Cannot transition report from UNDER_REVIEW to REJECTED.",
  );
  expect(select.value).toBe("UNDER_REVIEW");
});