import { renderHook, act, waitFor } from "@testing-library/react-native";
import useLiveNavigation from "../../src/hooks/useLiveNavigation";
import {
  requestWalkingRoute,
  getPatrolLocations,
  recordPatrolLocation,
  getPatrolRiskZones,
} from "../../src/services/patrolApi";
import { clearNavigationSessions } from "../../src/utils/navigationSession";
import { zonePolygon } from "../../../shared/riskGeometry";
jest.mock("../../src/services/patrolApi", () => ({
  requestWalkingRoute: jest.fn(),
  getPatrolLocations: jest.fn(),
  recordPatrolLocation: jest.fn(),
  getPatrolRiskZones: jest.fn(),
}));
const points = ["START", "CHECKPOINT", "HIGH_RISK", "OBSERVATION", "END"].map(
  (type, order) => ({
    waypointId: String(order),
    type,
    order,
    latitude: 7.5 + order / 1000,
    longitude: 80.7,
  }),
);
const patrol = { id: "p", status: "IN_PROGRESS", actualStartTime: "session" };
const pos = (lat = 7.499) => ({
  latitude: lat,
  longitude: 80.7,
  accuracy: 10,
  timestamp: Date.now(),
});
const location = (position = pos(), active = true) => ({ position, active });
const result = (id) => ({
  destination: { waypointId: id },
  geometry: {
    type: "LineString",
    coordinates: [
      [80.7, 7.499],
      [80.7, 7.5],
    ],
  },
  distanceMeters: 200,
  durationSeconds: 140,
});
const mount = (initial = location()) =>
  renderHook(({ loc }) => useLiveNavigation(patrol, points, "a", loc), {
    initialProps: { loc: initial },
  });
beforeEach(() => {
  clearNavigationSessions();
  getPatrolLocations.mockResolvedValue([]);
  getPatrolRiskZones.mockResolvedValue([]);
  recordPatrolLocation.mockImplementation(async (id, sample) => ({
    accepted: true,
    location: sample,
  }));
  requestWalkingRoute.mockImplementation(async (id, destination) =>
    result(destination),
  );
});
test("initial route targets START, jitter reuses route and only valid samples record", async () => {
  const hook = mount();
  await waitFor(() => expect(hook.result.current.route).toBeTruthy());
  expect(requestWalkingRoute.mock.calls[0][1]).toBe("0");
  await waitFor(() => expect(recordPatrolLocation).toHaveBeenCalledTimes(1));
  hook.rerender({
    loc: location({ ...pos(7.49901), timestamp: Date.now() + 1000 }),
  });
  expect(requestWalkingRoute).toHaveBeenCalledTimes(1);
  expect(recordPatrolLocation).toHaveBeenCalledTimes(1);
});
test("near START advances to checkpoint and route request uses authoritative checkpoint ID", async () => {
  const hook = mount(location(pos(7.5)));
  await waitFor(() =>
    expect(hook.result.current.route?.destination.waypointId).toBe("1"),
  );
  expect(hook.result.current.reached.has("0")).toBe(true);
  expect(requestWalkingRoute.mock.calls[0][1]).toBe("1");
});
test("no mapped route returns friendly fallback with no invented geometry and no automatic retries", async () => {
  requestWalkingRoute.mockRejectedValue({
    response: {
      status: 422,
      data: { code: "NO_WALKING_ROUTE", private: "secret" },
    },
  });
  const hook = mount();
  await waitFor(() =>
    expect(hook.result.current.error).toMatch(/No mapped walking route/),
  );
  expect(hook.result.current.route).toBeNull();
  hook.rerender({ loc: location(pos(7.49901)) });
  expect(requestWalkingRoute).toHaveBeenCalledTimes(1);
  expect(hook.result.current.error).not.toContain("secret");
});
test("duplicate concurrent requests are avoided; leaving navigation aborts and ignores stale responses", async () => {
  let resolve;
  requestWalkingRoute.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const hook = mount();
  await waitFor(() => expect(resolve).toBeTruthy());
  hook.rerender({ loc: location(pos(7.49901)) });
  expect(requestWalkingRoute).toHaveBeenCalledTimes(1);
  const signal = requestWalkingRoute.mock.calls[0][3];
  hook.rerender({ loc: location(null, false) });
  expect(signal.aborted).toBe(true);
  await act(async () => resolve(result("0")));
  expect(hook.result.current.route).toBeNull();
});
test("three meaningful deviations trigger one controlled reroute, not jitter", async () => {
  jest.useFakeTimers();
  try {
    const hook = mount();
    await act(async () => {});
    expect(requestWalkingRoute).toHaveBeenCalledTimes(1);
    for (let i = 1; i <= 3; i++) {
      hook.rerender({
        loc: location({
          ...pos(7.499),
          longitude: 80.702,
          timestamp: Date.now() + i * 1000,
        }),
      });
    }
    expect(hook.result.current.offRoute).toBe(true);
    expect(requestWalkingRoute).toHaveBeenCalledTimes(1);
    await act(async () => jest.advanceTimersByTime(20000));
    expect(requestWalkingRoute).toHaveBeenCalledTimes(2);
    hook.unmount();
  } finally {
    jest.useRealTimers();
  }
});
test("all destinations reached means explicit completion is available without completing patrol API", async () => {
  const hook = mount(location(pos(7.5)));
  await act(async () => {});
  for (const point of points.filter((p) => p.type !== "HIGH_RISK")) {
    hook.rerender({
      loc: location({
        ...pos(point.latitude),
        timestamp: Date.now() + point.order * 1000,
      }),
    });
  }
  expect(hook.result.current.complete).toBe(true);
  expect(hook.result.current.destination).toBeUndefined();
  expect(hook.result.current.reached.has("2")).toBe(false);
  hook.unmount();
});
test("server IN_PROGRESS rejection stops routing and recording and exposes access loss", async () => {
  recordPatrolLocation.mockRejectedValue({ response: { status: 409 } });
  const hook = mount();
  await waitFor(() => expect(hook.result.current.accessLost).toBe(true));
  expect(hook.result.current.route).toBeNull();
  hook.rerender({ loc: location(pos(7.49901)) });
  expect(recordPatrolLocation).toHaveBeenCalledTimes(1);
});
const danger = (latitude = 7.5) => ({
  id: "risk",
  name: "Known danger",
  riskLevel: "HIGH",
  description: "Recorded caution",
  geometry: zonePolygon({
    centerLatitude: latitude,
    centerLongitude: 80.7,
    radiusMeters: 20,
  }),
});
test("risk context must load before GPS can mark even nearby START reached", async () => {
  let resolve;
  getPatrolRiskZones.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const hook = mount(location(pos(7.5)));
  await act(async () => {});
  expect(hook.result.current.reached.size).toBe(0);
  expect(requestWalkingRoute).not.toHaveBeenCalled();
  await act(async () => resolve([danger()]));
  expect(hook.result.current.rangerInsideZone).toBe(true);
  expect(hook.result.current.destinationInsideZone).toBe(true);
  expect(hook.result.current.reached.size).toBe(0);
  expect(requestWalkingRoute).not.toHaveBeenCalled();
});
test("destination inside zone is not skipped, even when GPS is within arrival threshold outside the area", async () => {
  getPatrolRiskZones.mockResolvedValue([danger()]);
  const hook = mount(location(pos(7.4997)));
  await waitFor(() => expect(hook.result.current.riskReady).toBe(true));
  expect(hook.result.current.destinationInsideZone).toBe(true);
  expect(hook.result.current.destination.waypointId).toBe("0");
  expect(hook.result.current.reached.size).toBe(0);
  expect(hook.result.current.route).toBeNull();
  expect(requestWalkingRoute).not.toHaveBeenCalled();
});
test("risk-aware longer distance and ETA used, then outage keeps risk polygons without fake route", async () => {
  const zones = [danger(7.502)];
  getPatrolRiskZones.mockResolvedValue(zones);
  requestWalkingRoute.mockResolvedValue({
    ...result("0"),
    distanceMeters: 1800,
    durationSeconds: 1440,
    riskZones: zones,
    riskAvoidance: { applied: true, zoneCount: 1 },
  });
  const hook = mount();
  await waitFor(() => expect(hook.result.current.route).toBeTruthy());
  expect(hook.result.current.summary.distanceMeters).toBeCloseTo(1800);
  expect(hook.result.current.summary.durationSeconds).toBeCloseTo(1440);
  expect(hook.result.current.riskZones).toEqual(zones);
});
test("no avoiding route retains zones and destination without advancing or exposing upstream errors", async () => {
  const zones = [danger(7.502)];
  getPatrolRiskZones.mockResolvedValue(zones);
  requestWalkingRoute.mockRejectedValue({
    response: {
      status: 422,
      data: {
        code: "NO_RISK_AVOIDING_ROUTE",
        riskZones: zones,
        private: "provider secret",
      },
    },
  });
  const hook = mount();
  await waitFor(() =>
    expect(hook.result.current.error).toMatch(/No route avoiding/),
  );
  expect(hook.result.current.riskZones).toEqual(zones);
  expect(hook.result.current.destination.waypointId).toBe("0");
  expect(hook.result.current.route).toBeNull();
  expect(hook.result.current.reached.size).toBe(0);
  expect(hook.result.current.error).not.toContain("secret");
});
test("invalid context blocks progression/routing while real GPS trail continues recording", async () => {
  getPatrolRiskZones.mockRejectedValue({
    response: {
      status: 422,
      data: { code: "RISK_ZONE_DATA_INVALID", riskZones: [danger(7.502)] },
    },
  });
  const hook = mount(location(pos(7.5)));
  await waitFor(() =>
    expect(hook.result.current.riskError).toMatch(/unavailable or invalid/),
  );
  expect(hook.result.current.reached.size).toBe(0);
  expect(requestWalkingRoute).not.toHaveBeenCalled();
  await waitFor(() => expect(recordPatrolLocation).toHaveBeenCalled());
});

test("temporary incident-screen blur resumes reached destinations from the same navigation session", async () => {
  const hook = mount();
  await waitFor(() => expect(hook.result.current.route).toBeTruthy());
  await act(async () => hook.rerender({ loc: location(pos(7.5)) }));
  await waitFor(() => {
    expect(hook.result.current.reached.has("0")).toBe(true);
    expect(hook.result.current.destination.waypointId).toBe("1");
    expect(hook.result.current.routing).toBe(false);
  });
  await act(async () => hook.rerender({ loc: location(null, false) }));
  await waitFor(() => expect(hook.result.current.reached.has("0")).toBe(true));
  await act(async () => hook.rerender({ loc: location(pos(7.5), true) }));
  await waitFor(() => {
    expect(hook.result.current.reached.has("0")).toBe(true);
    expect(hook.result.current.route?.destination.waypointId).toBe("1");
    expect(hook.result.current.routing).toBe(false);
  });
  expect(hook.result.current.destination.waypointId).toBe("1");
});
