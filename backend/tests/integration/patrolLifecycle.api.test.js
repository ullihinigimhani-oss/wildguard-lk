const request = require("supertest");
const jwt = require("jsonwebtoken");
jest.mock("../../src/config/database", () => ({
  user: { findUnique: jest.fn() },
  patrol: { findFirst: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
}));
const db = require("../../src/config/database");
const app = require("../../src/app");
let records;
let users;
const authorization = id => 'Bearer ' + jwt.sign({}, process.env.JWT_SECRET, { subject: id, issuer: 'wildguard-lk', audience: 'wildguard-web', expiresIn: '1h' });
const at = time => new Date('2026-10-07T' + time + '+05:30');
const read = (id, ranger = 'a') => request(app).get('/api/patrols/mine/' + id).set('Authorization', authorization(ranger));
const change = (id, action, ranger = 'a', body = {}) => request(app).post(`/api/patrols/mine/${id}/${action}`).set('Authorization', authorization(ranger)).send(body);
beforeEach(() => {
  process.env.JWT_SECRET = 'isolated-patrol-lifecycle-secret-at-least-32-chars';
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(at('09:00:00'));
  users = Object.fromEntries(['a', 'b', 'manager'].map(id => [id, { id, role: id === 'manager' ? 'PARK_MANAGER' : 'RANGER', approvalStatus: 'APPROVED', isActive: true }]));
  records = { assignment: { id: 'assignment', rangerId: 'a', routeName: 'Boundary sweep', status: 'SCHEDULED', scheduledDate: new Date('2026-10-07T00:00:00Z'), startTime: at('08:00:00'), endTime: at('10:00:00'), actualStartTime: null, actualEndTime: null } };
  db.user.findUnique.mockImplementation(async ({ where }) => users[where.id] || null);
  db.patrol.findFirst.mockImplementation(async ({ where }) => records[where.id]?.rangerId === where.rangerId ? { ...records[where.id] } : null);
  db.patrol.findMany.mockImplementation(async ({ where }) => Object.values(records).filter(p => p.rangerId === where.rangerId));
  db.patrol.updateMany.mockImplementation(async ({ where, data }) => {
    const patrol = records[where.id];
    if (!patrol || patrol.rangerId !== where.rangerId || patrol.status !== where.status) return { count: 0 };
    Object.assign(patrol, data);
    return { count: 1 };
  });
});
afterEach(() => jest.useRealTimers());
test('I: Ranger B cannot view/start/continue/complete A assignment by manipulating path or rangerId', async () => {
  await read('assignment', 'a').expect(200);
  await read('assignment', 'b').expect(404);
  await change('assignment', 'start', 'b', { rangerId: 'a' }).expect(404);
  await change('assignment', 'complete', 'b', { rangerId: 'a' }).expect(404);
  expect(db.patrol.updateMany).not.toHaveBeenCalled();
  expect(db.patrol.findFirst.mock.calls.every(([query]) => query.where.rangerId)).toBe(true);
});
test('start and late completion use real server time, preserve schedule and are idempotent', async () => {
  const schedule = { scheduledDate: records.assignment.scheduledDate, startTime: records.assignment.startTime, endTime: records.assignment.endTime };
  jest.setSystemTime(at('10:30:00'));
  const started = await change('assignment', 'start', 'a', { actualStartTime: '2000-01-01', status: 'COMPLETED' }).expect(200);
  expect(started.body.patrol.status).toBe('IN_PROGRESS');
  expect(started.body.patrol.actualStartTime).toBe(at('10:30:00').toISOString());
  jest.setSystemTime(at('11:35:00'));
  await change('assignment', 'start').expect(200);
  const completed = await change('assignment', 'complete', 'a', { actualEndTime: '2000-01-01', endTime: '2000-01-01' }).expect(200);
  expect(completed.body.patrol.status).toBe('COMPLETED');
  expect(completed.body.patrol.actualStartTime).toBe(at('10:30:00').toISOString());
  expect(completed.body.patrol.actualEndTime).toBe(at('11:35:00').toISOString());
  expect(records.assignment).toMatchObject(schedule);
  jest.setSystemTime(at('12:00:00'));
  const retry = await change('assignment', 'complete').expect(200);
  expect(retry.body.patrol.actualEndTime).toBe(completed.body.patrol.actualEndTime);
  expect(db.patrol.updateMany).toHaveBeenCalledTimes(2);
  expect(db.patrol.updateMany.mock.calls[0][0].where).toEqual({ id: 'assignment', rangerId: 'a', status: 'SCHEDULED' });
  expect(db.patrol.updateMany.mock.calls[1][0].where).toEqual({ id: 'assignment', rangerId: 'a', status: 'IN_PROGRESS' });
  expect(Object.keys(db.patrol.updateMany.mock.calls[0][0].data).sort()).toEqual(['actualStartTime', 'status']);
  expect(Object.keys(db.patrol.updateMany.mock.calls[1][0].data).sort()).toEqual(['actualEndTime', 'status']);
});
test('future patrol cannot be started and completion cannot skip start', async () => {
  records.assignment.scheduledDate = new Date('2026-10-10T00:00:00Z');
  await read('assignment').expect(200);
  await change('assignment', 'start').expect(409);
  await change('assignment', 'complete').expect(409);
  expect(db.patrol.updateMany).not.toHaveBeenCalled();
});
test.each(['PENDING', 'REJECTED', 'inactive', 'manager', 'expired', 'signed-out'])('%s cannot read or mutate ranger patrols', async restriction => {
  let header = authorization('a');
  if (restriction === 'inactive') users.a.isActive = false;
  else if (restriction === 'manager') header = authorization('manager');
  else if (restriction === 'signed-out') header = '';
  else if (restriction === 'expired') header = 'Bearer ' + jwt.sign({}, process.env.JWT_SECRET, { subject: 'a', issuer: 'wildguard-lk', audience: 'wildguard-web', expiresIn: -1 });
  else users.a.approvalStatus = restriction;
  for (const action of ['read', 'start', 'complete']) {
    const req = action === 'read' ? request(app).get('/api/patrols/mine/assignment') : request(app).post('/api/patrols/mine/assignment/' + action);
    const res = await req.set('Authorization', header);
    expect([401, 403]).toContain(res.status);
  }
  expect(db.patrol.findFirst).not.toHaveBeenCalled();
  expect(db.patrol.updateMany).not.toHaveBeenCalled();
});
test('parallel starts and completions record each actual timestamp once', async () => {
  const starts = await Promise.all([change('assignment', 'start'), change('assignment', 'start')]);
  expect(starts.every(res => res.status === 200)).toBe(true);
  expect(starts[0].body.patrol.actualStartTime).toBe(starts[1].body.patrol.actualStartTime);
  jest.setSystemTime(at('11:35:00'));
  const ends = await Promise.all([change('assignment', 'complete'), change('assignment', 'complete')]);
  expect(ends.every(res => res.status === 200)).toBe(true);
  expect(ends[0].body.patrol.actualEndTime).toBe(ends[1].body.patrol.actualEndTime);
});
test('cancelled and completed assignments cannot be restarted', async () => {
  records.assignment.status = 'CANCELLED';
  await change('assignment', 'start').expect(409);
  await change('assignment', 'complete').expect(409);
  records.assignment.status = 'COMPLETED';
  await change('assignment', 'start').expect(409);
  expect(db.patrol.updateMany).not.toHaveBeenCalled();
});
test('all assigned records remain visible without allowing workflow changes to cancelled patrols', async () => {
  records.assignment.status = 'CANCELLED';
  const res = await request(app).get('/api/patrols/mine').set('Authorization', authorization('a')).expect(200);
  expect(res.body.patrols[0].status).toBe('CANCELLED');
  expect(db.patrol.findMany.mock.calls[0][0].where).toEqual({ rangerId: 'a' });
});
test('database failures are sanitized', async () => {
  db.patrol.findFirst.mockRejectedValueOnce(new Error('private database details'));
  const res = await read('assignment').expect(500);
  expect(res.body.message).toBe('Internal server error');
});
