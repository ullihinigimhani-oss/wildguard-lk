import { api } from '../../src/services/api';
import * as users from '../../src/services/userApi';
import * as parks from '../../src/services/parkApi';
import * as patrol from '../../src/services/patrolApi';
import * as incidents from '../../src/services/incidentApi';
import * as community from '../../src/services/communityReportApi';
vi.mock('../../src/services/api', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), defaults: { baseURL: 'https://fixture.example/api' } } }));
beforeEach(() => vi.resetAllMocks());
test('[B3-API-01] pending user selection removes only pending flag and preserves filters', async () => {
  api.get.mockResolvedValue({ data: { users: [] } }); expect(await users.listUsers({ pending: true, role: 'RANGER', page: 2 })).toEqual({ users: [] }); expect(api.get).toHaveBeenCalledWith('/users/pending', { params: { role: 'RANGER', page: 2 } });
});
test('[B3-API-02] ordinary user list defaults to empty params', async () => {
  api.get.mockResolvedValue({ data: { users: [] } }); await users.listUsers(); expect(api.get).toHaveBeenCalledWith('/users', { params: {} });
});
test('[B3-API-03] user approval encodes ID and includes assigned park only when supplied', async () => {
  api.patch.mockResolvedValue({ data: { success: true } }); await users.reviewUser('u/a', 'APPROVED', 'reviewed', 'park'); await users.reviewUser('u/a', 'REJECTED', 'reason');
  expect(api.patch).toHaveBeenNthCalledWith(1, '/users/u%2Fa/approval', { status: 'APPROVED', reason: 'reviewed', parkId: 'park' }); expect(api.patch).toHaveBeenNthCalledWith(2, '/users/u%2Fa/approval', { status: 'REJECTED', reason: 'reason' });
});
test('[B3-API-04] user review HTTP rejection propagates unchanged', async () => {
  const error = { response: { status: 403 } }; api.patch.mockRejectedValue(error); await expect(users.reviewUser('u', 'APPROVED')).rejects.toBe(error);
});
test('[B3-API-05] park listing unwraps empty successful list', async () => {
  api.get.mockResolvedValue({ data: { success: true, parks: [] } }); expect(await parks.listParks()).toEqual([]); expect(api.get).toHaveBeenCalledWith('/parks');
});
test.each([['06', { success: false, parks: [] }], ['07', { success: true, parks: {} }]])('[B3-API-%s] malformed park envelope %j fails explicitly', async (_id, data) => {
  api.get.mockResolvedValue({ data }); await expect(parks.listParks()).rejects.toThrow('Park list unavailable');
});
test('[B3-API-08] patrol creation preserves payload and response envelope', async () => {
  const payload = Object.freeze({ routeName: 'Gate', plannedRoute: [] }), data = { success: true, patrol: { id: 'p' } }; api.post.mockResolvedValue({ data });
  expect(await patrol.createPatrol(payload)).toBe(data); expect(api.post).toHaveBeenCalledWith('/patrols', payload);
});
test('[B3-API-09] patrol list preserves pagination, filtering and empty result metadata', async () => {
  const data = { success: true, patrols: [], total: 0, pageSize: 25 }; api.get.mockResolvedValue({ data }); expect(await patrol.listPatrols({ page: 2, status: 'COMPLETED' })).toBe(data); expect(api.get).toHaveBeenCalledWith('/patrols', { params: { page: 2, status: 'COMPLETED' } });
});
test('[B3-API-10] patrol detail encodes identity and unwraps patrol', async () => {
  api.get.mockResolvedValue({ data: { success: true, patrol: { id: 'p/a' } } }); expect(await patrol.getPatrol('p/a')).toEqual({ id: 'p/a' }); expect(api.get).toHaveBeenCalledWith('/patrols/p%2Fa');
});
test('[B3-API-11] update and cancellation use distinct encoded mutation endpoints', async () => {
  api.patch.mockResolvedValue({ data: { success: true } }); api.post.mockResolvedValue({ data: { success: true } }); await patrol.updatePatrol('p/a', { priority: 'HIGH' }); await patrol.cancelPatrol('p/a');
  expect(api.patch).toHaveBeenCalledWith('/patrols/p%2Fa', { priority: 'HIGH' }); expect(api.post).toHaveBeenCalledWith('/patrols/p%2Fa/cancel');
});
test.each([['12', 'listAssignableRangers', { success: true, rangers: null }, 'Ranger list unavailable'], ['13', 'listPatrols', { success: true, patrols: {} }, 'Patrol list unavailable'], ['14', 'getPatrol', { success: true }, 'Patrol unavailable'], ['15', 'listLiveRangers', { success: false, rangers: [] }, 'Live ranger locations unavailable'], ['16', 'getPatrolTrail', { success: true, locations: {} }, 'Recorded route unavailable']])(
  '[B3-API-%s] %s rejects malformed response', async (_id, method, data, error) => { api.get.mockResolvedValue({ data }); await expect(patrol[method]('p')).rejects.toThrow(error); });
