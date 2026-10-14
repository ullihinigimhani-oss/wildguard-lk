import { api } from '../../src/services/api';
import * as alerts from '../../src/services/alertApi';
jest.mock('../../src/services/api', () => ({ api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
beforeEach(() => jest.resetAllMocks());
test.each([
 ['01','listAlerts','get','/alerts',[{ page: 2, status: 'ACTIVE' }]],
 ['02','getAlertById','get','/alerts/a',['a']],
 ['03','getUnreadAlertsCount','get','/alerts/unread-count',[]],
 ['04','markAlertAsRead','post','/alerts/a/read',['a']],
 ['05','markAllAlertsAsRead','post','/alerts/read-all',[]],
 ['06','acknowledgeAlert','post','/alerts/a/acknowledge',['a']],
 ['07','updateAlertStatus','patch','/alerts/a/status',['a','RESOLVED']],
 ['08','getAlertsRequiringAttention','get','/alerts/attention',[{ page: 1 }]],
 ['09','respondToAlert','post','/alerts/a/respond',['a',{ note: 'Checked' }]],
 ['10','forwardAlert','post','/alerts/a/forward',['a',{ userId: 'r' }]],
 ['11','escalateAlert','post','/alerts/a/escalate',['a',{ reason: 'Critical' }]],
 ['12','getAlertEscalations','get','/alerts/a/escalations',['a']],
])('[B4-ALERT-%s] %s preserves implemented endpoint, payload, signal and result', async (_id, method, verb, path, args) => {
 const signal = new AbortController().signal, data = { success: true, alert: { id: 'a' }, unreadCount: 0 };
 api[verb].mockResolvedValue({ data }); const result = await alerts[method](...args, signal);
 const options = verb === 'get' && ['listAlerts','getAlertsRequiringAttention'].includes(method) ? { params: args[0], signal } : { signal };
 const body = method === 'updateAlertStatus' ? { status: args[1] } : ['respondToAlert','forwardAlert','escalateAlert'].includes(method) ? args[1] : {};
 expect(api[verb]).toHaveBeenCalledWith(...(verb === 'get' ? [path, options] : [path, body, options]));
 expect(result).toEqual(method === 'getAlertById' ? data.alert : method === 'getUnreadAlertsCount' ? 0 : data);
});
test('[B4-ALERT-13] omitted list arguments use default query and no signal', async () => {
 api.get.mockResolvedValue({ data: { success: true, alerts: [] } }); await alerts.listAlerts(); expect(api.get).toHaveBeenCalledWith('/alerts',{params:{},signal:undefined});
});
test('[B4-ALERT-14] server-declared failure preserves current meaningful error contract', async () => {
 api.post.mockResolvedValue({ data: { success: false, message: 'Alert locked' } }); await expect(alerts.acknowledgeAlert('a')).rejects.toThrow('Alert locked');
});
test('[B4-ALERT-15] missing server message falls back to actionable error', async () => {
 api.get.mockResolvedValue({ data: { success: false } }); await expect(alerts.listAlerts()).rejects.toThrow('Could not load safety alerts');
});
test.each([['16',401],['17',503]])('[B4-ALERT-%s] HTTP %i rejection is propagated without retries',async(_id,status)=>{
 const error={response:{status}}; api.patch.mockRejectedValue(error); await expect(alerts.updateAlertStatus('a','RESOLVED')).rejects.toBe(error); expect(api.patch).toHaveBeenCalledTimes(1);
});
test('[B4-ALERT-18] cancelled request propagates original cancellation',async()=>{
 const error=Object.assign(new Error('cancelled'),{name:'CanceledError'}); api.get.mockRejectedValue(error); await expect(alerts.getAlertById('a',new AbortController().signal)).rejects.toBe(error);
});
