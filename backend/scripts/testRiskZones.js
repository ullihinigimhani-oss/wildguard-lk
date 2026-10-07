// Controlled local test-data utility. The ignored manifest contains no credentials.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { Prisma } = require("@prisma/client");
const db = require("../src/config/database");
const riskService = require("../src/services/riskZone.service");
const navigation = require("../src/services/navigation.service");
const {
  zonePolygon,
  pointInGeometry,
  routeIntersectsZones,
  withinLimits,
} = require("../../shared/riskGeometry");
const manifestPath = path.resolve(__dirname, "../.vite/test-risk-plan.json");
const plan = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const ids = plan.records.map((r) => r.id);
const save = () =>
  fs.writeFileSync(manifestPath, JSON.stringify(plan, null, 2));
const hash = (rows) =>
  createHash("sha256").update(JSON.stringify(rows)).digest("hex");
async function snapshot(client, excludeTests = false) {
  const result = {};
  for (const model of Prisma.dmmf.datamodel.models) {
    const delegate = model.name[0].toLowerCase() + model.name.slice(1);
    const rows = await client[delegate].findMany({
      ...(excludeTests && model.name === "RiskZone"
        ? { where: { id: { notIn: ids } } }
        : {}),
      orderBy: { id: "asc" },
    });
    result[model.name] = { count: rows.length, hash: hash(rows) };
  }
  return result;
}
async function verify() {
  const rows = await db.riskZone.findMany({
    where: { id: { in: ids } },
    include: { park: { select: { id: true, name: true } } },
  });
  assert.equal(rows.length, plan.records.length);
  for (const proposed of plan.records) {
    const actual = rows.find((r) => r.id === proposed.id);
    for (const [key, value] of Object.entries(proposed))
      assert.deepEqual(actual[key], value);
    assert.equal(actual.park.id, plan.parkId);
  }
  const selected = await riskService.forPark(plan.parkId);
  for (const record of plan.records)
    assert.equal(
      selected.some((z) => z.id === record.id),
      record.isActive,
    );
  return {
    records: rows.map(({ park, ...r }) => ({ ...r, parkName: park.name })),
    activeSelected: selected.filter((z) => ids.includes(z.id)).map((z) => z.id),
    inactiveIgnored: true,
  };
}
async function main() {
  const mode = process.argv[2];
  assert.ok(
    ["create", "verify", "verify-route", "remove"].includes(mode),
    "Use create, verify, verify-route or remove.",
  );
  assert.equal(ids.length, 3);
  assert.equal(new Set(ids).size, 3);
  for (const r of plan.records) {
    assert.ok(r.id.startsWith("test_risk_") && r.name.startsWith("TEST -"));
    assert.equal(r.parkId, plan.parkId);
  }
  if (mode === "create") {
    const patrol = await db.patrol.findUnique({
      where: { id: plan.patrolId },
      include: { waypoints: true },
    });
    assert.equal(patrol.parkId, plan.parkId);
    assert.equal(patrol.rangerId, plan.rangerId);
    assert.equal(patrol.status, "IN_PROGRESS");
    const zones = plan.records.map((r) => ({ ...r, geometry: zonePolygon(r) }));
    assert.ok(withinLimits(zones));
    for (const z of zones) {
      assert.ok(!pointInGeometry(plan.input.currentLocation, z.geometry));
      assert.ok(patrol.waypoints.every((w) => !pointInGeometry(w, z.geometry)));
      assert.ok(routeIntersectsZones(plan.route.geometry, [z]));
    }
    console.log(
      JSON.stringify({ proposedRecords: plan.records, park: plan.parkName }),
    );
    await db.$transaction(
      async (tx) => {
        assert.equal(
          await tx.riskZone.count({
            where: {
              OR: [
                { id: { in: ids } },
                {
                  name: { in: plan.records.map((r) => r.name) },
                  parkId: plan.parkId,
                },
              ],
            },
          }),
          0,
        );
        const before = await snapshot(tx);
        for (const data of plan.records) await tx.riskZone.create({ data });
        const after = await snapshot(tx, true);
        assert.deepEqual(
          after,
          before,
          "An existing record changed; roll back.",
        );
        plan.existingDataUnchanged = true;
      },
      { isolationLevel: "Serializable", timeout: 60000 },
    );
    plan.created = true;
    save();
    console.log(
      JSON.stringify({
        created: true,
        existingDataUnchanged: true,
        verification: await verify(),
      }),
    );
  } else if (mode === "verify") {
    console.log(JSON.stringify(await verify()));
  } else if (mode === "verify-route") {
    await verify();
    assert.ok(
      !plan.navigationAttempted,
      "One navigation verification has already been attempted.",
    );
    plan.navigationAttempted = true;
    save();
    const realFetch = global.fetch;
    let httpStatus = null,
      avoidanceApplied = false;
    global.fetch = async (url, options) => {
      avoidanceApplied = Boolean(
        JSON.parse(options.body).options?.avoid_polygons,
      );
      const response = await realFetch(url, options);
      httpStatus = response.status;
      return response;
    };
    try {
      const route = await navigation.route(plan.input, plan.rangerId);
      plan.navigationResult = {
        riskZoneSelected: route.riskZones.some((z) => ids.includes(z.id)),
        avoidanceApplied,
        httpStatus,
        routeReturned: true,
        intersectsTestPolygon: routeIntersectsZones(
          route.geometry,
          plan.records
            .filter((r) => r.isActive)
            .map((r) => ({ geometry: zonePolygon(r) })),
        ),
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
        profile: route.profile,
      };
    } catch (error) {
      plan.navigationResult = {
        riskZoneSelected:
          error.riskZones?.some((z) => ids.includes(z.id)) ?? false,
        avoidanceApplied,
        httpStatus,
        routeReturned: false,
        error: error.navigationError ? error.code : "VERIFICATION_FAILED",
      };
    } finally {
      global.fetch = realFetch;
      save();
    }
    console.log(JSON.stringify(plan.navigationResult));
  } else {
    // Explicit manual cleanup only: exact IDs AND all original fields must match.
    await db.$transaction(async (tx) => {
      const existing = await tx.riskZone.findMany({
        where: { id: { in: ids } },
      });
      for (const actual of existing) {
        const proposed = plan.records.find((r) => r.id === actual.id);
        for (const [key, value] of Object.entries(proposed))
          assert.deepEqual(
            actual[key],
            value,
            "Refuse to delete modified test data.",
          );
      }
      assert.equal(
        await tx.alert.count({ where: { riskZoneId: { in: ids } } }),
        0,
        "Refuse cleanup while alerts reference these records.",
      );
      const result = await tx.riskZone.deleteMany({
        where: { OR: plan.records },
      });
      console.log(
        JSON.stringify({ removedOnlyExactTestRecords: result.count }),
      );
    });
  }
}
main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        error:
          error instanceof assert.AssertionError
            ? error.message
            : "Controlled test-data operation failed; no credentials are reported.",
      }),
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
