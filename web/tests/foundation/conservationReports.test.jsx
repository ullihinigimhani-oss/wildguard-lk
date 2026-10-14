import { render, screen, fireEvent, act } from '@testing-library/react';
const account = vi.hoisted(() => ({ user: null }));
vi.mock('../../src/hooks/useAuth', () => ({ useAuth: () => account }));
vi.mock('../../src/services/conservationReportApi', async () => ({ ...(await vi.importActual('../../src/services/conservationReportApi')), generateReport: vi.fn(), downloadReport: vi.fn() }));
vi.mock('../../src/utils/reportPdf', () => ({ downloadReportAsPdf: vi.fn() }));
import { generateReport, downloadReport } from '../../src/services/conservationReportApi';
import { downloadReportAsPdf } from '../../src/utils/reportPdf';
import ConservationReports from '../../src/pages/ConservationReports/ConservationReports';
const fixture = (type = 'INCIDENT_REPORT') => ({ reportType: type, generatedBy: { name: 'Manager' }, generatedAt: '2026-01-01T12:00:00Z', filters: {},
  summary: { totalIncidents: 1, totalPatrols: 1, totalReports: 1, conflictReports: 1, byType: [], byStatus: [], byPriority: [], byArea: [] },
  incidents: [{ id: 'i', title: 'Snare fixture', type: 'POACHING_SNARE', status: 'PENDING' }], patrols: [{ id: 'p', routeName: 'Gate patrol' }], reports: [{ id: 'r', species: 'Elephant', type: 'HUMAN_WILDLIFE_CONFLICT' }] });
