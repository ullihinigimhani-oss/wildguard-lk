// Opt-in live verification. All verification users/patrols exist only inside one
// transaction, which ALWAYS rolls back. No existing data is modified or deleted.
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const dbPath = require.resolve('../src/config/database');
const database = require(dbPath);
const { localDateKey, classifyPatrol, dashboardPatrols } = require('../../shared/patrolLifecycle');
const ROLLBACK = new Error('Intentional verification rollback');
const accountIds = [];
const patrolIds = [];
const checks = [];
function dateOffset(date, days) { return new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10); }
async function verify() {
  try {
    await database.$transaction(async tx => {
      require.cache[dbPath].exports = tx;
      const park = await tx.park.findFirst({ select: { id: true } });
      assert(park, 'An existing park is required for verification.');
      const password = randomBytes(24).toString('hex');
      const passwordHash = await bcrypt.hash(password, 12);
      const accounts = [];
      for (const role of ['PARK_MANAGER', 'RANGER', 'RANGER']) {
        const account = await tx.user.create({ data: { name: 'Transaction verification account', email: randomUUID() + '@example.test', passwordHash, role, approvalStatus: 'APPROVED', isActive: true, parkId: park.id }, select: { id: true, email: true } });
        accountIds.push(account.id); accounts.push(account);
      }
      const app = require('../src/app');
      const login = async account => {
        const response = await request(app).post('/api/auth/login').send({ email: account.email, password }).expect(200);
        return 'Bearer ' + response.body.token;
      };
      // One transaction connection: keep its queries sequential for pg compatibility.
      const manager = await login(accounts[0]);
      const rangerA = await login(accounts[1]);
      const rangerB = await login(accounts[2]);
      const me = await request(app).get('/api/auth/me').set('Authorization', rangerA).expect(200);
      assert.equal(me.body.user.id, accounts[1].id);
      assert.equal(me.body.user.park.id, park.id);
      checks.push('Approved login and confirmed park');
      const today = localDateKey();
      const create = async day => {
        const response = await request(app).post('/api/patrols').set('Authorization', manager).send({ patrol_title: 'Transaction-only lifecycle verification', park_ranger_area: park.id, assigned_ranger: accounts[1].id, patrol_date: day, start_time: '00:00', expected_end_time: '23:59', instructions_notes: 'Never committed; verification transaction rolls back.' }).expect(201);
        patrolIds.push(response.body.patrol.id);
        return response.body.patrol;
      };
      const future = await create(dateOffset(today, 2));
      const overdue = await create(dateOffset(today, -1));
      const current = await create(today);
      const mine = await request(app).get('/api/patrols/mine').set('Authorization', rangerA).expect(200);
      assert.equal(mine.body.patrols.length, 3);
      assert(mine.body.patrols.some(p => p.id === future.id));
      assert.equal(classifyPatrol(future).upcoming, true);
      assert.equal(classifyPatrol(overdue).overdue, true);
      const other = await request(app).get('/api/patrols/mine?rangerId=' + accounts[1].id).set('Authorization', rangerB).expect(200);
      assert.equal(other.body.patrols.length, 0);
      for (const patrol of [future, overdue, current]) {
        await request(app).get('/api/patrols/mine/' + patrol.id).set('Authorization', rangerB).expect(404);
        await request(app).post('/api/patrols/mine/' + patrol.id + '/start').set('Authorization', rangerB).send({ rangerId: accounts[1].id }).expect(404);
        await request(app).post('/api/patrols/mine/' + patrol.id + '/complete').set('Authorization', rangerB).send({ rangerId: accounts[1].id }).expect(404);
      }
      checks.push('Manager creation, real assignment reads, future/today/overdue and Ranger isolation');
      await request(app).post('/api/patrols/mine/' + future.id + '/start').set('Authorization', rangerA).expect(409);
      await request(app).post('/api/patrols/mine/' + overdue.id + '/complete').set('Authorization', rangerA).expect(409);
      for (const patrol of [overdue, current]) {
        const path = '/api/patrols/mine/' + patrol.id;
        const before = Date.now();
        const started = await request(app).post(path + '/start').set('Authorization', rangerA).send({ actualStartTime: '2000-01-01' }).expect(200);
        assert.equal(started.body.patrol.status, 'IN_PROGRESS');
        assert(new Date(started.body.patrol.actualStartTime).getTime() >= before);
        const retry = await request(app).post(path + '/start').set('Authorization', rangerA).expect(200);
        assert.equal(retry.body.patrol.actualStartTime, started.body.patrol.actualStartTime);
        const completed = await request(app).post(path + '/complete').set('Authorization', rangerA).send({ actualEndTime: '2000-01-01' }).expect(200);
        assert.equal(completed.body.patrol.status, 'COMPLETED');
        assert.equal(completed.body.patrol.actualStartTime, started.body.patrol.actualStartTime);
        for (const field of ['scheduledDate', 'startTime', 'endTime']) assert.equal(completed.body.patrol[field], patrol[field]);
        assert.equal(classifyPatrol(completed.body.patrol).overdue, false);
        if (patrol.id === overdue.id) assert.equal(classifyPatrol(completed.body.patrol).completedLate, true);
        else if (Date.now() <= Date.parse(current.endTime)) assert.equal(classifyPatrol(completed.body.patrol).completionText, 'Completed on time');
        const duplicate = await request(app).post(path + '/complete').set('Authorization', rangerA).expect(200);
        assert.equal(duplicate.body.patrol.actualEndTime, completed.body.patrol.actualEndTime);
      }
      checks.push('Real start/completion timestamps, idempotent retries, original schedule and historical lateness');
      const final = await request(app).get('/api/patrols/mine').set('Authorization', rangerA).expect(200);
      assert.equal(final.body.patrols.filter(p => classifyPatrol(p).completed).length, 2);
      assert.equal(final.body.patrols.filter(p => classifyPatrol(p).overdue).length, 0);
      assert.equal(dashboardPatrols(final.body.patrols).heading, 'NEXT PATROL');
      throw ROLLBACK;
    }, { maxWait: 15000, timeout: 120000 });
  } catch (error) {
    if (error !== ROLLBACK) throw error;
  } finally {
    require.cache[dbPath].exports = database;
  }
  assert.equal(await database.user.count({ where: { id: { in: accountIds } } }), 0);
  assert.equal(await database.patrol.count({ where: { id: { in: patrolIds } } }), 0);
  checks.push('Rollback verified: no verification accounts or patrols persisted');
  console.log(JSON.stringify({ success: true, checks }, null, 2));
}
verify().catch(error => {
  console.error(JSON.stringify({ success: false, reason: error.name === 'AssertionError' ? 'Live workflow assertion failed.' : 'Live verification could not complete; the transaction was rolled back.' }));
  process.exitCode = 1;
}).finally(() => database.$disconnect());
