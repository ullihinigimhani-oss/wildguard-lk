import { downloadReportAsPdf } from '../../src/utils/reportPdf';
const mocks = vi.hoisted(() => ({ doc: null, table: vi.fn(), construct: vi.fn() }));
vi.mock('jspdf', () => ({ default: function (options) { mocks.construct(options); return mocks.doc; } }));
vi.mock('jspdf-autotable', () => ({ default: (...args) => mocks.table(...args) }));
const fixture = reportType => ({ reportType, generatedBy: { name: 'Fixture Manager' }, generatedAt: '2026-01-01T12:00:00Z', filters: { area: 'Gate', dateFrom: 'invalid', status: 'UNDER_REVIEW' },
  summary: { totalIncidents: 1, totalPatrols: 1, totalReports: 1, conflictReports: 1, byType: [{ key: 'POACHING_SNARE', count: 1 }], byStatus: [{ key: 'PENDING', count: 1 }], byPriority: [], byArea: [] },
  incidents: [{ title: 'Snare', type: 'POACHING_SNARE', status: 'UNDER_REVIEW', reportedAt: 'invalid', location: null, reporterName: 'Ranger' }],
  patrols: [{ routeName: 'Gate', type: 'ROUTINE', priority: 'HIGH', status: 'COMPLETED', rangerName: 'Ranger', scheduledDate: 'invalid', waypointCount: 0, incidentCount: 2 }],
  reports: [{ type: 'HUMAN_WILDLIFE_CONFLICT', species: 'Elephant', status: 'VERIFIED', submittedAt: 'invalid', location: 'Lake', isAnonymous: true }] });
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(new Date('2026-01-02T00:00:00Z'));
  mocks.doc = Object.fromEntries(['setFillColor', 'setDrawColor', 'roundedRect', 'setFont', 'setFontSize', 'setTextColor', 'text', 'rect', 'addPage', 'setPage', 'line', 'save'].map(key => [key, vi.fn()]));
  mocks.doc.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 }, getNumberOfPages: () => 2 };
  mocks.table.mockImplementation((doc, options) => { doc.lastAutoTable = { finalY: options.startY + 20 }; });
});
afterEach(() => vi.useRealTimers());
function recordBody() { return mocks.table.mock.calls.find(([, options]) => options.head[0][0] !== 'Category')[1].body; }
test('[B3-PDF-01] incident PDF maps dates, nulls, human labels and reporter data', () => {
  downloadReportAsPdf(fixture('INCIDENT_REPORT'));
  expect(recordBody()).toEqual([['Snare', 'POACHING SNARE', 'UNDER REVIEW', '—', '—', 'Ranger']]);
  expect(mocks.doc.save).toHaveBeenCalledWith('incident_report_2026-01-02.pdf');
});
test('[B3-PDF-02] patrol PDF retains numeric zero waypoints and incident counts', () => {
  downloadReportAsPdf(fixture('PATROL_OPERATIONS_REPORT'));
  expect(recordBody()).toEqual([['Gate', 'ROUTINE', 'HIGH', 'COMPLETED', 'Ranger', '—', '0', '2']]);
  expect(mocks.doc.save).toHaveBeenCalledWith('patrol_operations_report_2026-01-02.pdf');
});
test('[B3-PDF-03] conflict PDF maps anonymous records without exposing identity', () => {
  downloadReportAsPdf(fixture('CONFLICT_TREND_REPORT'));
  expect(recordBody()).toEqual([['HUMAN WILDLIFE CONFLICT', 'Elephant', 'VERIFIED', '—', 'Lake', 'Yes']]);
});
test('[B3-PDF-04] empty incident report renders metrics and footer without empty tables', () => {
  const data = fixture('INCIDENT_REPORT'); data.summary = { totalIncidents: 0 }; data.incidents = [];
  downloadReportAsPdf(data); expect(mocks.table).not.toHaveBeenCalled(); expect(mocks.doc.text).toHaveBeenCalledWith('0', expect.any(Number), expect.any(Number));
});
test('[B3-PDF-05] header filters and every page footer map supplied metadata', () => {
  downloadReportAsPdf(fixture('INCIDENT_REPORT'));
  expect(mocks.construct).toHaveBeenCalledWith({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  expect(mocks.doc.text).toHaveBeenCalledWith(expect.stringContaining('Fixture Manager'), 14, 42);
  expect(mocks.doc.text).toHaveBeenCalledWith(expect.stringContaining('Area: Gate'), 14, 48);
  expect(mocks.doc.setPage.mock.calls).toEqual([[1], [2]]); expect(mocks.doc.text).toHaveBeenCalledWith('Page 2 of 2', expect.any(Number), expect.any(Number), { align: 'right' });
});
test('[B3-PDF-06] page overflow adds page and continuation heading', () => {
  mocks.doc.internal.pageSize.getHeight = () => 100; downloadReportAsPdf(fixture('INCIDENT_REPORT'));
  expect(mocks.doc.addPage).toHaveBeenCalled(); const options = mocks.table.mock.calls.find(([, value]) => value.didDrawPage)[1];
  options.didDrawPage({ settings: { margin: { left: 14 } } }); expect(mocks.doc.text).toHaveBeenCalledWith('WildGuard — Incident Records  (continued)', 14, 10);
});
test('[B3-PDF-07] zero-count breakdown avoids non-finite bar geometry', () => {
  const data = fixture('INCIDENT_REPORT'); data.summary.byType[0].count = 0; downloadReportAsPdf(data);
  const options = mocks.table.mock.calls[0][1]; options.didDrawCell({ section: 'body', column: { index: 2 }, row: { index: 0 }, cell: { x: 0, y: 0, width: 50, height: 10 } });
  expect(mocks.doc.roundedRect.mock.calls.every(args => args.slice(0, 6).every(Number.isFinite))).toBe(true);
});
test('[B3-PDF-08] unsupported report type uses explicit fallback content', () => {
  downloadReportAsPdf(fixture('UNKNOWN')); expect(mocks.doc.text).toHaveBeenCalledWith('Unknown report type.', 14, expect.any(Number)); expect(mocks.doc.save).toHaveBeenCalledWith('unknown_2026-01-02.pdf');
});
test('[B3-PDF-09] PDF adapter save failure propagates rather than fabricating download', () => {
  mocks.doc.save.mockImplementation(() => { throw new Error('save unavailable'); }); expect(() => downloadReportAsPdf(fixture('INCIDENT_REPORT'))).toThrow('save unavailable');
});
