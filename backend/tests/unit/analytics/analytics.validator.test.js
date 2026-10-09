const {
  validateAnalyticsQuery,
  INCIDENT_TYPES,
  INCIDENT_STATUSES,
  PATROL_TYPES,
  PATROL_STATUSES,
  PATROL_PRIORITIES,
  REPORT_TYPES,
  REPORT_STATUSES,
} = require("../../../src/validators/analytics.validator");

function expect400(fn, field) {
  let raised = null;
  try {
    fn();
  } catch (error) {
    raised = error;
  }
  expect(raised).toBeTruthy();
  expect(raised.status).toBe(400);
  expect(raised.validationError).toBe(true);
  expect(Object.hasOwn(raised.fields, field)).toBe(true);
}

describe("analytics validator", () => {
  test("defaults period to month and accepts common filters", () => {
    const result = validateAnalyticsQuery(
      {
        from: "2026-10-01",
        to: "2026-10-31",
        area: "Weerawila",
      },
      {},
    );
    expect(result.period).toBe("month");
    expect(result.from.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(result.to.toISOString()).toBe("2026-10-31T00:00:00.000Z");
    expect(result.area).toBe("Weerawila");
    expect(result.type).toBeUndefined();
    expect(result.status).toBeUndefined();
  });

  test("accepts incident type and status when the context allows them", () => {
    const result = validateAnalyticsQuery(
      { type: "poaching_snare", status: "pending" },
      {
        types: INCIDENT_TYPES,
        statuses: INCIDENT_STATUSES,
        allowType: true,
        allowStatus: true,
      },
    );
    expect(result.type).toBe("POACHING_SNARE");
    expect(result.status).toBe("PENDING");
  });

  test("rejects a type that does not exist in the data model", () => {
    expect400(
      () =>
        validateAnalyticsQuery(
          { type: "DRONE_SIGHTING" },
          { types: INCIDENT_TYPES, allowType: true },
        ),
      "type",
    );
  });

  test("rejects an incident-only status for the patrol context", () => {
    expect400(
      () =>
        validateAnalyticsQuery(
          { status: "RESPONDING" },
          {
            types: PATROL_TYPES,
            statuses: PATROL_STATUSES,
            allowType: true,
            allowStatus: true,
          },
        ),
      "status",
    );
  });

  test("rejects priority unless the entity supports it", () => {
    expect400(() => validateAnalyticsQuery({ priority: "HIGH" }, {}), "priority");
    const result = validateAnalyticsQuery(
      { priority: "high" },
      { priorities: PATROL_PRIORITIES, allowPriority: true },
    );
    expect(result.priority).toBe("HIGH");
  });

  test("rejects unknown period values", () => {
    expect400(() => validateAnalyticsQuery({ period: "year" }, {}), "period");
  });

  test("rejects a date range where the end precedes the start", () => {
    expect400(
      () =>
        validateAnalyticsQuery(
          { from: "2026-11-01", to: "2026-10-01" },
          {},
        ),
      "to",
    );
  });

  test("rejects malformed dates", () => {
    expect400(() => validateAnalyticsQuery({ from: "01-10-2026" }, {}), "from");
  });

  test("rejects an overly long area filter", () => {
    expect400(
      () => validateAnalyticsQuery({ area: "x".repeat(201) }, {}),
      "area",
    );
  });

  test("accepts day and week periods", () => {
    expect(validateAnalyticsQuery({ period: "day" }, {}).period).toBe("day");
    expect(validateAnalyticsQuery({ period: "week" }, {}).period).toBe("week");
  });

  test("keeps community report types and statuses distinct from incidents", () => {
    const result = validateAnalyticsQuery(
      { type: "HUMAN_WILDLIFE_CONFLICT", status: "VERIFIED" },
      {
        types: REPORT_TYPES,
        statuses: REPORT_STATUSES,
        allowType: true,
        allowStatus: true,
      },
    );
    expect(result.type).toBe("HUMAN_WILDLIFE_CONFLICT");
    expect(result.status).toBe("VERIFIED");
  });
});