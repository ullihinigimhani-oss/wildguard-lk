// Conservation Report Service
// Generates formatted reports for Park Managers using actual database data.
// Reuses existing analytics aggregation logic and repositories.

const analyticsService = require("./analytics.service");
const db = () => require("../config/database");
const { validateReportQuery } = require("../validators/report.validator");

/**
 * Generate an Incident Report
 * Shows incidents within date range with breakdowns by type, status, priority
 */
async function generateIncidentReport(user, query) {
  const filters = validateReportQuery(query);
  
  // Reuse analytics service for aggregated data
  const analytics = await analyticsService.incidents(user, {
    from: filters.from?.toISOString(),
    to: filters.to?.toISOString(),
    period: filters.period,
    area: filters.area,
    type: filters.type,
    status: filters.status,
  });

  // Get detailed incident records for the report
  const where = {
    ...(user?.parkId && { parkId: user.parkId }),
    ...(filters.from && { reportedAt: { gte: filters.from } }),
    ...(filters.to && { reportedAt: { lte: filters.to } }),
    ...(filters.type && { incidentType: filters.type }),
    ...(filters.status && { status: filters.status }),
    ...(filters.area && {
      manualLocation: { contains: filters.area, mode: "insensitive" },
    }),
  };

  const incidents = await db().incident.findMany({
    where,
    select: {
      id: true,
      title: true,
      incidentType: true,
      status: true,
      reportedAt: true,
      occurredAt: true,
      manualLocation: true,
      latitude: true,
      longitude: true,
      reporter: {
        select: {
          name: true,
          role: true,
        },
      },
      patrol: {
        select: {
          routeName: true,
        },
      },
    },
    orderBy: { reportedAt: "desc" },
  });

  return {
    reportType: "INCIDENT_REPORT",
    generatedAt: new Date(),
    generatedBy: {
      name: user.name,
      role: user.role,
    },
    filters: {
      dateFrom: filters.from,
      dateTo: filters.to,
      area: filters.area,
      type: filters.type,
      status: filters.status,
    },
    summary: {
      totalIncidents: analytics.total,
      byType: analytics.byType,
      byStatus: analytics.byStatus,
      trend: analytics.trend,
    },
    incidents: incidents.map((inc) => ({
      id: inc.id,
      title: inc.title || "Untitled Incident",
      type: inc.incidentType,
      status: inc.status,
      reportedAt: inc.reportedAt,
      occurredAt: inc.occurredAt,
      location: inc.manualLocation || 
        (inc.latitude && inc.longitude ? `${inc.latitude}, ${inc.longitude}` : "Unknown"),
      reporterName: inc.reporter?.name || "Unknown",
      reporterRole: inc.reporter?.role || "Unknown",
      patrolRoute: inc.patrol?.routeName || "N/A",
    })),
  };
}

/**
 * Generate a Patrol Operations Report
 * Shows patrol activity and operational metrics
 */
