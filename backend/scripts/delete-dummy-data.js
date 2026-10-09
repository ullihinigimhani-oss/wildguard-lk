// Removes everything created by scripts/seed-dummy-data.js. Matching is exact
// to the seed markers (email/name/code prefixes) so real rows are never touched,
// and children are deleted before their parents to satisfy foreign keys:
//
//   node scripts/delete-dummy-data.js
const prisma = require("../src/config/database");

const log = (label, count) => {
  if (count) console.log(`${label.padEnd(22)} ${count} removed`);
};

async function main() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: "seed-dummy-" } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  const parks = await prisma.park.findMany({
    where: { name: { startsWith: "[seed]" } },
    select: { id: true },
  });
  const parkIds = parks.map((p) => p.id);
  const animals = await prisma.animal.findMany({
    where: { animalCode: { startsWith: "SEED-ANIMAL-" } },
    select: { id: true },
  });
  const animalIds = animals.map((a) => a.id);
  const riskZones = await prisma.riskZone.findMany({
    where: { parkId: { in: parkIds } },
    select: { id: true },
  });
  const riskZoneIds = riskZones.map((r) => r.id);
  const alerts = await prisma.alert.findMany({
    where: {
      OR: [{ animalId: { in: animalIds } }, { riskZoneId: { in: riskZoneIds } }],
    },
    select: { id: true },
  });
  const alertIds = alerts.map((a) => a.id);
  const patrols = await prisma.patrol.findMany({
    where: { parkId: { in: parkIds } },
    select: { id: true },
  });
  const patrolIds = patrols.map((p) => p.id);
  const cameras = await prisma.cameraTrap.findMany({
    where: { parkId: { in: parkIds } },
    select: { id: true },
  });
  const cameraIds = cameras.map((c) => c.id);
  // Anonymous seeded reports have no user link, so their fixed description
  // marker is the only reliable trace left behind.
  const orphanReports = await prisma.communityReport.count({
    where: {
      OR: [
        { description: { startsWith: "Dummy community report" } },
        { reporterName: { startsWith: "Seed Reporter " } },
      ],
    },
  });

  const found = {
    users: userIds.length,
    parks: parkIds.length,
    animals: animalIds.length,
    riskZones: riskZoneIds.length,
    alerts: alertIds.length,
    patrols: patrolIds.length,
    cameraTraps: cameraIds.length,
    communityReports: orphanReports,
  };
  if (!Object.values(found).some((n) => n > 0)) {
    console.log("No seeded dummy data found. Nothing to delete.");
    return;
  }
  console.log("Found seeded dummy data:", found);
  console.log("Deleting in foreign-key-safe order...");

  if (alertIds.length || userIds.length) {
    const { count } = await prisma.alertAcknowledgement.deleteMany({
      where: { OR: [{ alertId: { in: alertIds } }, { userId: { in: userIds } }] },
    });
    log("alert acknowledgements", count);
  }
  if (patrolIds.length) {
    const { count } = await prisma.incident.deleteMany({
      where: { patrolId: { in: patrolIds } },
    });
    log("incidents (patrol-linked)", count);
  }
  if (userIds.length) {
    const { count } = await prisma.incident.deleteMany({
      where: { reporterId: { in: userIds } },
    });
    log("incidents", count);
  }
  {
    const { count } = await prisma.communityReport.deleteMany({
      where: {
        OR: [
          { reporterId: { in: userIds } },
          { reporterName: { startsWith: "Seed Reporter " } },
          // Anonymous seeded reports have no user link, so they are matched by
          // the fixed description marker every seeded report carries.
          { description: { startsWith: "Dummy community report" } },
        ],
      },
    });
    log("community reports", count);
  }
  if (patrolIds.length) {
    const { count } = await prisma.patrol.deleteMany({
      where: { id: { in: patrolIds } },
    });
    log("patrols", count);
  }
  if (alertIds.length) {
    const { count } = await prisma.alert.deleteMany({
      where: { id: { in: alertIds } },
    });
    log("alerts", count);
  }
  if (animalIds.length) {
    const { count } = await prisma.animal.deleteMany({
      where: { id: { in: animalIds } },
    });
    log("animals", count);
  }
  if (riskZoneIds.length) {
    const { count } = await prisma.riskZone.deleteMany({
      where: { id: { in: riskZoneIds } },
    });
    log("risk zones", count);
  }
  if (cameraIds.length) {
    const { count } = await prisma.cameraTrapImage.deleteMany({
      where: { cameraTrapId: { in: cameraIds } },
    });
    log("camera images", count);
  }
  if (cameraIds.length) {
    const { count } = await prisma.cameraTrap.deleteMany({
      where: { id: { in: cameraIds } },
    });
    log("camera traps", count);
  }
  if (userIds.length) {
    const { count } = await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
    log("users", count);
  }
  if (parkIds.length) {
    const { count } = await prisma.park.deleteMany({
      where: { id: { in: parkIds } },
    });
    log("parks", count);
  }

  console.log("Cleanup complete.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error("Cleanup failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });