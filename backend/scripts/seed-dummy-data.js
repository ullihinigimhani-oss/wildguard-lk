// Seeds clearly-tagged dummy data so the Park Manager dashboard's analytics
// panels (patrols / incidents / community reports) plus risk zones, alerts,
// wildlife tracking and camera traps have realistic rows to aggregate.
//
//   node scripts/seed-dummy-data.js
//
// Everything created carries a durable marker:
//   - users:    email begins with "seed-dummy-"
//   - parks:    name begins with "[seed]"
//   - animals:  animalCode begins with "SEED-ANIMAL-"
//   - cameras:  cameraCode begins with "SEED-CAMERA-"
// which makes `node scripts/delete-dummy-data.js` able to remove precisely
// this data (and nothing else) in foreign-key-safe order.
const prisma = require("../src/config/database");
const bcrypt = require("bcryptjs");

const TAG =
  process.env.SEED_TAG ||
  "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const PASSWORD = "DummyPass-123";
const HASH = bcrypt.hashSync(PASSWORD, 10);

const daysAgo = (n, hour = 8) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
};

const email = (role) => `seed-dummy-${TAG}-${role}@wildguard.test`;

const PATROLS = [
  ["Yala, Thalgasmankada", "COMPLETED", "ROUTINE", "LOW", 1],
  ["Yala, Katagamuwa", "COMPLETED", "ANTI_POACHING", "HIGH", 4],
  ["Yala, Buttala", "IN_PROGRESS", "WILDLIFE_MONITORING", "MEDIUM", 6],
  ["Yala, Sella Kataragama", "SCHEDULED", "CONFLICT_RESPONSE", "HIGH", 9],
  ["Yala, Buthawa", "COMPLETED", "ROUTINE", "MEDIUM", 12],
  ["Yala North, Marawa", "CANCELLED", "SPECIAL", "LOW", 18],
  ["Udawalawe, Seenuwala", "COMPLETED", "ANTI_POACHING", "MEDIUM", 8],
  ["Udawalawe, Kalthota", "IN_PROGRESS", "ROUTINE", "LOW", 20],
  ["Udawalawe, Weherayaya", "SCHEDULED", "ANTI_POACHING", "HIGH", 27],
  ["Udawalawe, Hathmaliha", "COMPLETED", "WILDLIFE_MONITORING", "LOW", 34],
];

const INCIDENTS = [
  ["WILDLIFE_CONFLICT", "RESOLVED", "Yala, Katagamuwa", 2, true],
  ["POACHING_SNARE", "VERIFIED", "Yala, Buttala", 5],
  ["WILDLIFE_CONFLICT", "RESPONDING", "Yala, Sella Kataragama", 7, true],
  ["ANIMAL_CARCASS", "UNDER_REVIEW", "Yala, Thalgasmankada", 10],
  ["ILLEGAL_CAMPSITE", "PENDING", "Yala, Buthawa", 13],
  ["WILDLIFE_CONFLICT", "VERIFIED", "Yala North, Marawa", 17],
  ["POACHING_SNARE", "REJECTED", "Yala, Katagamuwa", 22],
  ["WILDLIFE_CONFLICT", "PENDING", "Yala, Buttala", 25, true],
  ["ANIMAL_CARCASS", "RESOLVED", "Yala, Sella Kataragama", 30],
  ["ILLEGAL_CAMPSITE", "UNDER_REVIEW", "Yala, Buthawa", 37],
  ["WILDLIFE_CONFLICT", "RESOLVED", "Udawalawe, Seenuwala", 3, true],
  ["POACHING_SNARE", "VERIFIED", "Udawalawe, Kalthota", 11],
  ["WILDLIFE_CONFLICT", "RESPONDING", "Udawalawe, Weherayaya", 21, true],
  ["ANIMAL_CARCASS", "PENDING", "Udawalawe, Hathmaliha", 33],
];

