import {
  readPlannedRoute,
  plannedDistanceKm,
} from "../../src/utils/plannedPatrolRoute";
import { buildPlannedMapDocument } from "../../src/components/patrol/plannedMapDocument";
import { plannedRoute } from "../fixtures/plannedRoute";

test("preserves saved coordinates and sorts persisted order without mutating API data", () => {
  const input = plannedRoute().reverse(),
    original = JSON.stringify(input);
  const result = readPlannedRoute(input);
  expect(result.points.map((p) => p.order)).toEqual([0, 1, 2, 3, 4, 5]);
  expect(result.points.map((p) => [p.latitude, p.longitude])).toEqual(
    plannedRoute().map((p) => [p.latitude, p.longitude]),
  );
  expect(
    result.points.filter((p) => p.type === "CHECKPOINT").map((p) => p.symbol),
  ).toEqual(["1", "2"]);
  expect(result.points[4].label).toBe("Checkpoint 2");
  expect(result.points[2]).toMatchObject({
    typeLabel: "High Risk Area",
    color: "#b42332",
    symbol: "!",
    note: "Check previous snare locations carefully.",
  });
  expect(result.points[3]).toMatchObject({
    typeLabel: "Observation Point",
    symbol: "O",
    color: "#63558b",
  });
  expect(result.segments).toHaveLength(1);
  expect(result.invalidCount).toBe(0);
  expect(JSON.stringify(input)).toBe(original);
});
test.each([undefined, null, []])("historical empty route %j is safe", (input) =>
  expect(readPlannedRoute(input).points).toEqual([]),
);
test.each([NaN, Infinity, null, "7.5", 91, -91])(
  "invalid latitude %j is skipped without drawing a shortcut",
  (latitude) => {
    const input = plannedRoute();
    input[2].latitude = latitude;
    const result = readPlannedRoute(input);
    expect(result.points).toHaveLength(5);
    expect(result.invalidCount).toBe(1);
    expect(result.segments.map((s) => s.map((p) => p.order))).toEqual([
      [0, 1],
      [3, 4, 5],
    ]);
  },
);
test.each([
  { longitude: 181 },
  { longitude: -181 },
  { order: -1 },
  { order: 1.5 },
  { type: "UNKNOWN" },
])("invalid point %j is safe", (patch) => {
  const input = plannedRoute();
  Object.assign(input[2], patch);
  expect(readPlannedRoute(input).invalidCount).toBeGreaterThan(0);
});
test("missing and duplicate sequence numbers cannot fabricate a continuous route", () => {
  const missing = plannedRoute();
  missing.splice(2, 1);
  expect(readPlannedRoute(missing).invalidCount).toBe(1);
  const duplicate = plannedRoute();
  duplicate[2].order = 1;
  expect(readPlannedRoute(duplicate).invalidCount).toBeGreaterThan(0);
  expect(readPlannedRoute({ points: [] }).invalidCount).toBe(1);
});
test("single point is supported and distance matches manager Haversine calculation", () => {
  expect(readPlannedRoute([plannedRoute()[0]]).points).toHaveLength(1);
  expect(plannedDistanceKm([])).toBe(0);
  expect(plannedDistanceKm([plannedRoute()[0]])).toBe(0);
  expect(
    plannedDistanceKm([
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
    ]),
  ).toBeCloseTo(111.195, 2);
});
test("map document escapes manager text and contains no credentials or routing calls", () => {
  const input = plannedRoute();
  input[2].label = "</script><script>secret()</script>";
  const data = readPlannedRoute(input);
  const html = buildPlannedMapDocument(data.points, data.segments);
  expect(html).not.toContain(input[2].label);
  expect(html).toContain("\\u003c/script>");
  expect(html).toContain("label.textContent=point.label");
  expect(html).toContain("note.textContent=point.note");
  expect(html).toContain("map.fitBounds");
  expect(html).toContain("map.setView(positions[0],15)");
  expect(html).toContain("https://tile.openstreetmap.org");
  expect(html).not.toMatch(
    /ORS_API_KEY|Authorization|api.heigit.org|navigator.geolocation|watchPosition/,
  );
});
