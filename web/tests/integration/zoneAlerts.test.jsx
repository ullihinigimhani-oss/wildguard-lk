import { render, screen, fireEvent, act } from '@testing-library/react';
const api = vi.hoisted(() => ({ getAllAnimals: vi.fn(), getAllRiskZones: vi.fn() }));
vi.mock('../../src/services/sensorApi', () => ({ getAllAnimals: api.getAllAnimals }));
vi.mock('../../src/services/riskZoneApi', () => ({ getAllRiskZones: api.getAllRiskZones }));
import { ZoneAlertProvider, useZoneAlerts } from '../../src/contexts/ZoneAlertContext';
const animal = { id: 'a', animalCode: 'ELE001', locations: [{ latitude: 0, longitude: 0 }] };
const zone = { id: 'z', name: 'Waterhole', isActive: true, riskLevel: 'HIGH', centerLatitude: 0, centerLongitude: 0, radiusMeters: 0 };
function Consumer() {
  const { alerts, dismissAlert } = useZoneAlerts();
  return <><output data-testid="alerts">{alerts.map(a => `${a.id}:${a.riskLevel}`).join(',')}</output>{alerts.map(a => <button key={a.id} onClick={() => dismissAlert(a.id)}>Dismiss {a.id}</button>)}</>;
}
async function mount() { let result; await act(async () => { result = render(<ZoneAlertProvider><Consumer /></ZoneAlertProvider>); }); return result; }
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  api.getAllAnimals.mockResolvedValue({ data: [animal] }); api.getAllRiskZones.mockResolvedValue({ data: [zone] });
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
test('[B2-ZONE-01] inclusive boundary creates alert containing stable animal-zone key and level', async () => {
  await mount(); expect(screen.getByTestId('alerts')).toHaveTextContent('a-z:HIGH');
});
test('[B2-ZONE-02] inactive zones, missing fixes and outside locations produce no alerts', async () => {
  const diagnostic = vi.spyOn(console, 'error');
  api.getAllAnimals.mockResolvedValue({ data: [{ id: 'no-fix', locations: [] }, { id: 'outside', locations: [{ latitude: 1, longitude: 0 }] }] });
  api.getAllRiskZones.mockResolvedValue({ data: [zone, { ...zone, id: 'inactive', isActive: false, centerLatitude: 1 }] });
  await mount(); expect(screen.getByTestId('alerts')).toBeEmptyDOMElement(); expect(diagnostic).not.toHaveBeenCalled();
});
test('[B2-ZONE-03] overlapping zones create separate alert identities per animal-zone pair', async () => {
  api.getAllRiskZones.mockResolvedValue({ data: [zone, { ...zone, id: 'other', riskLevel: 'CRITICAL' }] }); await mount();
  expect(screen.getByTestId('alerts')).toHaveTextContent('a-z:HIGH,a-other:CRITICAL');
});
test('[B2-ZONE-04] polling runs at 5000 ms, removes departed animal and stops on unmount', async () => {
  const view = await mount(); expect(api.getAllAnimals).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTime(4999)); expect(api.getAllAnimals).toHaveBeenCalledTimes(1);
  api.getAllAnimals.mockResolvedValue({ data: [] }); await act(async () => vi.advanceTimersByTime(1));
  expect(api.getAllAnimals).toHaveBeenCalledTimes(2); expect(screen.getByTestId('alerts')).toBeEmptyDOMElement();
  view.unmount(); await act(async () => vi.advanceTimersByTime(10000)); expect(api.getAllAnimals).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});
test('[B2-ZONE-05] dismissal persists across following polls', async () => {
  await mount(); await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Dismiss a-z' })));
  await act(async () => vi.advanceTimersByTime(5000)); expect(screen.getByTestId('alerts')).toBeEmptyDOMElement();
});
test('[B2-ZONE-06] partial poll failure keeps existing alerts and reports exact diagnostic', async () => {
  await mount(); const error = new Error('risk unavailable'), diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});
  api.getAllRiskZones.mockRejectedValue(error); await act(async () => vi.advanceTimersByTime(5000));
  expect(screen.getByTestId('alerts')).toHaveTextContent('a-z:HIGH'); expect(diagnostic).toHaveBeenCalledWith('Error checking zone entries:', error);
});
test('[B2-ZONE-07] poll started before dismissal cannot restore a dismissed alert', async () => {
  await mount(); let resolveOld; api.getAllAnimals.mockReturnValueOnce(new Promise(r => { resolveOld = r; }));
  await act(async () => vi.advanceTimersByTime(5000));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Dismiss a-z' })));
  expect(screen.getByTestId('alerts')).toBeEmptyDOMElement();
  await act(async () => resolveOld({ data: [animal] })); expect(screen.getByTestId('alerts')).toBeEmptyDOMElement();
});
test('[B2-ZONE-08] older overlapping poll cannot replace newer empty result', async () => {
  await mount(); let resolveOld; api.getAllAnimals.mockReturnValueOnce(new Promise(r => { resolveOld = r; })).mockResolvedValue({ data: [] });
  await act(async () => vi.advanceTimersByTime(5000)); await act(async () => vi.advanceTimersByTime(5000));
  expect(screen.getByTestId('alerts')).toBeEmptyDOMElement(); await act(async () => resolveOld({ data: [animal] }));
  expect(screen.getByTestId('alerts')).toBeEmptyDOMElement();
});
test('[B2-ZONE-09] useZoneAlerts outside provider reports required provider contract', () => {
  expect(() => render(<Consumer />)).toThrow('useZoneAlerts must be used within ZoneAlertProvider');
});
test('[B2-ZONE-10] malformed polling array preserves previous alerts and reports failure', async () => {
  await mount(); const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});
  api.getAllAnimals.mockResolvedValue({ data: {} }); await act(async () => vi.advanceTimersByTime(5000));
  expect(screen.getByTestId('alerts')).toHaveTextContent('a-z:HIGH'); expect(diagnostic).toHaveBeenCalledWith('Error checking zone entries:', expect.any(TypeError));
});
