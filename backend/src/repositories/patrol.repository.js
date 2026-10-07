// Lazy connection keeps isolated tests independent of database setup.
const db = () => require("../config/database");
const patrolSelect = {
  id: true,
  routeName: true,
  description: true,
  scheduledDate: true,
  startTime: true,
  endTime: true,
  status: true,
  patrolType: true,
  priority: true,
  startLocation: true,
  latitude: true,
  longitude: true,
  park: { select: { id: true, name: true } },
  ranger: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
};
exports.findAssignableRangers = () =>
  db().user.findMany({
    where: { role: "RANGER", approvalStatus: "APPROVED", isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      parkId: true,
      park: { select: { id: true, name: true } },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 200,
  });
exports.findPark = (id) =>
  db().park.findUnique({ where: { id }, select: { id: true, name: true } });
exports.findRanger = (id) =>
  db().user.findUnique({
    where: { id },
    select: { id: true, role: true, approvalStatus: true, isActive: true },
  });
exports.createPatrol = (data) =>
  db().patrol.create({ data, select: patrolSelect });