const select = name => fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }));
const change = (label, value) => fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Generate Report' }));
async function preview() { render(<ConservationReports />); select('Incident Report'); submit(); await screen.findByText('Snare fixture'); }
beforeEach(() => { vi.resetAllMocks(); account.user = { role: 'PARK_MANAGER', approvalStatus: 'APPROVED' }; generateReport.mockResolvedValue(fixture()); });
test.each([['01', null], ['02', { role: 'RANGER', approvalStatus: 'APPROVED' }], ['03', { role: 'PARK_MANAGER', approvalStatus: 'PENDING' }]])(
  '[B3-RUI-%s] unsupported account %j cannot generate or export', (_id, user) => {
    account.user = user; render(<ConservationReports />); expect(screen.getByText('This section is available to approved Park Managers.')).toBeInTheDocument(); expect(generateReport).not.toHaveBeenCalled(); expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
test('[B3-RUI-04] successful filtered report maps full Sri Lanka day and displayed records', async () => {
  render(<ConservationReports />); select('Incident Report'); change('From', '2026-01-01'); change('To', '2026-01-01'); change('Area / Location', 'Lake'); change('Status', 'PENDING'); submit();
  await screen.findByText('Snare fixture'); expect(generateReport).toHaveBeenCalledWith(expect.objectContaining({ reportType: 'INCIDENT', from: '2026-01-01T00:00:00+05:30', to: '2026-01-01T23:59:59.999+05:30', area: 'Lake', status: 'PENDING' }), expect.any(AbortSignal));
  expect(screen.getByText('1 records')).toBeInTheDocument(); expect(screen.getByText('Total Incidents').parentElement).toHaveTextContent('1');
});
test('[B3-RUI-05] report type switch retains date/area and resets incompatible type/status/priority', () => {
  render(<ConservationReports />); select('Patrol Operations'); change('From', '2026-01-01'); change('Area / Location', 'Gate'); change('Type', 'ROUTINE'); change('Status', 'COMPLETED'); change('Priority', 'HIGH'); select('Incident Report');
  expect(screen.getByLabelText('From')).toHaveValue('2026-01-01'); expect(screen.getByLabelText('Area / Location')).toHaveValue('Gate'); expect(screen.getByLabelText('Type', { exact: true })).toHaveValue(''); expect(screen.getByLabelText('Status')).toHaveValue(''); expect(screen.queryByLabelText('Priority')).not.toBeInTheDocument();
});
test('[B3-RUI-06] pending generation disables repeat submission and shows loading', async () => {
  let resolve; generateReport.mockReturnValue(new Promise(r => { resolve = r; })); render(<ConservationReports />); select('Incident Report'); submit();
  expect(screen.getByRole('button', { name: 'Generating…' })).toBeDisabled(); expect(screen.getByText('Generating report…')).toBeInTheDocument();
  await act(async () => resolve(fixture())); expect(screen.getByText('Snare fixture')).toBeInTheDocument();
});
test('[B3-RUI-07] empty report presents zero counts and explicit empty records', async () => {
  generateReport.mockResolvedValue({ ...fixture(), incidents: [], summary: { totalIncidents: 0 } }); render(<ConservationReports />); select('Incident Report'); submit();
  await screen.findByText('0 records'); expect(screen.getByText('Total Incidents').parentElement).toHaveTextContent('0'); expect(screen.getByText(/No incidents/)).toBeInTheDocument();
});
test('[B3-RUI-08] failed generation shows authorization error and successful retry clears it', async () => {
  generateReport.mockRejectedValueOnce({ response: { status: 403 } }); render(<ConservationReports />); select('Incident Report'); submit();
  await screen.findByRole('alert'); expect(screen.getByRole('alert')).toHaveTextContent('approved Park Managers'); submit(); await screen.findByText('Snare fixture'); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
test('[B3-RUI-09] PDF uses generated data without HTTP and exposes generation error', async () => {
  await preview(); fireEvent.click(screen.getByRole('button', { name: /Download PDF/ })); expect(downloadReportAsPdf).toHaveBeenCalledWith(fixture()); expect(downloadReport).not.toHaveBeenCalled();
  downloadReportAsPdf.mockImplementation(() => { throw new Error('pdf unavailable'); }); fireEvent.click(screen.getByRole('button', { name: /Download PDF/ })); await screen.findByText('PDF generation failed. Try downloading the CSV instead.');
});
test('[B3-RUI-10] CSV pending disables both exports and restores retry after error', async () => {
  await preview(); let reject; downloadReport.mockReturnValue(new Promise((_r, r) => { reject = r; })); fireEvent.click(screen.getByRole('button', { name: /Download CSV/ }));
  expect(screen.getByRole('button', { name: 'Preparing…' })).toBeDisabled(); expect(screen.getByRole('button', { name: /Download PDF/ })).toBeDisabled();
  await act(async () => reject(new Error('offline'))); expect(screen.getByRole('alert')).toHaveTextContent('Unable to generate report'); expect(screen.getByRole('button', { name: /Download CSV/ })).toBeEnabled();
});
test('[B3-RUI-11] unmount aborts pending report request', () => {
  generateReport.mockReturnValue(new Promise(() => {})); const view = render(<ConservationReports />); select('Incident Report'); submit(); const signal = generateReport.mock.calls[0][1]; view.unmount(); expect(signal.aborted).toBe(true);
});
test('[B3-RUI-12] reversed range is rejected before any report API request', async () => {
  render(<ConservationReports />); select('Incident Report'); change('From', '2026-01-02'); change('To', '2026-01-01'); submit();
  expect(await screen.findByRole('alert')).toHaveTextContent(/date|range/i); expect(generateReport).not.toHaveBeenCalled();
});
test('[B3-RUI-13] switching report type invalidates a late previous report', async () => {
  let resolve; generateReport.mockReturnValue(new Promise(r => { resolve = r; })); render(<ConservationReports />); select('Incident Report'); submit(); const signal = generateReport.mock.calls[0][1]; select('Patrol Operations');
  await act(async () => resolve(fixture())); expect(screen.queryByText('Snare fixture')).not.toBeInTheDocument(); expect(signal.aborted).toBe(true); expect(screen.getByRole('button', { name: 'Generate Report' })).toBeEnabled();
});
test('[B3-RUI-14] clearing filters invalidates pending result', async () => {
  let resolve; generateReport.mockReturnValue(new Promise(r => { resolve = r; })); render(<ConservationReports />); select('Incident Report'); change('Area / Location', 'Lake'); submit(); fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  await act(async () => resolve(fixture())); expect(screen.queryByText('Snare fixture')).not.toBeInTheDocument(); expect(screen.getByLabelText('Area / Location')).toHaveValue('');
});
test('[B3-RUI-15] CSV exports the preview filters even after unsent form edits', async () => {
  downloadReport.mockResolvedValue(undefined);
  await preview(); change('Area / Location', 'Unsubmitted area');
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Download CSV/ })));
  expect(downloadReport).toHaveBeenCalledWith(expect.objectContaining({ reportType: 'INCIDENT', area: undefined }), 'CSV');
  expect(screen.getByRole('button', { name: /Download CSV/ })).toBeEnabled();
});
test.each([['16', 'Patrol Operations', 'PATROL', 'PATROL_OPERATIONS_REPORT', 'Gate patrol'], ['17', 'Human-Wildlife Conflict Trend', 'CONFLICT_TREND', 'CONFLICT_TREND_REPORT', 'Elephant']])(
  '[B3-RUI-%s] implemented %s report renders its own record shape', async (_id, label, key, type, text) => {
    generateReport.mockResolvedValue(fixture(type)); render(<ConservationReports />); select(label); submit(); await screen.findByText(text);
    expect(generateReport).toHaveBeenCalledWith(expect.objectContaining({ reportType: key }), expect.any(AbortSignal)); expect(screen.getByText('1 records')).toBeInTheDocument();
  });
test('[B3-RUI-18] cancellation rejection leaves no error and permits retry', async () => {
  generateReport.mockRejectedValueOnce(Object.assign(new Error('cancelled'), { name: 'CanceledError' })); render(<ConservationReports />); select('Incident Report');
  await act(async () => submit()); expect(screen.queryByRole('alert')).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Generate Report' })).toBeEnabled(); submit(); await screen.findByText('Snare fixture');
});
test('[B3-RUI-19] repeated completed submissions replace preview without accumulating rows', async () => {
  await preview(); generateReport.mockResolvedValue({ ...fixture(), incidents: [{ id: 'new', title: 'Second report' }] }); submit(); await screen.findByText('Second report');
  expect(screen.queryByText('Snare fixture')).not.toBeInTheDocument(); expect(generateReport).toHaveBeenCalledTimes(2); expect(screen.getByText('1 records')).toBeInTheDocument();
});
