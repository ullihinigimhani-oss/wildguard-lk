jest.mock('../../../src/repositories/incident.repository', () => ({
  findIncident: jest.fn(), findPatrol: jest.fn(), listIncidents: jest.fn(),
  rangerScope: jest.fn(id => ({ reporterId: id })), withActivePatrol: jest.fn(),
  lockIncident: jest.fn(), update: jest.fn(), create: jest.fn(), setStatus: jest.fn(),
}));
const repository = require('../../../src/repositories/incident.repository');
const service = require('../../../src/services/incident.service');
const user = Object.freeze({ id: 'r', role: 'RANGER' });
const row = () => ({ id: 'i', patrolId: 'p', reporterId: 'r', status: 'PENDING', withdrawnAt: null,
  description: 'Stored incident', evidence: [] });
const tx = Object.freeze({ fixture: 'transaction' });
beforeEach(() => {
  jest.resetAllMocks();
  repository.findIncident.mockResolvedValue(row());
  repository.lockIncident.mockResolvedValue(row());
  repository.rangerScope.mockImplementation(id => ({ reporterId: id }));
  repository.withActivePatrol.mockImplementation(async (_id, _owner, action) => action(tx, { id: 'p', parkId: 'park' }));
});
test('[B1-INC-01] summaries cap descriptions and preserve persisted records and pagination', async () => {
  const persisted = Object.freeze({ ...row(), description: 'd'.repeat(501), _count: { evidence: 3 } });
  repository.listIncidents.mockResolvedValue({ incidents: [persisted], page: 2, total: 26, pageSize: 25 });
  const filters = { where: { parkId: 'park' }, page: 2 };
  const result = await service.list(filters);
  expect(result).toMatchObject({ page: 2, total: 26, pageSize: 25 });
  expect(result.incidents[0].description).toHaveLength(500);
  expect(result.incidents[0].evidenceCount).toBe(3);
  expect(result.incidents[0]).not.toHaveProperty('_count');
  expect(persisted.description).toHaveLength(501);
  expect(repository.listIncidents).toHaveBeenCalledWith(filters.where, 2);
});
test('[B1-INC-02] denied scoped read is unavailable without a mutation or widened lookup', async () => {
  repository.findIncident.mockResolvedValue(null);
  await expect(service.getIncident('i', user)).rejects.toMatchObject({ status: 404, code: 'INCIDENT_UNAVAILABLE' });
  expect(repository.findIncident).toHaveBeenCalledTimes(1);
  expect(repository.findIncident).toHaveBeenCalledWith('i', user);
  expect(repository.withActivePatrol).not.toHaveBeenCalled();
});
test('[B1-INC-03] a lock failure never attempts an incident update', async () => {
  const failure = new Error('Mock lock unavailable'); repository.lockIncident.mockRejectedValue(failure);
  await expect(service.edit('i', { title: 'Changed title' }, user)).rejects.toBe(failure);
  expect(repository.lockIncident).toHaveBeenCalledWith(tx, 'i', 'p', 'r');
  expect(repository.update).not.toHaveBeenCalled();
});
test('[B1-INC-04] an update failure propagates through the active patrol transaction', async () => {
  const failure = new Error('Mock update failed'); repository.update.mockRejectedValue(failure);
  await expect(service.edit('i', { title: 'Changed title' }, user)).rejects.toBe(failure);
  expect(repository.withActivePatrol).toHaveBeenCalledWith('p', 'r', expect.any(Function));
  expect(repository.update).toHaveBeenCalledWith(tx, 'i', 'p', 'r', { title: 'Changed title' });
});
test('[B1-INC-05] creation failure preserves server-derived identity and never returns invented success', async () => {
  const failure = new Error('Mock create failed'); repository.create.mockRejectedValue(failure);
  const body = Object.freeze({ title: 'Observed snare', evidence: Object.freeze([]), description: 'Wire snare near gate',
    incidentType: 'POACHING_SNARE', occurredAt: new Date('2026-01-01T00:00:00Z'), latitude: 7.5, longitude: 80.7 });
  const before = JSON.stringify(body);
  await expect(service.create('p', body, user)).rejects.toBe(failure);
  expect(repository.create).toHaveBeenCalledWith(tx, { title: body.title, description: body.description,
    incidentType: body.incidentType, occurredAt: body.occurredAt, latitude: 7.5, longitude: 80.7,
    reporterId: 'r', patrolId: 'p', parkId: 'park', status: 'PENDING', syncStatus: 'SYNCED' });
  expect(JSON.stringify(body)).toBe(before);
});
test('[B1-INC-06] Ranger patrol listing overrides proposed ownership with the scoped identity', async () => {
  repository.findPatrol.mockResolvedValue({ id: 'p' });
  repository.listIncidents.mockResolvedValue({ incidents: [], total: 0, page: 1 });
  await service.listForPatrol('p', { page: 1, where: { reporterId: 'other', withdrawnAt: null } }, user);
  expect(repository.findPatrol).toHaveBeenCalledWith('p', user);
  expect(repository.listIncidents).toHaveBeenCalledWith({ reporterId: 'r', patrolId: 'p', withdrawnAt: null }, 1);
});
test('[B1-INC-07] manager listing keeps explicit filters rather than applying Ranger-only ownership', async () => {
  const manager = { id: 'manager', role: 'PARK_MANAGER' };
  repository.findPatrol.mockResolvedValue({ id: 'p' });
  repository.listIncidents.mockResolvedValue({ incidents: [], total: 0, page: 1 });
  await service.listForPatrol('p', { page: 1, where: { reporterId: 'r' } }, manager);
  expect(repository.rangerScope).not.toHaveBeenCalled();
  expect(repository.findPatrol).toHaveBeenCalledWith('p', manager);
  expect(repository.listIncidents).toHaveBeenCalledWith({ reporterId: 'r', patrolId: 'p' }, 1);
});
test('[B1-INC-08] review persistence failure does not mutate the previously read record', async () => {
  const existing = Object.freeze(row()); repository.findIncident.mockResolvedValue(existing);
  const failure = new Error('Mock review failed'); repository.setStatus.mockRejectedValue(failure);
  await expect(service.updateStatus('i', 'VERIFIED', { id: 'manager', role: 'PARK_MANAGER' })).rejects.toBe(failure);
  expect(repository.setStatus).toHaveBeenCalledWith('i', 'VERIFIED');
  expect(existing.status).toBe('PENDING');
});
