import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PatrolDetails from "../../src/pages/PatrolManagement/PatrolDetails";
import {
  getPatrol,
  listAssignableRangers,
  listPatrols,
  createPatrol,
} from "../../src/services/patrolApi";
vi.mock("../../src/services/patrolApi", () => ({
  listAssignableRangers: vi.fn(),
  createPatrol: vi.fn(),
  listPatrols: vi.fn(),
  getPatrol: vi.fn(),
}));
const patrol = {
  id: "patrol-1",
  routeName: "Northern boundary sweep",
  status: "SCHEDULED",
  patrolType: "ANTI_POACHING",
  priority: "HIGH",
  scheduledDate: "2026-10-10T00:00:00.000Z",
  startTime: "2026-10-10T01:00:00.000Z",
  endTime: "2026-10-10T04:30:00.000Z",
  startLocation: "Main gate",
  latitude: 7.5,
  longitude: 80.7,
  description: "Check the northern fence line.",
  park: { id: "park-a", name: "Yala National Park" },
  ranger: {
    id: "ranger-1",
    name: "A. Perera",
    email: "ranger1@example.test",
  },
  createdBy: { id: "manager", name: "Existing Manager" },
};
beforeEach(() => {
  vi.clearAllMocks();
  getPatrol.mockResolvedValue(patrol);
});
const mountDetails = (path = "/patrols/patrol-1") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/patrols/:id" element={<PatrolDetails />} />
        <Route path="/patrols" element={<p>Patrol list page</p>} />
      </Routes>
    </MemoryRouter>,
  );
test("shows every patrol detail including coordinates and instructions", async () => {
  mountDetails();
  expect(
    await screen.findByRole("heading", { name: "Northern boundary sweep" }),
  ).toBeVisible();
  expect(getPatrol).toHaveBeenCalledWith("patrol-1");
  expect(screen.getByText("Yala National Park")).toBeVisible();
  expect(screen.getByText(/A\. Perera/)).toBeVisible();
  expect(screen.getByText("ranger1@example.test")).toBeVisible();
  expect(screen.getByText("2026-10-10")).toBeVisible();
  expect(screen.getByText(/^06:30/)).toBeVisible();
  expect(screen.getByText(/^10:00/)).toBeVisible();
  expect(screen.getByText("Anti-poaching operation")).toBeVisible();
  expect(screen.getByText("High")).toBeVisible();
  expect(screen.getAllByText("Scheduled")).toHaveLength(2);
  expect(screen.getByText("Main gate")).toBeVisible();
  expect(screen.getByText("7.5")).toBeVisible();
  expect(screen.getByText("80.7")).toBeVisible();
  expect(screen.getByText("Check the northern fence line.")).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Create Patrol" }),
  ).toHaveAttribute("href", "/patrols/new");
});
test("an unknown patrol id shows a not-found state", async () => {
  getPatrol.mockRejectedValue(
    Object.assign(new Error("Patrol unavailable"), {
      response: { status: 404 },
    }),
  );
  mountDetails("/patrols/does-not-exist");
  expect(await screen.findByRole("heading", { name: "Patrol not found" })).toBeVisible();
  expect(screen.getByText(/Patrol not found\./)).toBeVisible();
  expect(screen.queryByText("Loading patrol…")).not.toBeInTheDocument();
});
test("shows a loading state while the patrol request is pending", () => {
  getPatrol.mockReturnValue(new Promise(() => {}));
  mountDetails();
  expect(screen.getByText("Loading patrol…")).toBeVisible();
});
test("failures show an error and retry recovers", async () => {
  getPatrol.mockRejectedValueOnce(new Error("offline"));
  const events = userEvent.setup();
  mountDetails();
  expect(
    await screen.findByText("Unable to load this patrol. Please try again."),
  ).toBeVisible();
  await events.click(screen.getByRole("button", { name: "Retry" }));
  expect(
    await screen.findByRole("heading", { name: "Northern boundary sweep" }),
  ).toBeVisible();
  expect(getPatrol).toHaveBeenCalledTimes(2);
});
test("back link returns to the patrol list", async () => {
  const events = userEvent.setup();
  mountDetails();
  await screen.findByRole("heading", { name: "Northern boundary sweep" });
  await events.click(screen.getByRole("link", { name: /Back to patrols/ }));
  expect(await screen.findByText("Patrol list page")).toBeVisible();
});
