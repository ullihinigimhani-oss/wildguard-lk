// Lazy connection keeps health checks and isolated tests independent of auth setup.
const db = () => require("../config/database");
const safeSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  approvalStatus: true,
  profileImageUrl: true,
  parkId: true,
  park: { select: { id: true, name: true } },
  requestedParkId: true,
  requestedPark: { select: { id: true, name: true } },
};
exports.findByEmail = (email) =>
  db().user.findUnique({ where: { email }, select: { id: true } });
exports.create = (data) => db().user.create({ data, select: safeSelect });
exports.findForLogin = (email) =>
  db().user.findUnique({
    where: { email },
    select: { ...safeSelect, passwordHash: true, isActive: true },
  });
exports.findSessionUser = (id) =>
  db().user.findUnique({
    where: { id },
    select: { ...safeSelect, isActive: true },
  });

exports.findPark = (id) =>
  db().park.findUnique({ where: { id }, select: { id: true, name: true } });
