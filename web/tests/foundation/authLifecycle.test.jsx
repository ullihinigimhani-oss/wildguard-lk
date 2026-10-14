import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../src/hooks/useAuth';
import { api } from '../../src/services/api';
import { loginAccount } from '../../src/services/authApi';
vi.mock('../../src/services/api', () => ({ api: { get: vi.fn(), defaults: { headers: { common: {} } }, interceptors: { response: { use: vi.fn(), eject: vi.fn() } } } }));
vi.mock('../../src/services/authApi', () => ({ loginAccount: vi.fn() }));
const user = { id: 'u', name: 'Fixture', role: 'PARK_MANAGER', approvalStatus: 'APPROVED' };
const token = exp => `header.${btoa(JSON.stringify({ exp }))}.signature`;
const mount = () => renderHook(useAuth, { wrapper: AuthProvider });
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); delete api.defaults.headers.common.Authorization; api.interceptors.response.use.mockReturnValue(17); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
test('[B3-AUTH-01] no stored session finishes loading without restoration request', async () => {
  const { result } = mount(); await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.isAuthenticated).toBe(false); expect(api.get).not.toHaveBeenCalled();
});
test('[B3-AUTH-02] restores stored session and applies Authorization before profile request', async () => {
  sessionStorage.setItem('wildguard.session', 'opaque-fixture'); api.get.mockResolvedValue({ data: { user } }); const { result } = mount();
  await waitFor(() => expect(result.current.user).toEqual(user)); expect(api.get).toHaveBeenCalledWith('/auth/me');
  expect(api.defaults.headers.common.Authorization).toBe('Bearer opaque-fixture');
});
test.each([['03', { response: { status: 401 } }], ['04', new Error('network failure')]])('[B3-AUTH-%s] failed restoration clears unusable session', async (_id, error) => {
  sessionStorage.setItem('wildguard.session', 'old'); api.get.mockRejectedValue(error); const { result } = mount();
  await waitFor(() => expect(result.current.isLoading).toBe(false)); expect(result.current.user).toBeNull();
  expect(sessionStorage.getItem('wildguard.session')).toBeNull(); expect(api.defaults.headers.common.Authorization).toBeUndefined();
});
test('[B3-AUTH-05] successful login sets profile, token and header; logout clears all three', async () => {
  loginAccount.mockResolvedValue({ user, token: 'opaque-login' }); const { result } = mount();
  await act(async () => result.current.login({ email: 'fixture@example.test', password: 'fixture-only' }));
  expect(result.current.isAuthenticated).toBe(true); expect(sessionStorage.getItem('wildguard.session')).toBe('opaque-login');
  act(() => result.current.logout()); expect(result.current.user).toBeNull(); expect(api.defaults.headers.common.Authorization).toBeUndefined(); expect(sessionStorage.length).toBe(0);
});
test('[B3-AUTH-06] login error propagates without publishing a session', async () => {
  const error = new Error('login unavailable'); loginAccount.mockRejectedValue(error); const { result } = mount();
  await act(async () => { await expect(result.current.login({})).rejects.toBe(error); }); expect(result.current.user).toBeNull(); expect(sessionStorage.length).toBe(0);
});
test.each([['07', 401, undefined], ['08', 403, 'ACCOUNT_NOT_APPROVED']])('[B3-AUTH-%s] interceptor invalidates expired or unapproved session', async (_id, status, code) => {
  loginAccount.mockResolvedValue({ user, token: 'opaque' }); const { result } = mount(); await act(async () => result.current.login({}));
  const reject = api.interceptors.response.use.mock.calls[0][1], error = { response: { status, data: { code } } };
  await act(async () => { await expect(reject(error)).rejects.toBe(error); }); expect(result.current.user).toBeNull(); expect(sessionStorage.length).toBe(0);
});
test('[B3-AUTH-09] ordinary 403 preserves session and successful interceptor preserves response', async () => {
  loginAccount.mockResolvedValue({ user, token: 'opaque' }); const { result } = mount(); await act(async () => result.current.login({}));
  const [accept, reject] = api.interceptors.response.use.mock.calls[0], response = { status: 200 };
  expect(accept(response)).toBe(response); const error = { response: { status: 403 } };
  await expect(reject(error)).rejects.toBe(error); expect(result.current.user).toEqual(user);
});
test('[B3-AUTH-10] JWT expires exactly at its boundary and cancels timer on logout', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] }).setSystemTime(1000000); loginAccount.mockResolvedValue({ user, token: token(1002) }); const { result } = mount();
  await act(async () => result.current.login({})); await act(async () => vi.advanceTimersByTime(1999)); expect(result.current.isAuthenticated).toBe(true);
  await act(async () => vi.advanceTimersByTime(1)); expect(result.current.isAuthenticated).toBe(false); expect(sessionStorage.length).toBe(0);
});
test('[B3-AUTH-11] already expired JWT logs out immediately after server-authorized login', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] }).setSystemTime(1000000); loginAccount.mockResolvedValue({ user, token: token(999) }); const { result } = mount();
  await act(async () => result.current.login({})); await act(async () => vi.advanceTimersByTime(0)); expect(result.current.user).toBeNull();
});
test('[B3-AUTH-12] unmount ejects interceptor and clears expiry timer', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] }).setSystemTime(1000000); loginAccount.mockResolvedValue({ user, token: token(1002) }); const view = mount();
  const scheduled = vi.spyOn(globalThis, 'setTimeout'), cleared = vi.spyOn(globalThis, 'clearTimeout');
  await act(async () => view.result.current.login({})); const index = scheduled.mock.calls.findIndex(([_callback, delay]) => delay === 2000);
  expect(index).toBeGreaterThanOrEqual(0); const timer = scheduled.mock.results[index].value; view.unmount();
  expect(api.interceptors.response.eject).toHaveBeenCalledWith(17); expect(cleared).toHaveBeenCalledWith(timer);
});
test('[B3-AUTH-13] malformed opaque token defers validity to server rather than decoding logout', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] }); loginAccount.mockResolvedValue({ user, token: 'not-a-jwt' }); const { result } = mount();
  await act(async () => result.current.login({})); await act(async () => vi.advanceTimersByTime(3600000)); expect(result.current.user).toEqual(user);
});
test('[B3-AUTH-14] delayed restoration cannot undo explicit logout', async () => {
  let resolve; sessionStorage.setItem('wildguard.session', 'old'); api.get.mockReturnValue(new Promise(r => { resolve = r; })); const { result } = mount();
  act(() => result.current.logout()); await act(async () => resolve({ data: { user } })); expect(result.current.user).toBeNull(); expect(sessionStorage.length).toBe(0);
});
test('[B3-AUTH-15] unmounted restoration failure cannot clear a newer session', async () => {
  let reject; sessionStorage.setItem('wildguard.session', 'old'); api.get.mockReturnValue(new Promise((_r, r) => { reject = r; })); const view = mount(); view.unmount();
  sessionStorage.setItem('wildguard.session', 'new'); api.defaults.headers.common.Authorization = 'Bearer new';
  await act(async () => reject(new Error('old request rejected')));
  expect(sessionStorage.getItem('wildguard.session')).toBe('new'); expect(api.defaults.headers.common.Authorization).toBe('Bearer new');
});
test('[B3-AUTH-16] pending login completion cannot undo explicit logout', async () => {
  let resolve; loginAccount.mockReturnValue(new Promise(r => { resolve = r; })); const { result } = mount();
  let pending; act(() => { pending = result.current.login({}); }); act(() => result.current.logout());
  await act(async () => { resolve({ user, token: 'late-login' }); await pending; });
  expect(result.current.user).toBeNull(); expect(sessionStorage.length).toBe(0);
});
test('[B3-AUTH-17] older restoration rejection cannot erase a completed new login', async () => {
  let reject; sessionStorage.setItem('wildguard.session', 'old'); api.get.mockReturnValue(new Promise((_r, r) => { reject = r; })); loginAccount.mockResolvedValue({ user, token: 'new-login' }); const { result } = mount();
  await act(async () => result.current.login({})); await act(async () => reject(new Error('old restore failed')));
  expect(result.current.user).toEqual(user); expect(sessionStorage.getItem('wildguard.session')).toBe('new-login'); expect(api.defaults.headers.common.Authorization).toBe('Bearer new-login');
});
test('[B3-AUTH-18] later login wins when earlier login resolves last', async () => {
  let resolve; loginAccount.mockReturnValueOnce(new Promise(r => { resolve = r; })).mockResolvedValue({ user: { ...user, id: 'new' }, token: 'new-login' }); const { result } = mount();
  let pending; act(() => { pending = result.current.login({ email: 'old@example.test' }); }); await act(async () => result.current.login({ email: 'new@example.test' }));
  await act(async () => { resolve({ user, token: 'old-login' }); await pending; }); expect(result.current.user.id).toBe('new'); expect(sessionStorage.getItem('wildguard.session')).toBe('new-login');
});
test('[B3-AUTH-19] new successful login finishes loading without waiting for old restoration', async () => {
  sessionStorage.setItem('wildguard.session', 'old'); api.get.mockReturnValue(new Promise(() => {})); loginAccount.mockResolvedValue({ user, token: 'new-login' }); const { result } = mount();
  expect(result.current.isLoading).toBe(true); await act(async () => result.current.login({})); expect(result.current.isLoading).toBe(false); expect(result.current.isAuthenticated).toBe(true);
});
test('[B3-AUTH-20] explicit logout finishes pending session-restoration loading', () => {
  sessionStorage.setItem('wildguard.session', 'old'); api.get.mockReturnValue(new Promise(() => {})); const { result } = mount();
  expect(result.current.isLoading).toBe(true); act(() => result.current.logout()); expect(result.current.isLoading).toBe(false); expect(result.current.isAuthenticated).toBe(false);
});