const REPORTS = [
  ["WILDLIFE_SIGHTING", "Asian Elephant", "Yala, Katagamuwa", 1, "PENDING"],
  ["HUMAN_WILDLIFE_CONFLICT", "Asian Elephant", "Yala, Buttala", 3, "VERIFIED"],
  ["SUSPICIOUS_ACTIVITY", null, "Yala, Buthawa", 6, "UNDER_REVIEW"],
  ["WILDLIFE_SIGHTING", "Leopard", "Yala, Thalgasmankada", 9, "PENDING"],
  ["HUMAN_WILDLIFE_CONFLICT", "Wild Boar", "Yala North, Marawa", 14, "VERIFIED"],
  ["WILDLIFE_SIGHTING", "Sloth Bear", "Yala, Sella Kataragama", 19, "REJECTED"],
  ["HUMAN_WILDLIFE_CONFLICT", "Asian Elephant", "Yala, Katagamuwa", 24, "PENDING"],
  ["WILDLIFE_SIGHTING", "Sambar Deer", "Yala, Buttala", 29, "VERIFIED"],
  ["SUSPICIOUS_ACTIVITY", null, "Udawalawe, Seenuwala", 7, "PENDING"],
  ["HUMAN_WILDLIFE_CONFLICT", "Asian Elephant", "Udawalawe, Kalthota", 16, "UNDER_REVIEW"],
  ["WILDLIFE_SIGHTING", "Asian Elephant", "Udawalawe, Weherayaya", 26, "PENDING"],
  ["WILDLIFE_SIGHTING", "Golden Jackal", "Udawalawe, Hathmaliha", 35, "VERIFIED"],
];

const LOCATIONS = [
  [6.4708, 81.3776, "Yala, Thalgasmankada"],
  [6.4244, 81.3607, "Yala, Katagamuwa"],
  [6.5706, 81.1872, "Yala, Buttala"],
  [6.4314, 81.3654, "Yala, Sella Kataragama"],
  [6.7017, 81.3669, "Yala, Buthawa"],
  [6.7954, 81.4203, "Yala North, Marawa"],
  [6.4889, 80.8753, "Udawalawe, Seenuwala"],
  [6.5465, 80.5991, "Udawalawe, Kalthota"],
  [6.5045, 80.7836, "Udawalawe, Weherayaya"],
  [6.5320, 80.9361, "Udawalawe, Hathmaliha"],
];

