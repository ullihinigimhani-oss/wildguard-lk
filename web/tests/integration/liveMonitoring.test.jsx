import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RangerMonitoring from "../../src/pages/RangerMonitoring/RangerMonitoring";
import { getPatrolTrail, listLiveRangers } from "../../src/services/patrolApi";
vi.mock("../../src/services/patrolApi", () => ({
  listLiveRangers: vi.fn(),
  getPatrolTrail: vi.fn(),
}));

const ranger = (overrides) => ({
  patrolId: "patrol-1",
  routeName: "Northern boundary sweep",
  status: "IN_PROGRESS",
  patrolType: "ANTI_POACHING",
  priority: "HIGH",
  startLocation: "Main gate",
  actualStartTime: "2026-10-08T06:00:00.000Z",
  park: { id: "park-a", name: "Yala National Park" },
  ranger: { id: "ranger-1", name: "A. Perera", email: "ranger1@example.test" },
  location: {
    latitude: 6.4173,
    longitude: 81.4192,
    recordedAt: new Date(Date.now() - 5000).toISOString(),
  },
  ...overrides,
});
const fresh = ranger();
const stale = ranger({
  patrolId: "patrol-2",
  routeName: "Riverbank inspection",
  ranger: { id: "ranger-2", name: "B. Silva", email: "ranger2@example.test" },
  park: { id: "park-b", name: "Wilpattu National Park" },
  location: {
    latitude: 8.4333,
    longitude: 80.0,
    recordedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
});
const noFix = ranger({
  patrolId: "patrol-3",
  routeName: "No fix yet",
  ranger: { id: "ranger-3", name: "C. Fernando", email: "ranger3@example.test" },
  location: null,
});
const live = (rangers) => ({ success: true, rangers, freshnessSeconds: 120 });
const mount = () =>
  render(
    <MemoryRouter>
      <RangerMonitoring />
    </MemoryRouter>,
  );
beforeEach(() => {
  vi.clearAllMocks();
  listLiveRangers.mockResolvedValue(live([fresh, stale, noFix]));
  getPatrolTrail.mockResolvedValue([]);
});

test("lists active rangers with GPS freshness badges, stats and map markers", async () => {
  mount();
  expect(await screen.findByText("A. Perera")).toBeVisible();
  expect(screen.getByText("B. Silva")).toBeVisible();
  expect(screen.getByText("C. Fernando")).toBeVisible();

  expect(screen.getByText("Active patrols").closest(".metric-card")).toHaveTextContent("3");
  expect(
    screen.getByText("Recent GPS updates").closest(".metric-card"),
  ).toHaveTextContent("1");
  expect(
    screen.getByText("Stale or unavailable").closest(".metric-card"),
  ).toHaveTextContent("2");

  const list = document.querySelector(".live-list");
  expect(within(list).getAllByText("Available")).toHaveLength(1);
  expect(within(list).getAllByText("Stale")).toHaveLength(1);
  expect(within(list).getAllByText("Unavailable")).toHaveLength(1);

  // Only Rangers with a valid GPS fix are positioned on the map.
  expect(document.querySelectorAll(".leaflet-marker-icon")).toHaveLength(2);
});

test("selecting a Ranger shows full details, centres the map and loads the recorded route", async () => {
  getPatrolTrail.mockResolvedValue([
    { latitude: 6.41, longitude: 81.41, recordedAt: "2026-10-08T06:00:00.000Z" },
    { latitude: 6.4173, longitude: 81.4192, recordedAt: "2026-10-08T06:10:00.000Z" },
  ]);
  mount();
  fireEvent.click(await screen.findByRole("button", { name: /A\. Perera/ }));
  const detail = screen.getByLabelText("Selected ranger details");
  expect(within(detail).getByText("ranger-1")).toBeVisible();
  expect(within(detail).getByText("Northern boundary sweep")).toBeVisible();
  expect(within(detail).getByText("6.41730, 81.41920")).toBeVisible();
  expect(within(detail).getByText("Anti-poaching operation")).toBeVisible();
  expect(within(detail).getByRole("link", { name: "Open patrol details" })).toHaveAttribute(
    "href",
    "/patrols/patrol-1",
  );
  expect(getPatrolTrail).toHaveBeenCalledWith("patrol-1");
  await waitFor(() =>
    expect(document.querySelector("path.leaflet-interactive")).toBeTruthy(),
  );
});

test("clicking a map marker selects the ranger and opens a popup with GPS details", async () => {
  mount();
  await screen.findByText("A. Perera");
  const markers = document.querySelectorAll(".ranger-marker");
  fireEvent.click(markers[0]);
  await waitFor(() =>
    expect(screen.getByLabelText("Selected ranger details")).toBeVisible(),
  );
  const popup = document.querySelector(".leaflet-popup-content");
  expect(popup).toBeTruthy();
  expect(popup).toHaveTextContent("Northern boundary sweep");
  expect(popup).toHaveTextContent("Yala National Park");
});

test("filters the ranger list by search text and GPS status", async () => {
  mount();
  await screen.findByText("A. Perera");
  fireEvent.change(screen.getByLabelText("Search ranger or patrol"), {
    target: { value: "Silva" },
  });
  expect(screen.getByText("B. Silva")).toBeVisible();
  expect(screen.queryByText("A. Perera")).toBeNull();
  fireEvent.change(screen.getByLabelText("Search ranger or patrol"), {
    target: { value: "" },
  });
  fireEvent.change(screen.getByLabelText("GPS status"), {
    target: { value: "unavailable" },
  });
  expect(screen.getByText("C. Fernando")).toBeVisible();
  expect(screen.queryByText("A. Perera")).toBeNull();
  expect(screen.queryByText("B. Silva")).toBeNull();
});

test("shows an empty state when no Ranger is on an active patrol", async () => {
  listLiveRangers.mockResolvedValue(live([]));
  mount();
  expect(
    await screen.findByText(/No Rangers are currently on an active patrol/),
  ).toBeVisible();
  expect(document.querySelectorAll(".leaflet-marker-icon")).toHaveLength(0);
});

test("recovers from a failed load through Retry", async () => {
  listLiveRangers.mockRejectedValueOnce(new Error("network"));
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Unable to load Ranger positions.",
  );
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("A. Perera")).toBeVisible();
});

test("polls for updates on an interval and stops after leaving the page", async () => {
  vi.useFakeTimers();
  try {
    const { unmount } = mount();
    await vi.advanceTimersByTimeAsync(0);
    expect(listLiveRangers).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(7000);
    expect(listLiveRangers).toHaveBeenCalledTimes(2);
    unmount();
    await vi.advanceTimersByTimeAsync(21000);
    expect(listLiveRangers).toHaveBeenCalledTimes(2);
  } finally {
    vi.useRealTimers();
  }
});