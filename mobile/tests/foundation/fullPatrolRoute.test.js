import { renderHook, act, waitFor } from "@testing-library/react-native";
import useFullPatrolRoute from "../../src/hooks/useFullPatrolRoute";
import { getFullPatrolRoute } from "../../src/services/patrolApi";
jest.mock("../../src/services/patrolApi", () => ({
  getFullPatrolRoute: jest.fn(),
}));
const patrol = { id: "p", status: "IN_PROGRESS", actualStartTime: "session" };
const points = ["START", "CHECKPOINT", "HIGH_RISK", "OBSERVATION", "END"].map(
  (type, order) => ({
    waypointId: String(order),
    type,
    order,
    latitude: 7 + order / 1000,
    longitude: 80,
  }),
);
const live = {
  riskReady: true,
  riskZones: [],
  route: { destination: { waypointId: "0" } },
  routing: false,
};
const full = {
  geometry: {
    type: "LineString",
    coordinates: [
      [80, 7],
      [80, 7.004],
    ],
  },
  legs: [],
  riskZones: [],
  distanceMeters: 6000,
  durationSeconds: 5000,
};
const mount = () =>
  renderHook(
    ({ navigation, pts, active }) =>
      useFullPatrolRoute(patrol, pts, "a", navigation, active),
    { initialProps: { navigation: live, pts: points, active: true } },
  );
beforeEach(() => getFullPatrolRoute.mockReset().mockResolvedValue(full));
test("full context loads once and GPS jitter/progression/reroutes do not recalculate it", async () => {
  const hook = mount();
  await waitFor(() => expect(hook.result.current.route).toBe(full));
  hook.rerender({
    navigation: {
      ...live,
      route: { destination: { waypointId: "1" } },
      summary: { distanceMeters: 100, durationSeconds: 80 },
    },
    pts: [...points],
    active: true,
  });
  expect(getFullPatrolRoute).toHaveBeenCalledTimes(1);
  expect(hook.result.current.route.distanceMeters).toBe(6000);
  hook.unmount();
});
test("live routing has startup priority; no full request before live result", async () => {
  const hook = renderHook(
    ({ navigation }) =>
      useFullPatrolRoute(patrol, points, "a", navigation, true),
    { initialProps: { navigation: { ...live, route: null, routing: true } } },
  );
  expect(getFullPatrolRoute).not.toHaveBeenCalled();
  hook.rerender({ navigation: live });
  await waitFor(() => expect(getFullPatrolRoute).toHaveBeenCalledTimes(1));
  hook.unmount();
});
test("changed waypoints or relevant risks invalidate full context and discard stale responses", async () => {
  let resolve;
  getFullPatrolRoute.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const hook = mount();
  const signal = getFullPatrolRoute.mock.calls[0][1];
  const changed = points.map((p) => ({ ...p, longitude: p.longitude + 0.001 }));
  hook.rerender({ navigation: live, pts: changed, active: true });
  await waitFor(() => expect(getFullPatrolRoute).toHaveBeenCalledTimes(2));
  expect(signal.aborted).toBe(true);
  await act(async () => resolve({ ...full, distanceMeters: 999 }));
  expect(hook.result.current.route.distanceMeters).toBe(6000);
  const risk = { id: "risk", geometry: { type: "Polygon", coordinates: [] } };
  getFullPatrolRoute.mockResolvedValue({ ...full, riskZones: [risk] });
  hook.rerender({
    navigation: { ...live, riskZones: [risk] },
    pts: changed,
    active: true,
  });
  await waitFor(() => expect(getFullPatrolRoute).toHaveBeenCalledTimes(3));
  hook.unmount();
});
test("full route failure keeps null geometry and does not automatically retry no-alternative errors", async () => {
  getFullPatrolRoute.mockRejectedValue({
    response: { status: 422, data: { code: "NO_RISK_AVOIDING_ROUTE" } },
  });
  const hook = mount();
  await waitFor(() =>
    expect(hook.result.current.error).toMatch(/cannot currently be calculated/),
  );
  expect(hook.result.current.route).toBeNull();
  expect(getFullPatrolRoute).toHaveBeenCalledTimes(1);
  hook.unmount();
});
test("quota retries wait and coalesce; navigation exit cancels queued requests", async () => {
  jest.useFakeTimers();
  try {
    getFullPatrolRoute
      .mockRejectedValueOnce({
        response: { status: 429, data: { retryAfterSeconds: 30 } },
      })
      .mockResolvedValue(full);
    const hook = mount();
    await act(async () => {});
    expect(getFullPatrolRoute).toHaveBeenCalledTimes(1);
    await act(async () => jest.advanceTimersByTime(29000));
    expect(getFullPatrolRoute).toHaveBeenCalledTimes(1);
    await act(async () => jest.advanceTimersByTime(1000));
    expect(getFullPatrolRoute).toHaveBeenCalledTimes(2);
    hook.unmount();
  } finally {
    jest.useRealTimers();
  }
});

test("unmapped required point provides a Manager review message without fake geometry", async () => {
  getFullPatrolRoute.mockRejectedValue({
    response: { status: 422, data: { code: "PATROL_POINT_UNMAPPED" } },
  });
  const hook = mount();
  await waitFor(() =>
    expect(hook.result.current.error).toMatch(/no mapped walking connection/),
  );
  expect(hook.result.current.route).toBeNull();
  expect(getFullPatrolRoute).toHaveBeenCalledTimes(1);
  hook.unmount();
});
