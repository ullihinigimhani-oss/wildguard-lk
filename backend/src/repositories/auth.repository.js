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
