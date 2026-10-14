import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
const api = vi.hoisted(() => ({ getAllRiskZones: vi.fn(), createRiskZone: vi.fn(), updateRiskZone: vi.fn(), deleteRiskZone: vi.fn() }));
const reports = vi.hoisted(() => ({ listReportingIncidents: vi.fn(), listCommunityReports: vi.fn() }));
const map = vi.hoisted(() => ({ events: {} }));
vi.mock('../../src/services/riskZoneApi', () => api);
vi.mock('../../src/services/incidentApi', () => ({ listReportingIncidents: reports.listReportingIncidents, markIncidentAsDone: vi.fn(), incidentStatuses: [] }));
vi.mock('../../src/services/communityReportApi', () => ({ listCommunityReports: reports.listCommunityReports, markCommunityReportAsDone: vi.fn() }));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div><button type="button" onClick={() => map.events.click({ latlng: { lat: 7.5, lng: 80.7 } })}>Select map position</button>{children}</div>,
  TileLayer: () => null, Circle: ({ center, radius }) => <output data-testid="preview">{center.join(',')}:{radius}</output>,
  useMapEvents: events => { map.events = events; },
}));
import Reporting from '../../src/pages/Reporting/Reporting';
const zone = { id: 'z', name: 'Waterhole', description: 'Sensitive habitat', riskLevel: 'HIGH', isActive: true, centerLatitude: 7.5, centerLongitude: 80.7, radiusMeters: 100 };
const change = (el, value) => fireEvent.change(el, { target: { value } });
const creation = () => screen.getByRole('button', { name: 'Add Risk Zone', exact: true }).closest('form');
beforeEach(() => {
  vi.resetAllMocks(); api.getAllRiskZones.mockResolvedValue({ data: [zone] });
  reports.listReportingIncidents.mockResolvedValue({ incidents: [] }); reports.listCommunityReports.mockResolvedValue({ reports: [] });
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
async function ready() { const view = render(<Reporting />); await screen.findByText('Waterhole'); await waitFor(() => expect(screen.queryByText('Loading community reports...')).not.toBeInTheDocument()); return view; }
function fill() {
  change(screen.getByPlaceholderText('e.g., Northern Waterhole Area'), 'New habitat'); change(screen.getByPlaceholderText('Describe the risk area'), 'near water');
  change(within(creation()).getByRole('combobox'), 'CRITICAL'); change(screen.getByPlaceholderText('100'), '250');
  fireEvent.click(screen.getByRole('button', { name: 'Select map position' }));
}
test('[B2-REP-01] risk list displays geometry, radius and loading state', async () => {
  render(<Reporting />); expect(screen.getByText('Loading risk zones...')).toBeInTheDocument(); await screen.findByText('Waterhole');
  expect(screen.getByText('7.5000, 80.7000')).toBeInTheDocument(); expect(screen.getByText('Radius: 100m')).toBeInTheDocument();
});
test('[B2-REP-02] required fields block empty risk creation', async () => {
  await ready(); expect(creation().checkValidity()).toBe(false); fireEvent.click(screen.getByRole('button', { name: 'Add Risk Zone', exact: true }));
  expect(api.createRiskZone).not.toHaveBeenCalled();
});
test('[B2-REP-03] map-selected creation submits normalized geometry and resets after success', async () => {
  await ready(); fill(); expect(screen.getByTestId('preview')).toHaveTextContent('7.5,80.7:250');
  api.getAllRiskZones.mockResolvedValueOnce({ data: [zone, { ...zone, id: 'new', name: 'New habitat', radiusMeters: 250 }] });
  fireEvent.click(screen.getByRole('button', { name: 'Add Risk Zone', exact: true })); await screen.findByText('Risk zone added successfully!');
  expect(api.createRiskZone).toHaveBeenCalledWith({ name: 'New habitat', description: 'near water', riskLevel: 'CRITICAL', centerLatitude: 7.5, centerLongitude: 80.7, radiusMeters: 250, parkId: 'default-park-id' });
  expect(screen.getByPlaceholderText('e.g., Northern Waterhole Area')).toHaveValue(''); expect(screen.queryByTestId('preview')).not.toBeInTheDocument(); expect(api.getAllRiskZones).toHaveBeenCalledTimes(2);
  expect(screen.getByText('New habitat')).toBeInTheDocument();
});
test('[B2-REP-04] creation pending disables submission until request settles', async () => {
  await ready(); fill(); let resolve; api.createRiskZone.mockReturnValue(new Promise(r => { resolve = r; }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Risk Zone', exact: true })); expect(screen.getByRole('button', { name: 'Adding...' })).toBeDisabled();
  await act(async () => resolve({ success: true })); expect(screen.getByRole('button', { name: 'Add Risk Zone', exact: true })).toBeEnabled();
});
test('[B2-REP-05] creation failure preserves input and exposes server error', async () => {
  await ready(); fill(); api.createRiskZone.mockRejectedValue({ response: { data: { message: 'Cannot save' } } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Risk Zone', exact: true })); await screen.findByText('Failed to add risk zone: Cannot save');
  expect(screen.getByPlaceholderText('e.g., Northern Waterhole Area')).toHaveValue('New habitat'); expect(api.getAllRiskZones).toHaveBeenCalledTimes(1);
});
test('[B2-REP-06] editing updates metadata and activity without rewriting geometry', async () => {
  const { container } = await ready(); fireEvent.click(screen.getByText('Waterhole')); const form = container.querySelectorAll('form')[1];
  api.getAllRiskZones.mockResolvedValueOnce({ data: [{ ...zone, name: 'Updated', isActive: false }] });
  change(within(form).getByDisplayValue('Waterhole'), 'Updated'); change(within(form).getAllByRole('combobox')[1], 'false');
  fireEvent.click(within(form).getByRole('button', { name: 'Update', exact: true })); await screen.findByText('Risk zone updated successfully!');
  expect(api.updateRiskZone).toHaveBeenCalledWith('z', { name: 'Updated', description: 'Sensitive habitat', riskLevel: 'HIGH', isActive: false });
  expect(screen.queryByText('Update Risk Zone')).not.toBeInTheDocument();
  expect(screen.getByText('Updated')).toBeInTheDocument();
});
test('[B2-REP-07] cancelled edit closes without a request', async () => {
  await ready(); fireEvent.click(screen.getByText('Waterhole')); fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(api.updateRiskZone).not.toHaveBeenCalled(); expect(screen.queryByText('Update Risk Zone')).not.toBeInTheDocument();
});
test('[B2-REP-08] failed update keeps modal open and values available', async () => {
  await ready(); api.updateRiskZone.mockRejectedValue(new Error('offline')); fireEvent.click(screen.getByText('Waterhole'));
  fireEvent.click(screen.getByRole('button', { name: 'Update', exact: true })); await screen.findByText('Failed to update risk zone: offline');
  expect(screen.getByText('Update Risk Zone')).toBeInTheDocument(); expect(api.getAllRiskZones).toHaveBeenCalledTimes(1);
});
test('[B2-REP-09] cancelled delete does not open editor or issue deletion', async () => {
  await ready(); vi.spyOn(window, 'confirm').mockReturnValue(false); fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(api.deleteRiskZone).not.toHaveBeenCalled(); expect(screen.queryByText('Update Risk Zone')).not.toBeInTheDocument();
});
test('[B2-REP-10] confirmed deletion reloads and success expires after three seconds', async () => {
  await ready(); vi.useFakeTimers(); vi.spyOn(window, 'confirm').mockReturnValue(true);
  api.getAllRiskZones.mockResolvedValueOnce({ data: [] });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Delete' })));
  expect(api.deleteRiskZone).toHaveBeenCalledWith('z'); expect(api.getAllRiskZones).toHaveBeenCalledTimes(2); expect(screen.getByText('Risk zone deleted successfully!')).toBeInTheDocument();
  expect(screen.queryByText('Waterhole')).not.toBeInTheDocument(); expect(screen.getByText('No risk zones added yet')).toBeInTheDocument();
  await act(async () => vi.advanceTimersByTime(3000)); expect(screen.queryByText('Risk zone deleted successfully!')).not.toBeInTheDocument();
});
test('[B2-REP-11] delete failure keeps existing zone and displays error', async () => {
  await ready(); vi.spyOn(window, 'confirm').mockReturnValue(true); api.deleteRiskZone.mockRejectedValue(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Delete' })); await screen.findByText('Failed to delete risk zone: offline');
  expect(screen.getByText('Waterhole')).toBeInTheDocument(); expect(api.getAllRiskZones).toHaveBeenCalledTimes(1);
});
test('[B2-REP-12] independent incident failure leaves risk zones usable', async () => {
  const error = new Error('incidents unavailable'), diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});
  reports.listReportingIncidents.mockRejectedValue(error); await ready(); expect(screen.getByText('Waterhole')).toBeInTheDocument();
  expect(diagnostic).toHaveBeenCalledWith('Error loading incidents:', error); expect(screen.getByRole('button', { name: 'Add Risk Zone', exact: true })).toBeEnabled();
});
