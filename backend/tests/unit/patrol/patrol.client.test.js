const { Prisma } = require("@prisma/client");
test("generated client supports the current patrol creation fields", () => {
  const fields = Prisma.dmmf.datamodel.models.find(model => model.name === "Patrol").fields.map(field => field.name);
  expect(fields).toEqual(expect.arrayContaining([
    "patrolType", "priority", "startLocation", "latitude", "longitude",
    "parkId", "rangerId", "createdById", "scheduledDate", "startTime", "endTime", "actualStartTime", "actualEndTime",
  ]));
});
test("generated client supports additive planned waypoint fields", () => {
  const model = Prisma.dmmf.datamodel.models.find(model => model.name === "PatrolWaypoint");
  expect(model.fields.map(field => field.name)).toEqual(expect.arrayContaining(["type", "order", "label", "note", "latitude", "longitude", "patrolId"]));
});
