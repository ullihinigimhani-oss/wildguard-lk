import { renderHook, act, waitFor } from "@testing-library/react-native";
import useFullPatrolRoute, { clearFullRouteCache } from "../../src/hooks/useFullPatrolRoute";
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
beforeEach(() => { clearFullRouteCache(); getFullPatrolRoute.mockReset().mockResolvedValue(full); });
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
test('screen return reuses verified geometry with the same session, points and risk context',async()=>{
 const first=mount();await waitFor(()=>expect(first.result.current.route).toBe(full));first.unmount();
 const second=mount();await waitFor(()=>expect(second.result.current.route).toBe(full));expect(getFullPatrolRoute).toHaveBeenCalledTimes(1);second.unmount();
});
test('duplicate manual retries do not overlap an in-flight request',async()=>{
 let resolve;getFullPatrolRoute.mockReturnValueOnce(new Promise(done=>resolve=done));const hook=mount();
 act(()=>{hook.result.current.retry();hook.result.current.retry();});expect(getFullPatrolRoute).toHaveBeenCalledTimes(1);
 await act(async()=>resolve(full));hook.unmount();
});
test('header Retry-After takes precedence over a shorter body delay; taps cannot bypass it',async()=>{
 jest.useFakeTimers();try{
 getFullPatrolRoute.mockRejectedValueOnce({response:{status:429,headers:{'retry-after':'45'},data:{code:'ROUTE_RATE_LIMIT',retryAfterSeconds:10}}}).mockResolvedValue(full);
 const hook=mount();await act(async()=>{});expect(hook.result.current.error).toMatch(/provider is rate limited/);
 act(()=>hook.result.current.retry());await act(async()=>jest.advanceTimersByTime(44000));expect(getFullPatrolRoute).toHaveBeenCalledTimes(1);
 await act(async()=>jest.advanceTimersByTime(1000));expect(hook.result.current.route).toBe(full);hook.unmount();
 }finally{jest.useRealTimers();}
});
test('automatic retries are bounded and fallback respects the final rate-limit delay',async()=>{
 jest.useFakeTimers();try{
 getFullPatrolRoute.mockRejectedValue({response:{status:429,data:{code:'ROUTE_COOLDOWN',retryAfterSeconds:10}}});const hook=mount();await act(async()=>{});
 for(const delay of [10000,10000,20000])await act(async()=>jest.advanceTimersByTime(delay));
 expect(getFullPatrolRoute).toHaveBeenCalledTimes(4);act(()=>hook.result.current.retry());expect(getFullPatrolRoute).toHaveBeenCalledTimes(4);
 await act(async()=>jest.advanceTimersByTime(40000));expect(getFullPatrolRoute).toHaveBeenCalledTimes(4);
 getFullPatrolRoute.mockResolvedValue(full);await act(async()=>hook.result.current.retry());expect(hook.result.current.route).toBe(full);hook.unmount();
 }finally{jest.useRealTimers();}
});
test('transient outage retries automatically but exit cancels retry timers',async()=>{
 jest.useFakeTimers();try{
 getFullPatrolRoute.mockRejectedValue({response:{status:503,data:{code:'ROUTING_UNAVAILABLE'}}});const hook=mount();await act(async()=>{});hook.unmount();
 await act(async()=>jest.advanceTimersByTime(60000));expect(getFullPatrolRoute).toHaveBeenCalledTimes(1);
 }finally{jest.useRealTimers();}
});
