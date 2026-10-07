// Lazy connection keeps isolated tests independent of database setup.
const db = () => require("../config/database");
const routeSelect = {
  where: { type: { not: null }, order: { not: null } },
  orderBy: { order: "asc" },
  select: {
    type: true,
    order: true,
    latitude: true,
    longitude: true,
    label: true,
    note: true,
  },
};
const withRoute = (patrol) => {
  if (!patrol) return patrol;
  const { waypoints, ...details } = patrol;
  return { ...details, plannedRoute: waypoints || [] };
};
const patrolSelect = {
  waypoints: routeSelect,
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
    select: { id: true, role: true, approvalStatus: true, isActive: true, parkId: true },
  });
exports.createPatrol = (data) =>
  db().patrol.create({ data, select: patrolSelect }).then(withRoute);
exports.findPatrols = (where, page) =>
  Promise.all([
    db().patrol.findMany({
      where,
      select: patrolSelect,
      take: 25,
      skip: (page - 1) * 25,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    }),
    db().patrol.count({ where }),
  ]).then(([patrols, total]) => [patrols.map(withRoute), total]);
exports.findPatrolById = (id) =>
  db()
    .patrol.findUnique({
      where: { id },
      select: patrolSelect,
    })
    .then(withRoute);
const rangerPatrolSelect = {
  id: true,
  routeName: true,
  description: true,
  scheduledDate: true,
  startTime: true,
  endTime: true,
  actualStartTime: true,
  actualEndTime: true,
  updatedAt: true,
  status: true,
  patrolType: true,
  priority: true,
  startLocation: true,
  park: { select: { id: true, name: true } },
  ranger: { select: { name: true } },
};
exports.findRangerPatrols = (rangerId) =>
  db().patrol.findMany({
    where: { rangerId },
    select: rangerPatrolSelect,
    orderBy: [{ scheduledDate: "desc" }, { startTime: "asc" }, { id: "asc" }],
  });
exports.findRangerPatrol = (id, rangerId) =>
  db()
    .patrol.findFirst({
      where: { id, rangerId },
      select: {
        ...rangerPatrolSelect,
        waypoints: {
          ...routeSelect,
          select: { ...routeSelect.select, id: true },
        },
      },
    })
    .then(withRoute);
exports.transitionRangerPatrol = (id, rangerId, status, data, updatedAt) =>
  db().patrol.updateMany({
    // Atomic compare-and-set prevents parallel/retried requests rewriting actual times.
    where: { id, rangerId, status, ...(updatedAt ? { updatedAt } : {}) },
    data,
  });

// The guarded update locks the patrol row until route edits commit. Start uses
// the same row, so it can never see a partially updated assignment or route.
exports.updateScheduledPatrol = (id, input) => db().$transaction(async tx => {
  const { waypoints, ...details } = input;
  const result = await tx.patrol.updateMany({ where: { id, status: "SCHEDULED" }, data: details });
  if (!result.count) throw Object.assign(new Error("This patrol changed. Only scheduled patrols can be edited or cancelled. Refresh and try again."), { status: 409, patrolError: true });
  if (waypoints) {
    const existing = await tx.patrolWaypoint.findMany({ where: { patrolId: id, type: { not: null }, order: { not: null } } });
    const points = waypoints.create;
    // Reuse rows by order; remove only planned points explicitly removed from
    // this route. Historical unclassified rows, GPS and incidents are untouched.
    const removed = existing.filter(point => !points.some(next => next.order === point.order)).map(point => point.id);
    if (removed.length) await tx.patrolWaypoint.deleteMany({ where: { patrolId: id, id: { in: removed } } });
    for (const point of points) {
      const previous = existing.find(row => row.order === point.order);
      if (previous) await tx.patrolWaypoint.update({ where: { id: previous.id }, data: point });
      else await tx.patrolWaypoint.create({ data: { ...point, patrolId: id } });
    }
  }
  return withRoute(await tx.patrol.findUnique({ where: { id }, select: patrolSelect }));
});
