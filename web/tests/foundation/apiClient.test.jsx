import { act, renderHook } from '@testing-library/react';
import { api, getHealth } from '../../src/services/api';
import { AuthProvider, useAuth } from '../../src/hooks/useAuth';
import { loginAccount } from '../../src/services/authApi';
vi.mock('../../src/services/authApi', () => ({ loginAccount: vi.fn() }));
const originalAdapter = api.defaults.adapter;
const user = { id: 'new', role: 'PARK_MANAGER', approvalStatus: 'APPROVED' };
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); delete api.defaults.headers.common.Authorization; api.defaults.adapter = vi.fn(); });
afterEach(() => { api.defaults.adapter = originalAdapter; delete api.defaults.headers.common.Authorization; sessionStorage.clear(); });
test('[B3-CLIENT-01] actual Axios health request preserves signal and Authorization header', async () => {
  const signal = new AbortController().signal; api.defaults.headers.common.Authorization = 'Bearer fixture-token';
  api.defaults.adapter.mockImplementation(async config => ({ data: { success: true, database: 'connected' }, status: 200, statusText: 'OK', headers: {}, config }));
  expect(await getHealth(signal)).toEqual({ success: true, database: 'connected' });
  const config = api.defaults.adapter.mock.calls[0][0]; expect(config.url).toBe('/health'); expect(config.signal).toBe(signal); expect(config.headers.get('Authorization')).toBe('Bearer fixture-token');
});
test('[B3-CLIENT-02] already aborted Axios request never reaches mock transport', async () => {
  const controller = new AbortController(); controller.abort(); await expect(getHealth(controller.signal)).rejects.toMatchObject({ name: 'CanceledError' }); expect(api.defaults.adapter).not.toHaveBeenCalled();
});
test('[B3-CLIENT-03] actual Axios adapter rejection propagates without invented health success', async () => {
  const error = new Error('fixture transport unavailable'); api.defaults.adapter.mockRejectedValue(error); await expect(getHealth()).rejects.toBe(error);
});
test('[B3-CLIENT-04] delayed old-session 401 cannot clear newer login through actual interceptors', async () => {
  let rejectOld; sessionStorage.setItem('wildguard.session', 'fixture-old');
  api.defaults.adapter.mockImplementation(async config => ({ data: { user: { ...user, id: 'old' } }, status: 200, statusText: 'OK', headers: {}, config }));
  loginAccount.mockResolvedValue({ user, token: 'fixture-new' }); let view;
  await act(async () => { view = renderHook(useAuth, { wrapper: AuthProvider }); });
  api.defaults.adapter.mockImplementationOnce(config => new Promise((_resolve, reject) => {
    rejectOld = () => reject(Object.assign(new Error('old session expired'), { config, response: { status: 401, data: {} } }));
  }));
  let outcome; await act(async () => { outcome = getHealth().catch(error => error); });
  expect(api.defaults.adapter.mock.calls[1][0].headers.get('Authorization')).toBe('Bearer fixture-old');
  await act(async () => view.result.current.login({})); await act(async () => rejectOld());
  expect((await outcome).response.status).toBe(401);
  expect(view.result.current.user).toEqual(user); expect(sessionStorage.getItem('wildguard.session')).toBe('fixture-new'); expect(api.defaults.headers.common.Authorization).toBe('Bearer fixture-new');
});
