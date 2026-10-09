const validate = require("../../../src/validators/plannedRoute.validator");
const route = (types) =>
  types.map((type, order) => ({
    type,
    order,
    latitude: 7.5 + order / 100,
    longitude: 80.7,
    label: type,
    note: null,
  }));
test.each([
  ["START", "END"],
  ["START", "CHECKPOINT", "CHECKPOINT", "END"],
  ["START", "CHECKPOINT", "HIGH_RISK", "OBSERVATION", "CHECKPOINT", "END"],
])("preserves the full ordered route %j", (...types) => {
  const points = route(types);
  expect(validate(points)).toEqual(points);
});
test.each([
  [],
  ["CHECKPOINT", "END"],
  ["START", "CHECKPOINT"],
  ["START", "START", "END"],
  ["START", "END", "END"],
  ["CHECKPOINT", "START", "END"],
  ["START", "END", "CHECKPOINT"],
  ["START", "UNKNOWN", "END"],
])("rejects invalid route %j", (...types) =>
  expect(() => validate(route(types))).toThrow(),
);
test.each([
  { latitude: 91 },
  { latitude: -91 },
  { longitude: 181 },
  { longitude: -181 },
  { latitude: "7.5" },
  { latitude: null },
  { longitude: NaN },
  { latitude: Infinity },
  { order: 2 },
  { label: "a".repeat(201) },
  { note: 5 },
  { note: "a".repeat(501) },
])("rejects invalid waypoint %j", (patch) => {
  const points = route(["START", "END"]);
  Object.assign(points[0], patch);
  expect(() => validate(points)).toThrow();
});
test("rejects missing route and caps route payload size", () => {
  expect(() => validate()).toThrow();
  expect(() =>
    validate(route(["START", ...Array(99).fill("CHECKPOINT"), "END"])),
  ).toThrow();
});
test("strips unknown internal fields", () => {
  const points = route(["START", "END"]);
  points[0].patrolId = "foreign";
  expect(validate(points)[0]).not.toHaveProperty("patrolId");
});