async function generatePatrolReport(user, query) {
  const filters = validateReportQuery(query);

  // Reuse analytics service
  const analytics = await analyticsService.patrols(user, {
    from: filters.from?.toISOString(),
    to: filters.to?.toISOString(),
    period: filters.period,
    area: filters.area,
    type: filters.type,
    status: filters.status,
    priority: filters.priority,
  });

  // Get detailed patrol records
  const where = {
    ...(user?.parkId && { parkId: user.parkId }),
    ...(filters.type && { patrolType: filters.type }),
    ...(filters.status && { status: filters.status }),
    ...(filters.priority && { priority: filters.priority }),
    ...(filters.area && {
      startLocation: { contains: filters.area, mode: "insensitive" },
    }),
  };

  // Apply date range on any of the date columns
  if (filters.from || filters.to) {
    const range = {
      ...(filters.from && { gte: filters.from }),
      ...(filters.to && { lte: filters.to }),
    };
    where.OR = [
      { scheduledDate: range },
      { actualStartTime: range },
      { createdAt: range },
    ];
  }

  const patrols = await db().patrol.findMany({
    where,
    select: {
      id: true,
      routeName: true,
      patrolType: true,
      priority: true,
      status: true,
      scheduledDate: true,
      actualStartTime: true,
      actualEndTime: true,
      startLocation: true,
      ranger: {
        select: {
          name: true,
        },
      },
      createdBy: {
        select: {
          name: true,
        },
      },
      _count: {
        select: {
          waypoints: true,
          incidents: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    reportType: "PATROL_OPERATIONS_REPORT",
    generatedAt: new Date(),
    generatedBy: {
      name: user.name,
      role: user.role,
    },
    filters: {
      dateFrom: filters.from,
      dateTo: filters.to,
      area: filters.area,
      type: filters.type,
      status: filters.status,
      priority: filters.priority,
    },
    summary: {
      totalPatrols: analytics.total,
      byStatus: analytics.byStatus,
      byType: analytics.byType,
      byPriority: analytics.byPriority,
      trend: analytics.trend,
    },
    patrols: patrols.map((patrol) => ({
      id: patrol.id,
      routeName: patrol.routeName,
      type: patrol.patrolType,
      priority: patrol.priority,
      status: patrol.status,
      scheduledDate: patrol.scheduledDate,
      actualStartTime: patrol.actualStartTime,
      actualEndTime: patrol.actualEndTime,
      location: patrol.startLocation || "Unknown",
      rangerName: patrol.ranger?.name || "Unassigned",
      createdBy: patrol.createdBy?.name || "Unknown",
      waypointCount: patrol._count.waypoints,
      incidentCount: patrol._count.incidents,
    })),
  };
}

/**
 * Generate a Human-Wildlife Conflict Trend Report
 * Shows community reports focused on conflicts
 */
async function generateConflictTrendReport(user, query) {
  const filters = validateReportQuery(query);

  // Reuse analytics service
  const analytics = await analyticsService.communityReports(user, {
    from: filters.from?.toISOString(),
    to: filters.to?.toISOString(),
    period: filters.period,
    area: filters.area,
    type: filters.type,
    status: filters.status,
  });

  // Get detailed community report records (do NOT expose reporter identity)
  const where = {
    ...(filters.from && { submittedAt: { gte: filters.from } }),
    ...(filters.to && { submittedAt: { lte: filters.to } }),
    ...(filters.type && { reportType: filters.type }),
    ...(filters.status && { status: filters.status }),
    ...(filters.area && {
      manualLocation: { contains: filters.area, mode: "insensitive" },
    }),
  };

  const reports = await db().communityReport.findMany({
    where,
    select: {
      id: true,
      reportType: true,
      species: true,
      status: true,
      submittedAt: true,
      manualLocation: true,
      latitude: true,
      longitude: true,
      isAnonymous: true,
      // DO NOT include reporterName, reporterPhone, or description
      // These are sensitive community data
    },
    orderBy: { submittedAt: "desc" },
  });

  return {
    reportType: "CONFLICT_TREND_REPORT",
    generatedAt: new Date(),
    generatedBy: {
      name: user.name,
      role: user.role,
    },
    filters: {
      dateFrom: filters.from,
      dateTo: filters.to,
      area: filters.area,
      type: filters.type,
      status: filters.status,
    },
    summary: {
      totalReports: analytics.total,
      conflictReports: analytics.conflictCount,
      byType: analytics.byType,
      byStatus: analytics.byStatus,
      byArea: analytics.byArea,
      trend: analytics.trend,
    },
    reports: reports.map((report) => ({
      id: report.id,
      type: report.reportType,
      species: report.species || "Not specified",
      status: report.status,
      submittedAt: report.submittedAt,
      location: report.manualLocation || 
        (report.latitude && report.longitude ? `${report.latitude}, ${report.longitude}` : "Unknown"),
      isAnonymous: report.isAnonymous,
    })),
  };
}

/**
 * Main report generation function
 * Routes to appropriate report generator based on type
 */
async function generateReport(user, reportType, query) {
  switch (reportType) {
    case "INCIDENT":
      return generateIncidentReport(user, query);
    case "PATROL":
      return generatePatrolReport(user, query);
    case "CONFLICT_TREND":
      return generateConflictTrendReport(user, query);
    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }
}

module.exports = {
  generateReport,
  generateIncidentReport,
  generatePatrolReport,
  generateConflictTrendReport,
};
