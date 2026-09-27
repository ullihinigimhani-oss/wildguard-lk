// Lazy connection keeps health checks and isolated tests independent of auth setup.
const db = () => require('../config/database');
const safeSelect = { id: true, name: true, email: true, phone: true, role: true };
exports.findByEmail = email => db().user.findUnique({ where: { email }, select: { id: true } });
exports.create = data => db().user.create({ data, select: safeSelect });
