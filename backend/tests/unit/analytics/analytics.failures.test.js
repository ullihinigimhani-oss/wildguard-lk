jest.mock('../../../src/repositories/analytics.repository', () => ({ findIncidentsForAnalytics: jest.fn(), findPatrolsForAnalytics: jest.fn(), findCommunityReportsForAnalytics: jest.fn() }));
const repo = require('../../../src/repositories/analytics.repository');
const service = require('../../../src/services/analytics.service');
const manager = { id: 'manager', role: 'PARK_MANAGER', parkId: 'park' };
test('B5-ANALYTICS-01 incident query failure propagates without invented totals', async () => { const error = new Error('fixture incident query'); repo.findIncidentsForAnalytics.mockRejectedValue(error); await expect(service.incidents(manager, {})).rejects.toBe(error); });
test('B5-ANALYTICS-02 patrol query failure propagates without invented totals', async () => { const error = new Error('fixture patrol query'); repo.findPatrolsForAnalytics.mockRejectedValue(error); await expect(service.patrols(manager, {})).rejects.toBe(error); });
test('B5-ANALYTICS-03 community query failure propagates without invented totals', async () => { const error = new Error('fixture community query'); repo.findCommunityReportsForAnalytics.mockRejectedValue(error); await expect(service.communityReports(manager, {})).rejects.toBe(error); });
