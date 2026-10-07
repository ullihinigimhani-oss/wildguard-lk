const { classifyPatrol, localDateKey, scheduleInstant, expectedEnd, delayDuration, matchesFilter, dashboardPatrols } = require('../../../../shared/patrolLifecycle');
const scheduled = (overrides = {}) => ({ id: 'patrol-a', status: 'SCHEDULED', scheduledDate: '2026-10-07T00:00:00Z', startTime: '2026-10-07T08:00:00+05:30', endTime: '2026-10-07T12:00:00+05:30', ...overrides });
const at = time => new Date('2026-10-07T' + time + '+05:30');
test('A: today scheduled assignment can start even before scheduled start', () => {
  expect(classifyPatrol(scheduled(), at('07:00:00'))).toMatchObject({ today: true, overdue: false, badges: ['TODAY'], action: 'Start Patrol' });
});
test('B: future assignment is visible as upcoming', () => {
  const patrol = scheduled({ scheduledDate: '2026-10-10T00:00:00Z', startTime: '2026-10-10T08:00:00+05:30', endTime: '2026-10-10T12:00:00+05:30' });
  expect(classifyPatrol(patrol, at('09:00:00'))).toMatchObject({ upcoming: true, badges: ['UPCOMING'], action: 'View Details' });
  expect(matchesFilter(patrol, 'UPCOMING', at('09:00:00'))).toBe(true);
});
test('C: past unstarted assignment remains actionable', () => {
  expect(classifyPatrol(scheduled(), new Date('2026-10-08T07:00:00+05:30'))).toMatchObject({ today: false, overdue: true, badges: ['OVERDUE'], action: 'Start Patrol' });
});
test('D/E: active assignment preserves workflow status when overdue', () => {
  const patrol = scheduled({ status: 'IN_PROGRESS', actualStartTime: at('09:00:00') });
  expect(classifyPatrol(patrol, at('11:00:00'))).toMatchObject({ badges: ['IN PROGRESS'], action: 'Continue Patrol' });
  expect(classifyPatrol(patrol, at('12:00:01'))).toMatchObject({ badges: ['IN PROGRESS', 'OVERDUE'], action: 'Continue Patrol' });
});
test('F: late completion is historical and excluded from overdue', () => {
  const patrol = scheduled({ status: 'COMPLETED', endTime: at('10:00:00'), actualEndTime: at('11:35:00') });
  expect(classifyPatrol(patrol, at('14:00:00'))).toMatchObject({ badges: ['COMPLETED', 'COMPLETED LATE'], overdue: false, action: 'View Summary', completionText: 'Completed 1h 35m after expected end' });
  expect(matchesFilter(patrol, 'OVERDUE', at('14:00:00'))).toBe(false);
  expect(matchesFilter(patrol, 'COMPLETED', at('14:00:00'))).toBe(true);
});
test.each(['11:45:00', '12:00:00'])('G/H: completion at %s is on time', time => {
  expect(classifyPatrol(scheduled({ status: 'COMPLETED', actualEndTime: at(time) }), at('14:00:00'))).toMatchObject({ badges: ['COMPLETED'], completedLate: false, completionText: 'Completed on time' });
});
test('J/K: nearest future and real overdue counts', () => {
  const next = scheduled({ id: 'next', scheduledDate: '2026-10-10T00:00:00Z', startTime: '2026-10-10T08:00:00+05:30', endTime: '2026-10-10T12:00:00+05:30' });
  const later = { ...next, id: 'later', scheduledDate: '2026-10-11T00:00:00Z', startTime: '2026-10-11T08:00:00+05:30' };
  expect(dashboardPatrols([later, next], at('09:00:00'))).toMatchObject({ selected: next, hasPatrolToday: false, heading: 'NEXT PATROL', overdueCount: 0 });
  expect(dashboardPatrols([scheduled(), scheduled({ id: 'b', status: 'IN_PROGRESS' })], at('13:00:00'))).toMatchObject({ overdueCount: 2, heading: 'ACTIVE PATROL' });
});
test('dashboard priority: active, today, overdue, next; completed never actionable', () => {
  const overdue = scheduled({ id: 'old', scheduledDate: '2026-10-06T00:00:00Z', endTime: '2026-10-06T12:00:00+05:30' });
  const today = scheduled();
  const active = scheduled({ id: 'active', status: 'IN_PROGRESS' });
  expect(dashboardPatrols([overdue, today], at('09:00:00')).selected.id).toBe(today.id);
  expect(dashboardPatrols([overdue, today, active], at('09:00:00')).selected.id).toBe('active');
  expect(dashboardPatrols([scheduled({ status: 'COMPLETED' })], at('09:00:00')).selected).toBeUndefined();
});
test('L: Sri Lankan midnight and schedule instants are independent of host zone', () => {
  expect(localDateKey(new Date('2026-10-07T18:29:59Z'))).toBe('2026-10-07');
  expect(localDateKey(new Date('2026-10-07T18:30:00Z'))).toBe('2026-10-08');
  expect(scheduleInstant('2026-10-08', '00:15').toISOString()).toBe('2026-10-07T18:45:00.000Z');
  const patrol = scheduled({ scheduledDate: '2026-10-08T00:00:00Z', startTime: '2026-10-07T18:45:00Z', endTime: '2026-10-08T06:30:00Z' });
  expect(classifyPatrol(patrol, new Date('2026-10-07T18:30:00Z')).today).toBe(true);
  expect(classifyPatrol(patrol, new Date('2026-10-07T18:29:59Z')).upcoming).toBe(true);
});
test('missing actual completion is not invented; cancelled is not actionable', () => {
  expect(classifyPatrol(scheduled({ status: 'COMPLETED' }), at('14:00:00')).completionText).toBeNull();
  expect(classifyPatrol(scheduled({ status: 'CANCELLED' }), at('14:00:00')).overdue).toBe(false);
  expect(matchesFilter(scheduled({ status: 'CANCELLED' }), 'ALL', at('14:00:00'))).toBe(true);
  expect(dashboardPatrols([scheduled({ status: 'CANCELLED' })], at('14:00:00')).hasPatrolToday).toBe(false);
  expect(classifyPatrol(scheduled({ status: 'COMPLETED', endTime: null, actualEndTime: at('14:00:00') }), at('14:00:00')).completionText).toBeNull();
});
test('date-only legacy patrol deadline is end of local day', () => {
  expect(expectedEnd(scheduled({ startTime: null, endTime: null }))).toBe(new Date('2026-10-08T00:00:00+05:30').getTime());
});
test.each([[10, '10 minutes'], [45, '45 minutes'], [75, '1h 15m'], [120, '2h'], [1560, '1 day 2h'], [0.5, 'less than 1 minute']])('formats %s minutes', (minutes, expected) => {
  expect(delayDuration(minutes * 60000)).toBe(expected);
});
