import { renderHook, waitFor, act } from '@testing-library/react';
import useApiHealth from '../../src/hooks/useApiHealth';
import { getHealth } from '../../src/services/api';
vi.mock('../../src/services/api', () => ({ getHealth: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
test('[B3-HEALTH-01] health starts checking and resolves connected only with both flags', async () => {
  getHealth.mockResolvedValue({ success: true, database: 'connected' }); const { result } = renderHook(useApiHealth); expect(result.current).toBe('Checking API'); await waitFor(() => expect(result.current).toBe('API connected')); expect(getHealth).toHaveBeenCalledWith(expect.any(AbortSignal));
});
test.each([['02', { success: false, database: 'connected' }], ['03', { success: true, database: 'disconnected' }], ['04', null]])('[B3-HEALTH-%s] unhealthy or malformed %j becomes unavailable', async (_id, data) => {
  getHealth.mockResolvedValue(data); const { result } = renderHook(useApiHealth); await waitFor(() => expect(result.current).toBe('API unavailable'));
});
test('[B3-HEALTH-05] network rejection becomes unavailable without unhandled error', async () => {
  getHealth.mockRejectedValue(new Error('offline')); const { result } = renderHook(useApiHealth); await waitFor(() => expect(result.current).toBe('API unavailable'));
});
test('[B3-HEALTH-06] unmount aborts pending request and late result cannot change hook snapshot', async () => {
  let resolve; getHealth.mockReturnValue(new Promise(r => { resolve = r; })); const view = renderHook(useApiHealth); const signal = getHealth.mock.calls[0][0]; view.unmount(); expect(signal.aborted).toBe(true);
  await act(async () => resolve({ success: true, database: 'connected' })); expect(view.result.current).toBe('Checking API');
});
