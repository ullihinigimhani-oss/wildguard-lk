import {
  advanceReached,
  destinationsFor,
  offRoute,
  remainingSummary,
  routeNeedsRefresh,
} from "../../src/utils/liveNavigation";
import {
  clearNavigationSessions,
  reachedFor,
  saveReached,
  sessionKey,
} from "../../src/utils/navigationSession";
import { readPlannedRoute } from "../../src/utils/plannedPatrolRoute";
import { buildPlannedMapDocument } from "../../src/components/patrol/plannedMapDocument";
import {
  NAVIGATION,
  shouldRecordSample,
} from "../../../shared/patrolNavigation";
const points = ["START", "CHECKPOINT", "HIGH_RISK", "OBSERVATION", "END"].map(
  (type, order) => ({
    waypointId: String(order),
    type,
    order,
    latitude: 7.5 + order / 1000,
    longitude: 80.7,
  }),
);
const position = (point = points[0]) => ({
  ...point,
  accuracy: 10,
  timestamp: Date.now(),
});
const route = {
  destination: { waypointId: "1" },
  geometry: {
    type: "LineString",
    coordinates: [
      [80.7, 7.5],
      [80.7, 7.501],
    ],
  },
  distanceMeters: 200,
  durationSeconds: 120,
};
test("authoritative IDs retained and HIGH_RISK skipped while observation remains destination", () => {
  const destinations = destinationsFor(points);
  expect(destinations.map((p) => p.type)).toEqual([
    "START",
    "CHECKPOINT",
    "OBSERVATION",
    "END",
  ]);
  const parsed = readPlannedRoute(
    points.map((p) => ({ ...p, id: p.waypointId })),
  );
  expect(parsed.points[1].waypointId).toBe("1");
  expect(parsed.points[2].color).toBe("#b42332");
});
test("away GPS targets START, near START advances to checkpoint", () => {
  const destinations = destinationsFor(points);
  expect(
    advanceReached(
      destinations,
      new Set(),
      position({ latitude: 7.49, longitude: 80.7 }),
    ).size,
  ).toBe(0);
  expect([...advanceReached(destinations, new Set(), position())]).toEqual([
    "0",
  ]);
});
test("arrival progresses in persisted order, skips risk and reaches END without lifecycle mutation", () => {
  const destinations = destinationsFor(points);
  let reached = new Set();
  for (const point of destinations)
    reached = advanceReached(destinations, reached, position(point));
  expect([...reached]).toEqual(["0", "1", "3", "4"]);
  expect(reached.has("2")).toBe(false);
});
test("poor GPS accuracy cannot mark a point reached", () => {
  expect(
    advanceReached(points, new Set(), { ...position(), accuracy: 80 }).size,
  ).toBe(0);
  expect(NAVIGATION.arrivalMeters).toBe(40);
});
test("jitter remains on route, substantial deviation triggers controlled reroute", () => {
  expect(
    offRoute(
      position({ latitude: 7.5005, longitude: 80.70001 }),
      route.geometry,
    ),
  ).toBe(false);
  const far = position({ latitude: 7.5005, longitude: 80.702 });
  expect(offRoute(far, route.geometry)).toBe(true);
  expect(
    routeNeedsRefresh(
      route,
      points[1],
      far,
      { position: position(), time: Date.now() },
      Date.now(),
      2,
    ),
  ).toBe(false);
  expect(routeNeedsRefresh(route, points[1], far, null, Date.now(), 3)).toBe(
    true,
  );
});
test("ORS summary decreases along geometry without using planned straight distance", () => {
  const summary = remainingSummary(
    route,
    position({ latitude: 7.5005, longitude: 80.7 }),
  );
  expect(summary.distanceMeters).toBeCloseTo(100);
  expect(summary.durationSeconds).toBeCloseTo(60);
  expect(remainingSummary(null, position())).toBeNull();
});
test("sampling requires minimum time and meaningful distance or elapsed time", () => {
  const now = Date.now(),
    last = { ...points[0], recordedAt: new Date(now).toISOString() };
  const sample = (time, point = points[0]) => ({
    ...point,
    recordedAt: new Date(now + time).toISOString(),
  });
  expect(shouldRecordSample(last, sample(5000, points[1]))).toBe(false);
  expect(shouldRecordSample(last, sample(15000))).toBe(false);
  expect(shouldRecordSample(last, sample(15000, points[1]))).toBe(true);
  expect(shouldRecordSample(last, sample(60000))).toBe(true);
});
test("progress survives resume, isolates Ranger/patrol start and clears logout", () => {
  clearNavigationSessions();
  const patrol = { id: "p", actualStartTime: "start" };
  const key = sessionKey("a", patrol);
  saveReached(key, new Set(["0", "1"]));
  expect(reachedFor(key).size).toBe(2);
  expect(reachedFor(sessionKey("b", patrol)).size).toBe(0);
  expect(
    reachedFor(sessionKey("a", { ...patrol, actualStartTime: "new" })).size,
  ).toBe(0);
  clearNavigationSessions();
  expect(reachedFor(key).size).toBe(0);
});
test("live map separates GPS/ORS/actual layers, omits planned straight polyline and uses dynamic bridge", () => {
  const parsed = readPlannedRoute(
    points.map((p) => ({ ...p, id: p.waypointId })),
  );
  const html = buildPlannedMapDocument(parsed.points, parsed.segments, true);
  expect(html).toContain("var live=true");
  expect(html).toContain("if(!live)data.segments");
  expect(html).toContain("window.updatePatrolNavigation");
  expect(html).toContain("Navigation Route · foot-walking");
  expect(html).toContain("Recorded GPS trail");
  expect(html).toContain("Re-centre");
  expect(html).not.toContain("ORS_API_KEY");
});
test("risk areas have separate translucent-red pane, strict rings and text-only metadata popups", () => {
  const parsed = readPlannedRoute(
    points.map((p) => ({ ...p, id: p.waypointId })),
  );
  const html = buildPlannedMapDocument(parsed.points, parsed.segments, true);
  expect(html).toContain("map.createPane('riskAreas')");
  expect(html).toContain("fillOpacity:0.22");
  expect(html).toContain("color:'#b42332'");
  expect(html).toContain("title.textContent='Risk Zone'");
  expect(html).toContain("[zone.name,zone.riskLevel,zone.description]");
  expect(html).toContain("if(nextRiskSignature!==riskSignature)");
  expect(html).toContain("ring[0][0]!==ring[ring.length-1][0]");
  expect(html).not.toContain("zone.type");
});