test('[B3-API-17] recorded trail unwraps ordered history and encoded ID', async () => {
  const locations = [{ recordedAt: '2026-01-01Z' }]; api.get.mockResolvedValue({ data: { success: true, locations } }); expect(await patrol.getPatrolTrail('p/a')).toBe(locations); expect(api.get).toHaveBeenCalledWith('/patrols/p%2Fa/locations');
});
test('[B3-API-18] patrol conflict propagates without retrying mutation', async () => {
  const error = { response: { status: 409 } }; api.patch.mockRejectedValue(error); await expect(patrol.updatePatrol('p', {})).rejects.toBe(error); expect(api.patch).toHaveBeenCalledOnce();
});
test('[B3-API-19] aborted complete incident collection stops before second page', async () => {
  const controller = new AbortController(); api.get.mockImplementation(async () => { controller.abort(); return { data: { success: true, incidents: [{ id: 'i' }], total: 2, pageSize: 1 } }; });
  await expect(incidents.listAllIncidents({}, controller.signal)).rejects.toThrow('Request cancelled'); expect(api.get).toHaveBeenCalledOnce();
});
test('[B3-API-20] incident collection rejects unreasonable page count before further requests', async () => {
  api.get.mockResolvedValue({ data: { success: true, incidents: [{ id: 'i' }], total: 100001, pageSize: 1 } }); await expect(incidents.listAllIncidents({})).rejects.toThrow('Incident list unavailable'); expect(api.get).toHaveBeenCalledOnce();
});
test('[B3-API-21] incident collection refuses record without identity', async () => {
  api.get.mockResolvedValue({ data: { success: true, incidents: [{}], total: 1, pageSize: 25 } }); await expect(incidents.listAllIncidents({})).rejects.toThrow('Incident list unavailable');
});
test('[B3-API-22] incident mutation keeps encoded ID and cancellation signal', async () => {
  const signal = new AbortController().signal; api.patch.mockResolvedValue({ data: { success: true } }); await incidents.updateIncident('i/a', { markAsDone: true }, signal); expect(api.patch).toHaveBeenCalledWith('/incidents/i%2Fa/status', { markAsDone: true }, { signal });
});
test('[B3-API-23] failed mark-done acknowledgement is rejected', async () => {
  api.patch.mockResolvedValue({ data: { success: false } }); await expect(incidents.markIncidentAsDone('i')).rejects.toThrow('Failed to mark incident as done');
});
test('[B3-API-24] zero verified-incident count is accepted while string count is rejected', async () => {
  api.get.mockResolvedValueOnce({ data: { success: true, data: { count: 0 } } }).mockResolvedValueOnce({ data: { success: true, data: { count: '0' } } }); expect(await incidents.getVerifiedIncidentsCount()).toBe(0); await expect(incidents.getVerifiedIncidentsCount()).rejects.toThrow('count unavailable');
});
test('[B3-API-25] community mark-done binds encoded ID and signal', async () => {
  const signal = new AbortController().signal; api.patch.mockResolvedValue({ data: { success: true } }); await community.markCommunityReportAsDone('c/a', signal); expect(api.patch).toHaveBeenCalledWith('/community-reports/c%2Fa/mark-done', {}, { signal });
});
test('[B3-API-26] community mark-done failure propagates safe adapter error', async () => {
  api.patch.mockResolvedValue({ data: { success: false } }); await expect(community.markCommunityReportAsDone('c')).rejects.toThrow('Failed to mark community report as done');
});
test('[B3-API-27] community cancelled HTTP request propagates original cancellation', async () => {
  const error = Object.assign(new Error('cancelled'), { name: 'CanceledError' }), signal = new AbortController().signal; api.get.mockRejectedValue(error); await expect(community.getCommunityReport('c', signal)).rejects.toBe(error); expect(api.get).toHaveBeenCalledWith('/community-reports/c', { signal });
});
