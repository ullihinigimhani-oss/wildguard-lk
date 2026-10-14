// Report Service Tests
// Tests report generation against deterministic in-memory database fixtures.
jest.mock('../src/config/database', () => require('./fixtures/reportDatabase.cjs').createReportDatabase());
const { FIXED_TIME } = require('./fixtures/reportDatabase.cjs');

const reportService = require("../src/services/report.service");
const db = require("../src/config/database");

describe('Batch 5 report coordinate regressions', () => {
  const manager = { id: 'manager', name: 'Manager', role: 'PARK_MANAGER', parkId: 'park' };
  beforeEach(() => db.resetReportRows());
  test('B5-RPT-01 incident report displays zero coordinates and matching summary', async () => {
    await db.incident.create({ data: { id: 'zero-incident', title: 'Boundary', parkId: 'park', incidentType: 'WILDLIFE_CONFLICT', status: 'PENDING', reportedAt: new Date('2026-01-01Z'), latitude: 0, longitude: 0 } });
    const result = await reportService.generateIncidentReport(manager, {});
    expect(result.incidents).toHaveLength(1);
    expect(result.incidents[0].location).toBe('0, 0');
    expect(result.summary.totalIncidents).toBe(result.incidents.length);
  });
  test('B5-RPT-02 community report displays zero coordinates and matching summary', async () => {
    await db.communityReport.create({ data: { id: 'zero-community', reportType: 'WILDLIFE_SIGHTING', status: 'PENDING', submittedAt: new Date('2026-01-01Z'), latitude: 0, longitude: 0, isAnonymous: true } });
    const result = await reportService.generateConflictTrendReport(manager, {});
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0].location).toBe('0, 0');
    expect(result.summary.totalReports).toBe(result.reports.length);
  });
});

describe('Batch 1 populated report date regressions', () => {
  const user = { id: 'date-manager', name: 'Date Manager', role: 'PARK_MANAGER', parkId: 'date-park' };
  const from = '2026-01-10T00:00:00.000Z', to = '2026-01-20T00:00:00.000Z';
  beforeEach(async () => {
    db.resetReportRows();
    for (const [id, timestamp] of [['before', '2026-01-09'], ['start', '2026-01-10'],
      ['inside', '2026-01-15'], ['end', '2026-01-20'], ['after', '2026-01-21']]) {
      await db.incident.create({ data: { id, title: id, parkId: user.parkId,
        incidentType: 'POACHING_SNARE', status: 'PENDING', reportedAt: new Date(timestamp) } });
      await db.communityReport.create({ data: { id, reportType: 'HUMAN_WILDLIFE_CONFLICT',
        status: 'PENDING', submittedAt: new Date(timestamp), manualLocation: 'Test village' } });
    }
  });
  test.each([
    ['B1-RPT-01', 'generateIncidentReport', 'incident', 'reportedAt', 'incidents', 'totalIncidents'],
    ['B1-RPT-02', 'generateConflictTrendReport', 'communityReport', 'submittedAt', 'reports', 'totalReports'],
  ])('[%s] both date bounds exclude outside rows and include exact boundaries', async (_id, method, model, field, rows, total) => {
    const result = await reportService[method](user, { from, to });
    expect(result[rows].map(row => row.id)).toEqual(['end', 'inside', 'start']);
    expect(result.summary[total]).toBe(3);
    expect(result.summary[total]).toBe(result[rows].length);
    expect(result.filters).toMatchObject({ dateFrom: new Date(from), dateTo: new Date(to) });
    expect(db[model].findMany.mock.calls.at(-1)[0].where[field]).toEqual({ gte: new Date(from), lte: new Date(to) });
  });
  test.each([
    ['B1-RPT-03', 'generateIncidentReport', 'incidents', 'totalIncidents', { from }, ['after', 'end', 'inside', 'start']],
    ['B1-RPT-04', 'generateIncidentReport', 'incidents', 'totalIncidents', { to }, ['end', 'inside', 'start', 'before']],
    ['B1-RPT-05', 'generateConflictTrendReport', 'reports', 'totalReports', { from }, ['after', 'end', 'inside', 'start']],
    ['B1-RPT-06', 'generateConflictTrendReport', 'reports', 'totalReports', { to }, ['end', 'inside', 'start', 'before']],
    ['B1-RPT-07', 'generateIncidentReport', 'incidents', 'totalIncidents', { from, to: from }, ['start']],
    ['B1-RPT-08', 'generateConflictTrendReport', 'reports', 'totalReports', { from, to: from }, ['start']],
  ])('[%s] %s populated one-sided or zero-width range returns matching detail and summary', async (_id, method, rows, total, query, expected) => {
    const result = await reportService[method](user, query);
    expect(result[rows].map(row => row.id)).toEqual(expected);
    expect(result.summary[total]).toBe(expected.length);
  });
});