async function main() {
  const [yala, udawalawe] = await Promise.all([
    prisma.park.create({
      data: {
        name: `[seed] ${TAG} Yala National Park`,
        location: "Southern Province, Sri Lanka",
        description: "Dummy data — delete with delete-dummy-data.js",
      },
    }),
    prisma.park.create({
      data: {
        name: `[seed] ${TAG} Udawalawe National Park`,
        location: "Sabaragamuwa / Uva, Sri Lanka",
        description: "Dummy data — delete with delete-dummy-data.js",
      },
    }),
  ]);

  const [manager, ranger, yalaLiaison, udawalaweRanger, communityUser] =
    await Promise.all([
      prisma.user.create({
        data: {
          name: "Seed Park Manager",
          email: email("manager"),
          passwordHash: HASH,
          role: "PARK_MANAGER",
          approvalStatus: "APPROVED",
          parkId: yala.id,
          phone: "0700000001",
        },
      }),
      prisma.user.create({
        data: {
          name: "Seed Ranger",
          email: email("ranger"),
          passwordHash: HASH,
          role: "RANGER",
          approvalStatus: "APPROVED",
          parkId: yala.id,
          phone: "0700000002",
        },
      }),
      prisma.user.create({
        data: {
          name: "Seed Community Liaison",
          email: email("liaison"),
          passwordHash: HASH,
          role: "COMMUNITY_LIAISON",
          approvalStatus: "APPROVED",
          parkId: yala.id,
          phone: "0700000003",
        },
      }),
      prisma.user.create({
        data: {
          name: "Seed Ranger Two",
          email: email("ranger-udawalawe"),
          passwordHash: HASH,
          role: "RANGER",
          approvalStatus: "APPROVED",
          parkId: udawalawe.id,
          phone: "0700000004",
        },
      }),
      prisma.user.create({
        data: {
          name: "Seed Community User",
          email: email("community"),
          passwordHash: HASH,
          role: "COMMUNITY_USER",
          approvalStatus: "APPROVED",
          phone: "0700000005",
        },
      }),
    ]);

  const patrolRows = [];
  for (let i = 0; i < PATROLS.length; i++) {
    const [startLocation, status, patrolType, priority, days] = PATROLS[i];
    const parkId = i < 6 ? yala.id : udawalawe.id;
    const rangerId = i < 6 ? ranger.id : udawalaweRanger.id;
    const scheduledDate = daysAgo(days, 6);
    const started = status !== "SCHEDULED";
    const finished = status === "COMPLETED";
    patrolRows.push(
      await prisma.patrol.create({
        data: {
          routeName: `[seed] Patrol ${i + 1} — ${startLocation}`,
          description: "Dummy patrol for dashboard analytics",
          startLocation,
          latitude: LOCATIONS[i][0],
          longitude: LOCATIONS[i][1],
          status,
          patrolType,
          priority,
          scheduledDate,
          actualStartTime: started ? daysAgo(days, 7) : null,
          actualEndTime: finished ? daysAgo(days, 7, 12) : null,
          park: { connect: { id: parkId } },
          ranger: { connect: { id: rangerId } },
          createdBy: { connect: { id: manager.id } },
          locations:
            started && i % 2 === 0
              ? {
                  create: [
                    { latitude: LOCATIONS[i][0] + 0.01, longitude: LOCATIONS[i][1] + 0.01, recordedAt: daysAgo(days, 7) },
                    { latitude: LOCATIONS[i][0] + 0.02, longitude: LOCATIONS[i][1] + 0.02, recordedAt: daysAgo(days, 7, 1) },
                  ],
                }
              : undefined,
          waypoints:
            status === "COMPLETED"
              ? {
                  create: [
                    { type: "START", order: 1, label: "[seed] Start", latitude: LOCATIONS[i][0], longitude: LOCATIONS[i][1], recordedAt: daysAgo(days, 7) },
                    { type: "CHECKPOINT", order: 2, label: "[seed] Checkpoint", latitude: LOCATIONS[i][0] + 0.01, longitude: LOCATIONS[i][1] + 0.01, recordedAt: daysAgo(days, 7, 2) },
                    { type: "END", order: 3, label: "[seed] End", latitude: LOCATIONS[i][0] + 0.02, longitude: LOCATIONS[i][1] + 0.02, recordedAt: daysAgo(days, 7, 4) },
                  ],
                }
              : undefined,
        },
      }),
    );
  }

  for (let i = 0; i < INCIDENTS.length; i++) {
    const [incidentType, status, manualLocation, days, conflict] =
      INCIDENTS[i];
    const parkId = i < 10 ? yala.id : udawalawe.id;
    const reporterId = conflict ? communityUser.id : yalaLiaison.id;
    const linkedPatrol =
      parkId === yala.id && i % 3 === 0 ? patrolRows[i % 6].id : null;
    await prisma.incident.create({
      data: {
        title: `[seed] ${incidentType.replaceAll("_", " ")} case ${i + 1}`,
        incidentType,
        description: "Dummy incident for dashboard analytics",
        manualLocation,
        latitude: LOCATIONS[i % 10][0],
        longitude: LOCATIONS[i % 10][1],
        status,
        occurredAt: daysAgo(days, 6),
        reportedAt: daysAgo(days, 7),
        reporter: { connect: { id: reporterId } },
        park: { connect: { id: parkId } },
        ...(linkedPatrol ? { patrol: { connect: { id: linkedPatrol } } } : {}),
        evidence:
          i % 4 === 0
            ? {
                create: [
                  {
                    fileUrl: "https://example.test/seed-evidence.jpg",
                    fileType: "image/jpeg",
                    caption: "[seed] evidence",
                  },
                ],
              }
            : undefined,
      },
    });
  }

  for (let i = 0; i < REPORTS.length; i++) {
    const [reportType, species, manualLocation, days, status] = REPORTS[i];
    await prisma.communityReport.create({
      data: {
        reportType,
        species,
        description: "Dummy community report for dashboard analytics",
        manualLocation,
        status,
        isAnonymous: i % 2 === 1,
        reporterName: i % 2 === 1 ? "Seed Reporter " + TAG : undefined,
        reporterPhone: i % 2 === 1 ? undefined : "0700000100",
        reporterId: i % 3 === 0 ? communityUser.id : null,
        submittedAt: daysAgo(days, (i % 11) + 1),
      },
    });
  }

  for (let i = 0; i < 4; i++) {
    const parkId = i < 2 ? yala.id : udawalawe.id;
    const [baseLat, baseLng] = LOCATIONS[(i * 3) % 10];
    await prisma.riskZone.create({
      data: {
        name: `[seed] ${i < 2 ? "Yala" : "Udawalawe"} risk zone ${i + 1}`,
        description: "Dummy risk zone",
        riskLevel: ["LOW", "MEDIUM", "HIGH", "CRITICAL"][i],
        centerLatitude: baseLat,
        centerLongitude: baseLng,
        radiusMeters: 1200 + i * 300,
        park: { connect: { id: parkId } },
      },
    });
  }

  const animals = [];
  const species = [
    ["SEED-ANIMAL-01", "Asian Elephant", "Elder Tusker"],
    ["SEED-ANIMAL-02", "Sri Lankan Leopard", "Shadow"],
    ["SEED-ANIMAL-03", "Sloth Bear", "Balu"],
  ];
  for (const [animalCode, animalSpecies, name] of species) {
    const [baseLat, baseLng] = LOCATIONS[(animals.length * 2) % 10];
    animals.push(
      await prisma.animal.create({
        data: {
          animalCode,
          species: animalSpecies,
          name,
          sex: name === "Shadow" ? "F" : "M",
          notes: "[seed] dummy tracking animal",
          collar: { create: { collarCode: `SEED-COLLAR-${animals.length + 1}` } },
          locations: {
            create: [0, 1, 2, 3].map((k) => ({
              latitude: baseLat + k * 0.01,
              longitude: baseLng + k * 0.01,
              recordedAt: daysAgo(k * 5, 9),
              heartRate: 40 + k * 3,
              temperature: 36.8 + k * 0.1,
              activityLevel: ["RESTING", "WALKING", "GRAZING"][k % 3],
            })),
          },
        },
      }),
    );
  }

  const zonesWithAnimals = await prisma.riskZone.findMany({
    where: { name: { startsWith: "[seed]" } },
    select: { id: true },
  });
  for (let i = 0; i < 3; i++) {
    await prisma.alert.create({
      data: {
        riskLevel: ["HIGH", "MEDIUM", "CRITICAL"][i],
        message: `[seed] ${animals[i].species} detected near a risk zone`,
        status: ["ACTIVE", "ACKNOWLEDGED", "RESOLVED"][i],
        generatedAt: daysAgo(2 + i * 3, 10),
        resolvedAt: i === 2 ? daysAgo(1 + i, 11) : null,
        animal: { connect: { id: animals[i].id } },
        riskZone: { connect: { id: zonesWithAnimals[i].id } },
        acknowledgements:
          i === 1
            ? { create: { userId: ranger.id, acknowledgedAt: daysAgo(1) } }
            : undefined,
      },
    });
  }

  for (let i = 0; i < 3; i++) {
    const parkId = i < 2 ? yala.id : udawalawe.id;
    const [baseLat, baseLng] = LOCATIONS[(i * 4 + 1) % 10];
    const camera = await prisma.cameraTrap.create({
      data: {
        cameraCode: `SEED-CAMERA-${i + 1}`,
        name: `[seed] Camera ${i + 1}`,
        latitude: baseLat,
        longitude: baseLng,
        park: { connect: { id: parkId } },
      },
    });
    await prisma.cameraTrapImage.createMany({
      data: [0, 1].map((k) => ({
        imageUrl: `https://example.test/seed-camera-${i + 1}-${k}.jpg`,
        capturedAt: daysAgo(k * 9, 5),
        species: ["Asian Elephant", "Leopard"][k % 2],
        reviewStatus: k === 0 ? "REVIEWED" : "PENDING",
        notes: "[seed] camera image",
        cameraTrapId: camera.id,
      })),
    });
  }

  console.log("Seeded dummy data complete. Login as the park manager to see it on the dashboard:");
  console.log({
    tag: TAG,
    email: email("manager"),
    password: PASSWORD,
    seeded: {
      users: 5,
      parks: 2,
      patrols: patrolRows.length,
      incidents: INCIDENTS.length,
      communityReports: REPORTS.length,
      riskZones: 4,
      animals: animals.length,
      alerts: 3,
      cameraTraps: 3,
      locations: animals.length * 4,
    },
  });
  console.log("Remove everything again with: node scripts/delete-dummy-data.js");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error("Seeding failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });