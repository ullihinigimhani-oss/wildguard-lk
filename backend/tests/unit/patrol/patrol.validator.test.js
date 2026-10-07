const {
  validatePatrolCreation,
  validatePatrolFilters,
} = require("../../../src/validators/patrol.validator");

const valid = () => ({
  patrol_title: "Northern boundary sweep",
  park_ranger_area: "park-1",
  assigned_ranger: "ranger-1",
  patrol_date: "2026-10-10",
  start_time: "06:30",
  expected_end_time: "10:00",
  instructions_notes: "Check the northern fence line.",
  patrol_type: "ANTI_POACHING",
  priority: "HIGH",
  start_location: "Main gate",
  latitude: 7.5,
  longitude: 80.7,
});
function expectFailure(overrides, field) {
  try {
    validatePatrolCreation({ ...valid(), ...overrides });
  } catch (error) {
    expect(error.status).toBe(400);
    expect(error.validationError).toBe(true);
    expect(error.fields).toHaveProperty(field);
    return error;
  }
  throw new Error("expected validation to fail for " + field);
}
test("normalizes a complete payload", () => {
  const result = validatePatrolCreation(valid());
  expect(result).toEqual({
    routeName: "Northern boundary sweep",
    parkId: "park-1",
    rangerId: "ranger-1",
    scheduledDate: new Date("2026-10-10T00:00:00.000Z"),
    startTime: new Date("2026-10-10T06:30:00+05:30"),
    endTime: new Date("2026-10-10T10:00:00+05:30"),
    description: "Check the northern fence line.",
    patrolType: "ANTI_POACHING",
    priority: "HIGH",
    startLocation: "Main gate",
    latitude: 7.5,
    longitude: 80.7,
  });
});
test("applies defaults and nulls for optional fields", () => {
  const result = validatePatrolCreation({
    patrol_title: "  Morning loop  ",
    park_ranger_area: " park-1 ",
    assigned_ranger: " ranger-1 ",
    patrol_date: "2026-10-10",
    start_time: "06:30",
    expected_end_time: "10:00",
    instructions_notes: "",
    patrol_type: "",
    priority: "",
    start_location: "",
    latitude: "",
    longitude: "",
  });
  expect(result.routeName).toBe("Morning loop");
  expect(result.parkId).toBe("park-1");
  expect(result.rangerId).toBe("ranger-1");
  expect(result.patrolType).toBe("ROUTINE");
  expect(result.priority).toBe("MEDIUM");
  expect(result.description).toBeNull();
  expect(result.startLocation).toBeNull();
  expect(result.latitude).toBeNull();
  expect(result.longitude).toBeNull();
});
test("accepts coordinate strings and leaves missing coordinates null", () => {
  const result = validatePatrolCreation({
    ...valid(),
    latitude: "7.5",
    longitude: -80.7,
  });
  expect(result.latitude).toBe(7.5);
  expect(result.longitude).toBe(-80.7);
  const omitted = validatePatrolCreation({
    patrol_title: "Short loop",
    park_ranger_area: "park-1",
    assigned_ranger: "ranger-1",
    patrol_date: "2026-10-10",
    start_time: "06:30",
    expected_end_time: "07:00",
  });
  expect(omitted.latitude).toBeNull();
  expect(omitted.longitude).toBeNull();
  expect(omitted.startLocation).toBeNull();
  expect(omitted.description).toBeNull();
});
test.each([
  [{ patrol_title: "go" }, "patrol_title"],
  [{ patrol_title: "x".repeat(151) }, "patrol_title"],
  [{ patrol_title: 123 }, "patrol_title"],
  [{ patrol_title: undefined }, "patrol_title"],
  [{ park_ranger_area: "" }, "park_ranger_area"],
  [{ park_ranger_area: 42 }, "park_ranger_area"],
  [{ park_ranger_area: "p".repeat(129) }, "park_ranger_area"],
  [{ assigned_ranger: "" }, "assigned_ranger"],
  [{ assigned_ranger: null }, "assigned_ranger"],
  [{ patrol_date: "" }, "patrol_date"],
  [{ patrol_date: "10/10/2026" }, "patrol_date"],
  [{ patrol_date: "2026-02-30" }, "patrol_date"],
  [{ patrol_date: "2026-13-01" }, "patrol_date"],
  [{ patrol_date: "2026-1-5" }, "patrol_date"],
  [{ patrol_date: 20261010 }, "patrol_date"],
  [{ start_time: "6:30" }, "start_time"],
  [{ start_time: "24:00" }, "start_time"],
  [{ start_time: "10:60" }, "start_time"],
  [{ expected_end_time: "9:00" }, "expected_end_time"],
  [{ start_time: "10:00", expected_end_time: "10:00" }, "expected_end_time"],
  [{ start_time: "12:00", expected_end_time: "09:00" }, "expected_end_time"],
  [{ instructions_notes: "n".repeat(2001) }, "instructions_notes"],
  [{ instructions_notes: 123 }, "instructions_notes"],
  [{ patrol_type: "SLEEPING" }, "patrol_type"],
  [{ patrol_type: 7 }, "patrol_type"],
  [{ priority: "URGENT" }, "priority"],
  [{ priority: true }, "priority"],
  [{ start_location: "x" }, "start_location"],
  [{ start_location: "s".repeat(201) }, "start_location"],
  [{ start_location: 5 }, "start_location"],
  [{ latitude: 91 }, "latitude"],
  [{ latitude: -90.5 }, "latitude"],
  [{ latitude: "north" }, "latitude"],
  [{ latitude: true }, "latitude"],
  [{ longitude: 181 }, "longitude"],
  [{ longitude: "-200.5" }, "longitude"],
  [{ longitude: {} }, "longitude"],
])("rejects %j focusing on %s", (overrides, field) => {
  expectFailure(overrides, field);
});
test.each([null, "payload", 42, ["patrol"]])(
  "rejects non-object body %j",
  (body) => {
    expect(() => validatePatrolCreation(body)).toThrow(
      "Please check your patrol details.",
    );
  },
);
test("aggregates every field error into one response", () => {
  const error = expectFailure(
    {
      patrol_title: "",
      park_ranger_area: "",
      assigned_ranger: "",
      patrol_date: "nope",
      start_time: "bad",
      expected_end_time: "worse",
    },
    "patrol_title",
  );
  expect(Object.keys(error.fields).sort()).toEqual([
    "assigned_ranger",
    "expected_end_time",
    "park_ranger_area",
    "patrol_date",
    "patrol_title",
    "start_time",
  ]);
});
const emptyFilters = {
  search: "",
  status: "",
  patrolType: "",
  priority: "",
  rangerId: "",
  date: "",
  page: 1,
};
test("an empty filter query defaults to page 1", () => {
  expect(validatePatrolFilters({})).toEqual(emptyFilters);
  expect(validatePatrolFilters(undefined)).toEqual(emptyFilters);
});
test("normalizes a complete filter query", () => {
  expect(
    validatePatrolFilters({
      search: "  fence  ",
      status: "IN_PROGRESS",
      patrolType: "ANTI_POACHING",
      priority: "HIGH",
      rangerId: "ranger-1",
      date: "2026-10-10",
      page: "3",
    }),
  ).toEqual({
    search: "fence",
    status: "IN_PROGRESS",
    patrolType: "ANTI_POACHING",
    priority: "HIGH",
    rangerId: "ranger-1",
    date: "2026-10-10",
    page: 3,
  });
});
test.each([
  [{ status: "SLEEPING" }],
  [{ patrolType: "NAPPING" }],
  [{ priority: "URGENT" }],
  [{ date: "2026-02-30" }],
  [{ date: "10/10/2026" }],
  [{ page: "0" }],
  [{ page: "abc" }],
  [{ page: "-2" }],
  [{ search: "x".repeat(121) }],
  [{ rangerId: "r".repeat(129) }],
])("rejects invalid filters %j", (query) => {
  let error;
  try {
    validatePatrolFilters(query);
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeDefined();
  expect(error.message).toBe("Invalid patrol filters.");
  expect(error.status).toBe(400);
  expect(error.authError).toBe(true);
});
