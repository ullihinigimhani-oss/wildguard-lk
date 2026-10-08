import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RangerTrack from "../../src/pages/RangerMonitoring/RangerTrack";
import { getPatrol, getPatrolTrail } from "../../src/services/patrolApi";
vi.mock("../../src/services/patrolApi", () => ({
  getPatrol: vi.fn(),
  getPatrolTrail: vi.fn(),
}));

const plan = [
  { type: "START", order: 0, label: "Gate", latitude: 6.4173, longitude: 81.4192 },
  { type: "CHECKPOINT", order: 1, label: "Water hole", latitude: 6.4273, longitude: 81.4392 },
  { type: "END", order: 2, label: "Camp", latitude: 6.4373, longitude: 81.4592 },
];
const patrol = {
  id: "patrol-1",
  routeName: "Northern boundary sweep",
  status: "IN_PROGRESS",
  patrolType: "ANTI_POACHING",
  priority: "HIGH",
  startLocation: "Main gate",
  park: { id: "park-a", name: "Yala National Park" },
  ranger: { id: "ranger-1", name: "A. Perera", email: "ranger1@example.test" },
  plannedRoute: plan,
};
const trail = [
  { latitude: 6.4173, longitude: 81.4192, recordedAt: new Date(Date.now() - 60000).toISOString() },
  { latitude: 6.4213, longitude: 81.4252, recordedAt: new Date(Date.now() - 5000).toISOString() },
];
const mount = () =>
  render(
    <MemoryRouter initialEntries={["/patrols/patrol-1/track"]}>
      <Routes>
        <Route path="/patrols/:id/track" element={<RangerTrack />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  getPatrol.mockResolvedValue(patrol);
  getPatrolTrail.mockResolvedValue(trail);
});

test("shows the planned route, recorded history, ranger header and back link", async () => {
  mount();
  expect(await screen.findByText("Northern boundary sweep")).toBeVisible();
  expect(screen.getByText("A. Perera")).toBeVisible();
  expect(screen.getByText("Yala National Park")).toBeVisible();
  expect(screen.getByRole("link", { name: /Back to patrols/ })).toHaveAttribute(
    "href",
    "/patrols",
  );
  expect(getPatrol).toHaveBeenCalledWith("patrol-1");
  await screen.findByText(/Recorded route \(2 points\)/);
  expect(document.querySelectorAll(".route-marker")).toHaveLength(plan.length);
  expect(document.querySelectorAll(".ranger-pin.is-selected")).toHaveLength(1);
  expect(
    document.querySelectorAll(".leaflet-overlay-pane path").length,
  ).toBeGreaterThanOrEqual(2);
});

test("reports the freshness of the newest recorded position", async () => {
  mount();
  await screen.findByText("A. Perera");
  expect(screen.getAllByText("Available").length).toBeGreaterThan(0);
  expect(screen.getByText(/Recorded route \(2 points\)/)).toBeVisible();
});

test("shows an empty state before any position is recorded", async () => {
  getPatrolTrail.mockResolvedValue([]);
  mount();
  expect(
    await screen.findByText(/No GPS positions have been recorded/),
  ).toBeVisible();
  expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
  expect(document.querySelectorAll(".ranger-pin")).toHaveLength(0);
});

test("shows a not-found error for a missing patrol and recovers on Retry", async () => {
  getPatrol.mockRejectedValueOnce({ response: { status: 404 } });
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Patrol not found.",
  );
  expect(getPatrolTrail).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Northern boundary sweep")).toBeVisible();
});

test("marks a finished patrol as saved history without polling", async () => {
  getPatrol.mockResolvedValue({ ...patrol, status: "COMPLETED" });
  mount();
  expect(
    await screen.findByText(/Saved route history for this patrol/),
  ).toBeVisible();
  expect(getPatrolTrail).toHaveBeenCalledTimes(1);
});

test("polls recorded positions while in progress and stops on unmount", async () => {
  vi.useFakeTimers();
  try {
    const { unmount } = mount();
    await vi.advanceTimersByTimeAsync(0);
    expect(getPatrolTrail).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(7000);
    expect(getPatrolTrail).toHaveBeenCalledTimes(2);
    unmount();
    await vi.advanceTimersByTimeAsync(21000);
    expect(getPatrolTrail).toHaveBeenCalledTimes(2);
  } finally {
    vi.useRealTimers();
  }
});