describe("Report Service", () => {
  let testUser;
  let testPark;
  beforeEach(() => db.resetReportRows());

  beforeAll(async () => {
    // Create test park
    testPark = await db.park.create({
      data: {
        name: "Test National Park",
        location: "Test Location",
      },
    });

    // Create test park manager
    testUser = await db.user.create({
      data: {
        name: "Test Manager",
        email: `test-manager-${FIXED_TIME}@test.com`,
        passwordHash: "test-hash",
        role: "PARK_MANAGER",
        parkId: testPark.id,
        approvalStatus: "APPROVED",
      },
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await db.user.deleteMany({
      where: { email: { contains: "test-manager-" } },
    });
    await db.park.deleteMany({
      where: { name: "Test National Park" },
    });
  });

  describe("generateIncidentReport", () => {
    it("should generate incident report with no data", async () => {
      const query = {
        from: new Date("2025-01-01").toISOString(),
        to: new Date("2025-01-31").toISOString(),
      };

      const report = await reportService.generateIncidentReport(
        testUser,
        query
      );

      expect(report.reportType).toBe("INCIDENT_REPORT");
      expect(report.generatedBy.name).toBe(testUser.name);
      expect(report.summary).toBeDefined();
      expect(report.summary.totalIncidents).toBe(0);
      expect(report.incidents).toEqual([]);
    });

    it("should generate incident report with actual data", async () => {
      // Create test incident
      const ranger = await db.user.create({
        data: {
          name: "Test Ranger",
          email: `test-ranger-${FIXED_TIME}@test.com`,
          passwordHash: "test-hash",
          role: "RANGER",
          parkId: testPark.id,
          approvalStatus: "APPROVED",
        },
      });

      const incident = await db.incident.create({
        data: {
          title: "Test Incident",
          incidentType: "POACHING_SNARE",
          description: "Test incident for report",
          status: "PENDING",
          reportedAt: new Date(FIXED_TIME),
          reporterId: ranger.id,
          parkId: testPark.id,
          manualLocation: "Test Area",
        },
      });

      const query = {
        from: new Date(FIXED_TIME - 86400000).toISOString(),
        to: new Date(FIXED_TIME + 86400000).toISOString(),
      };

      const report = await reportService.generateIncidentReport(
        testUser,
        query
      );

      expect(report.reportType).toBe("INCIDENT_REPORT");
      expect(report.summary.totalIncidents).toBeGreaterThan(0);
      expect(report.summary.byType).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "POACHING_SNARE",
            count: expect.any(Number),
          }),
        ])
      );
      expect(report.incidents.length).toBeGreaterThan(0);
      expect(report.incidents[0]).toMatchObject({
        id: incident.id,
        title: "Test Incident",
        type: "POACHING_SNARE",
        status: "PENDING",
      });

      // Cleanup
      await db.incident.delete({ where: { id: incident.id } });
      await db.user.delete({ where: { id: ranger.id } });
    });

    it("should filter incidents by type", async () => {
      const query = {
        type: "WILDLIFE_CONFLICT",
        from: new Date(FIXED_TIME - 86400000).toISOString(),
        to: new Date(FIXED_TIME + 86400000).toISOString(),
      };

      const report = await reportService.generateIncidentReport(
        testUser,
        query
      );

      expect(report.filters.type).toBe("WILDLIFE_CONFLICT");
      // All incidents should be of type WILDLIFE_CONFLICT if any exist
      report.incidents.forEach((inc) => {
        expect(inc.type).toBe("WILDLIFE_CONFLICT");
      });
    });

    it("should filter incidents by date range", async () => {
      const from = new Date("2025-01-01");
      const to = new Date("2025-01-31");
      const query = {
        from: from.toISOString(),
        to: to.toISOString(),
      };

      const report = await reportService.generateIncidentReport(
        testUser,
        query
      );

      expect(report.filters.dateFrom).toEqual(from);
      expect(report.filters.dateTo).toEqual(to);
      // All incidents should be within date range
      report.incidents.forEach((inc) => {
        const reportedAt = new Date(inc.reportedAt);
        expect(reportedAt >= from && reportedAt <= to).toBe(true);
      });
    });
  });

  describe("generatePatrolReport", () => {
    it("should generate patrol report with no data", async () => {
      const query = {
        from: new Date("2025-01-01").toISOString(),
        to: new Date("2025-01-31").toISOString(),
      };

      const report = await reportService.generatePatrolReport(testUser, query);

      expect(report.reportType).toBe("PATROL_OPERATIONS_REPORT");
      expect(report.generatedBy.name).toBe(testUser.name);
      expect(report.summary).toBeDefined();
      expect(report.summary.totalPatrols).toBe(0);
      expect(report.patrols).toEqual([]);
    });

    it("should generate patrol report with actual data", async () => {
      // Create test patrol
      const ranger = await db.user.create({
        data: {
          name: "Test Ranger 2",
          email: `test-ranger-2-${FIXED_TIME}@test.com`,
          passwordHash: "test-hash",
          role: "RANGER",
          parkId: testPark.id,
          approvalStatus: "APPROVED",
        },
      });

      const patrol = await db.patrol.create({
        data: {
          routeName: "Test Route",
          patrolType: "ROUTINE",
          priority: "MEDIUM",
          status: "SCHEDULED",
          scheduledDate: new Date(FIXED_TIME),
          parkId: testPark.id,
          rangerId: ranger.id,
          createdById: testUser.id,
          startLocation: "Test Start",
        },
      });

      const query = {
        from: new Date(FIXED_TIME - 86400000).toISOString(),
        to: new Date(FIXED_TIME + 86400000).toISOString(),
      };

      const report = await reportService.generatePatrolReport(testUser, query);

      expect(report.reportType).toBe("PATROL_OPERATIONS_REPORT");
      expect(report.summary.totalPatrols).toBeGreaterThan(0);
      expect(report.summary.byType).toBeDefined();
      expect(report.summary.byStatus).toBeDefined();
      expect(report.summary.byPriority).toBeDefined();
      expect(report.patrols.length).toBeGreaterThan(0);

      // Cleanup
      await db.patrol.delete({ where: { id: patrol.id } });
      await db.user.delete({ where: { id: ranger.id } });
    });

    it("should filter patrols by status", async () => {
      const query = {
        status: "COMPLETED",
        from: new Date(FIXED_TIME - 86400000 * 30).toISOString(),
        to: new Date(FIXED_TIME).toISOString(),
      };

      const report = await reportService.generatePatrolReport(testUser, query);

      expect(report.filters.status).toBe("COMPLETED");
      // All patrols should be COMPLETED if any exist
      report.patrols.forEach((patrol) => {
        expect(patrol.status).toBe("COMPLETED");
      });
    });
  });

  describe("generateConflictTrendReport", () => {
    it("should generate conflict report with no data", async () => {
      const query = {
        from: new Date("2025-01-01").toISOString(),
        to: new Date("2025-01-31").toISOString(),
      };

      const report = await reportService.generateConflictTrendReport(
        testUser,
        query
      );

      expect(report.reportType).toBe("CONFLICT_TREND_REPORT");
      expect(report.generatedBy.name).toBe(testUser.name);
      expect(report.summary).toBeDefined();
      expect(report.summary.totalReports).toBe(0);
      expect(report.reports).toEqual([]);
    });

    it("should generate conflict report with actual data", async () => {
      // Create test community report
      const communityReport = await db.communityReport.create({
        data: {
          reportType: "HUMAN_WILDLIFE_CONFLICT",
          species: "Elephant",
          description: "Test conflict report",
          status: "PENDING",
          submittedAt: new Date(FIXED_TIME),
          manualLocation: "Test Village",
          isAnonymous: false,
        },
      });

      const query = {
        from: new Date(FIXED_TIME - 86400000).toISOString(),
        to: new Date(FIXED_TIME + 86400000).toISOString(),
      };

      const report = await reportService.generateConflictTrendReport(
        testUser,
        query
      );

      expect(report.reportType).toBe("CONFLICT_TREND_REPORT");
      expect(report.summary.totalReports).toBeGreaterThan(0);
      expect(report.summary.byType).toBeDefined();
      expect(report.summary.byStatus).toBeDefined();
      expect(report.summary.byArea).toBeDefined();
      expect(report.reports.length).toBeGreaterThan(0);

      // Verify no sensitive data is exposed
      report.reports.forEach((r) => {
        expect(r).not.toHaveProperty("reporterName");
        expect(r).not.toHaveProperty("reporterPhone");
        expect(r).not.toHaveProperty("description");
      });

      // Cleanup
      await db.communityReport.delete({ where: { id: communityReport.id } });
    });

    it("should not expose sensitive community reporter data", async () => {
      const communityReport = await db.communityReport.create({
        data: {
          reportType: "WILDLIFE_SIGHTING",
          species: "Leopard",
          description: "Sensitive description",
          status: "PENDING",
          submittedAt: new Date(FIXED_TIME),
          manualLocation: "Test Area",
          isAnonymous: false,
          reporterName: "Secret Reporter",
          reporterPhone: "0771234567",
        },
      });

      const query = {
        from: new Date(FIXED_TIME - 86400000).toISOString(),
        to: new Date(FIXED_TIME + 86400000).toISOString(),
      };

      const report = await reportService.generateConflictTrendReport(
        testUser,
        query
      );

      const foundReport = report.reports.find(
        (r) => r.id === communityReport.id
      );
      expect(foundReport).toBeDefined();
      expect(foundReport).not.toHaveProperty("reporterName");
      expect(foundReport).not.toHaveProperty("reporterPhone");
      expect(foundReport).not.toHaveProperty("description");

      // Cleanup
      await db.communityReport.delete({ where: { id: communityReport.id } });
    });
  });

  describe("generateReport", () => {
    it("should route to correct report generator", async () => {
      const query = {
        from: new Date("2025-01-01").toISOString(),
        to: new Date("2025-01-31").toISOString(),
      };

      const incidentReport = await reportService.generateReport(
        testUser,
        "INCIDENT",
        query
      );
      expect(incidentReport.reportType).toBe("INCIDENT_REPORT");

      const patrolReport = await reportService.generateReport(
        testUser,
        "PATROL",
        query
      );
      expect(patrolReport.reportType).toBe("PATROL_OPERATIONS_REPORT");

      const conflictReport = await reportService.generateReport(
        testUser,
        "CONFLICT_TREND",
        query
      );
      expect(conflictReport.reportType).toBe("CONFLICT_TREND_REPORT");
    });

    it("should throw error for invalid report type", async () => {
      const query = {
        from: new Date("2025-01-01").toISOString(),
        to: new Date("2025-01-31").toISOString(),
      };

      await expect(
        reportService.generateReport(testUser, "INVALID_TYPE", query)
      ).rejects.toThrow();
    });
  });
});
