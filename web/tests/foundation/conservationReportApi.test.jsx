import { api } from '../../src/services/api';
import * as reports from '../../src/services/conservationReportApi';
vi.mock('../../src/services/api', () => ({ api: { get: vi.fn(), defaults: { baseURL: 'https://fixture.example/api' } } }));
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
test('[B3-RAPI-01] report types preserve cancellation signal and unwrap validated list', async () => {
  const signal = new AbortController().signal; api.get.mockResolvedValue({ data: { success: true, data: ['INCIDENT', 'PATROL'] } });
  expect(await reports.getReportTypes(signal)).toEqual(['INCIDENT', 'PATROL']); expect(api.get).toHaveBeenCalledWith('/reports/types', { signal });
});
test.each([['02', null], ['03', { success: false, data: [] }], ['04', { success: true, data: {} }]])(
  '[B3-RAPI-%s] malformed report types %j fail explicitly', async (_id, data) => {
    api.get.mockResolvedValue({ data }); await expect(reports.getReportTypes()).rejects.toThrow('Report types unavailable');
  });
test('[B3-RAPI-05] generation whitelists all implemented filters and preserves zero and signal', async () => {
  const data = { reportType: 'INCIDENT_REPORT' }, signal = new AbortController().signal;
  api.get.mockResolvedValue({ data: { success: true, data } });
  const params = Object.freeze({ reportType: 'INCIDENT', from: 'from', to: 'to', period: 'month', area: 'Block & Lake', type: '', status: 'PENDING', priority: 0, secret: 'fixture-only' });
  expect(await reports.generateReport(params, signal)).toBe(data);
  expect(api.get).toHaveBeenCalledWith('/reports/generate', { params: { reportType: 'INCIDENT', from: 'from', to: 'to', period: 'month', area: 'Block & Lake', status: 'PENDING', priority: 0 }, signal });
});
test('[B3-RAPI-06] incomplete generation envelope is rejected', async () => {
  api.get.mockResolvedValue({ data: { success: true, data: {} } }); await expect(reports.generateReport({ reportType: 'PATROL' })).rejects.toThrow('Report data unavailable');
});
test('[B3-RAPI-07] HTTP generation rejection reaches caller unchanged', async () => {
  const error = { response: { status: 403 } }; api.get.mockRejectedValue(error); await expect(reports.generateReport({})).rejects.toBe(error);
});
test('[B3-RAPI-08] export URL encodes allowed filters and keeps token out of query', () => {
  sessionStorage.setItem('wildguard.session', 'fixture-token');
  const result = reports.buildExportUrl({ reportType: 'PATROL', area: 'Lake & Gate', ignored: 'no', type: '' }, 'CSV');
  const url = new URL(result.url); expect(result.token).toBe('fixture-token');
  expect(Object.fromEntries(url.searchParams)).toEqual({ reportType: 'PATROL', area: 'Lake & Gate', format: 'CSV' });
  expect(result.url).not.toContain('fixture-token');
});
function downloadMocks(headers = '') {
  const blob = new Blob(['fixture csv']); vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => blob, headers: { get: () => headers } })));
  const create = vi.fn(() => 'blob:fixture'), revoke = vi.fn();
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: create, revokeObjectURL: revoke }));
  const clicked = []; vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { clicked.push({ filename: this.download, href: this.href, attached: document.body.contains(this) }); });
  return { blob, create, revoke, clicked };
}
test('[B3-RAPI-09] authenticated CSV download uses server filename and releases URL/anchor', async () => {
  sessionStorage.setItem('wildguard.session', 'fixture-token'); const mock = downloadMocks('attachment; filename="park.csv"');
  await reports.downloadReport({ reportType: 'INCIDENT' }, 'CSV');
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/reports/export?'), { headers: { Authorization: 'Bearer fixture-token' } });
  expect(mock.create).toHaveBeenCalledWith(mock.blob); expect(mock.clicked).toEqual([{ filename: 'park.csv', href: 'blob:fixture', attached: true }]);
  expect(mock.revoke).toHaveBeenCalledWith('blob:fixture'); expect(document.querySelector('a[download]')).toBeNull();
});
test.each([['10', 'CSV', 'csv'], ['11', 'PDF', 'html']])('[B3-RAPI-%s] missing filename uses deterministic %s export fallback', async (_id, format, extension) => {
  vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(1000); const mock = downloadMocks(); await reports.downloadReport({}, format);
  expect(mock.clicked[0].filename).toBe(`conservation_report_1000.${extension}`);
});
test('[B3-RAPI-12] HTTP export failure does not create download resources', async () => {
  const mock = downloadMocks(); fetch.mockResolvedValue({ ok: false, status: 401 });
  await expect(reports.downloadReport({}, 'CSV')).rejects.toThrow('Export failed: 401'); expect(mock.create).not.toHaveBeenCalled();
});
test('[B3-RAPI-13] failed blob decoding does not create resources', async () => {
  const mock = downloadMocks(); fetch.mockResolvedValue({ ok: true, blob: async () => { throw new Error('blob failed'); } });
  await expect(reports.downloadReport({}, 'CSV')).rejects.toThrow('blob failed'); expect(mock.create).not.toHaveBeenCalled();
});
test('[B3-RAPI-14] failed browser save still removes anchor and revokes URL', async () => {
  const mock = downloadMocks(); HTMLAnchorElement.prototype.click.mockImplementation(() => { throw new Error('save failed'); });
  await expect(reports.downloadReport({}, 'CSV')).rejects.toThrow('save failed');
  expect(document.querySelector('a[download]')).toBeNull(); expect(mock.revoke).toHaveBeenCalledWith('blob:fixture');
});
test.each([['15', 401, 'Your session expired. Sign in again.'], ['16', 403, 'Conservation reports are only available to approved Park Managers.'], ['17', 400, 'Check the selected filters and date range.'], ['18', 500, 'Unable to generate report. Please retry.']])(
  '[B3-RAPI-%s] status %i maps to actionable report error', (_id, status, message) => expect(reports.reportApiError({ response: { status } })).toBe(message));
test('[B3-RAPI-19] meaningful server message takes precedence but blank message does not', () => {
  expect(reports.reportApiError({ response: { status: 400, data: { message: 'Invalid range' } } })).toBe('Invalid range');
  expect(reports.reportApiError({ response: { status: 400, data: { message: '  ' } } })).toBe('Check the selected filters and date range.');
});
test('[B3-RAPI-20] Sri Lanka date boundaries cover the entire exact calendar day', () => {
  expect(reports.toSriLankaFrom('2026-01-01')).toBe('2026-01-01T00:00:00+05:30');
  expect(reports.toSriLankaTo('2026-01-01')).toBe('2026-01-01T23:59:59.999+05:30');
  expect(reports.toSriLankaFrom('')).toBeUndefined(); expect(reports.toSriLankaTo('')).toBeUndefined();
});
