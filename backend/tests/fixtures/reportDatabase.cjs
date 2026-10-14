// In-memory fixture for the two report suites only. No Prisma, pg, environment, or network imports.
// Unsupported queries fail rather than silently returning successful-looking results.
const FIXED_TIME = Date.parse('2026-06-15T12:00:00Z');
function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some(condition => matches(row, condition));
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      return Object.entries(value).every(([operator, bound]) => {
        if (operator === 'gte') return row[key] != null && row[key] >= bound;
        if (operator === 'lte') return row[key] != null && row[key] <= bound;
        if (operator === 'contains') return String(row[key] || '').toLowerCase().includes(String(bound).toLowerCase());
        if (operator === 'mode') return bound === 'insensitive';
        throw new Error('Unsupported report fixture operator: ' + operator);
      });
    }
    return row[key] === value;
  });
}
function createReportDatabase() {
  let sequence = 0;
  const tables = {};
  const db = {};
  for (const name of ['park', 'user', 'incident', 'patrol', 'communityReport']) {
    tables[name] = [];
    db[name] = {
      create: jest.fn(async ({ data }) => {
        const row = { id: `${name}-${++sequence}`, createdAt: new Date(FIXED_TIME), ...data };
        if (name === 'user') row.isActive = data.isActive ?? true;
        if (name === 'patrol') row._count = { waypoints: 0, incidents: 0 };
        tables[name].push(row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }) => tables[name].find(row => matches(row, where)) || null),
      findMany: jest.fn(async ({ where = {}, select, orderBy } = {}) => {
        let rows = tables[name].filter(row => matches(row, where));
        if (orderBy) {
          const [key, direction] = Object.entries(orderBy)[0];
          rows = [...rows].sort((a, b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * (direction === 'desc' ? -1 : 1));
        }
        return rows.map(row => {
          if (!select) return { ...row };
          return Object.fromEntries(Object.keys(select).map(key => {
            if (key === 'reporter' || key === 'ranger') return [key, tables.user.find(user => user.id === row[key === 'reporter' ? 'reporterId' : 'rangerId']) || null];
            if (key === 'patrol') return [key, tables.patrol.find(patrol => patrol.id === row.patrolId) || null];
            if (key === 'createdBy') return [key, tables.user.find(user => user.id === row.createdById) || null];
            return [key, row[key]];
          }));
        });
      }),
      delete: jest.fn(async ({ where }) => {
        const index = tables[name].findIndex(row => matches(row, where));
        if (index < 0) throw new Error('Missing report fixture');
        return tables[name].splice(index, 1)[0];
      }),
      deleteMany: jest.fn(async ({ where }) => {
        const before = tables[name].length;
        tables[name] = tables[name].filter(row => !matches(row, where));
        return { count: before - tables[name].length };
      }),
    };
  }
  db.resetReportRows = () => {
    for (const name of ['incident', 'patrol', 'communityReport']) tables[name] = [];
  };
  return db;
}
module.exports = { createReportDatabase, FIXED_TIME };
