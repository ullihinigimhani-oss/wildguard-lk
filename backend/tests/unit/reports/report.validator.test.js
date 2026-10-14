const { validateReportQuery: query, validateReportType: type, validateExportFormat: format } = require('../../../src/validators/report.validator');
test('B5-RVAL-01 equal absolute date boundaries accepted', () => { const result = query({ from: '2026-01-01T05:30:00+05:30', to: '2026-01-01T00:00:00Z' }); expect(result.from).toEqual(new Date('2026-01-01T00:00:00Z')); expect(result.to).toEqual(result.from); });
test('B5-RVAL-02 reversed dates rejected', () => expect(() => query({ from: '2026-01-02', to: '2026-01-01' })).toThrow());
test('B5-RVAL-03 malformed dates rejected', () => expect(() => query({ from: 'invalid' })).toThrow());
test('B5-RVAL-04 query normalizes area and filters with default month period', () => expect(query({ area: ' Gate ', type: 'wildlife_conflict', status: 'pending', priority: 'high' })).toMatchObject({ area: 'Gate', type: 'WILDLIFE_CONFLICT', status: 'PENDING', priority: 'HIGH', period: 'month' }));
test('B5-RVAL-05 unsupported report type and export format rejected', () => { expect(() => type('UNKNOWN')).toThrow(); expect(() => format('XML')).toThrow(); });
test('B5-RVAL-06 accepted report and format normalize case', () => { expect(type('incident')).toBe('INCIDENT'); expect(format('csv')).toBe('CSV'); expect(format()).toBe('JSON'); });
