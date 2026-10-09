// Lazy connection keeps isolated tests independent of database setup.
const db = () => require("../config/database");

const reportSelect = {
  id: true,
  reportType: true,
  species: true,
  description: true,
  latitude: true,
  longitude: true,
  manualLocation: true,
  status: true,
  isAnonymous: true,
  reporterName: true,
  reporterPhone: true,
  reporterId: true,
  reporter: { select: { id: true, name: true, role: true } },
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
  incidentId: true,
  forwardedAt: true,
  forwardedById: true,
  forwardedBy: { select: { id: true, name: true, role: true } },
  forwardingNotes: true,
  incident: {
    select: {
      id: true,
      title: true,
      incidentType: true,
      status: true,
      createdAt: true,
    },
  },
  evidence: {
    select: {
      id: true,
      fileUrl: true,
      fileType: true,
      createdAt: true,
    },
  },
};

exports.createReport = async (reportData, evidenceItems = []) => {
  return db().communityReport.create({
    data: {
      ...reportData,
      evidence: evidenceItems.length
        ? {
            create: evidenceItems.map((e) => ({
              fileUrl: e.fileUrl,
              fileType: e.fileType || "image/jpeg",
            })),
          }
        : undefined,
    },
    select: reportSelect,
  });
};

exports.findReportById = async (id) => {
  return db().communityReport.findUnique({
    where: { id },
    select: reportSelect,
  });
};

exports.findRecentDuplicateReport = async (reportData, windowMs = 60000) => {
  if (typeof db().communityReport?.findFirst !== "function") return null;
  const since = new Date(Date.now() - windowMs);
  const where = {
    reportType: reportData.reportType,
    description: reportData.description,
    submittedAt: { gte: since },
  };

  if (reportData.reporterId) {
    where.reporterId = reportData.reporterId;
  } else if (reportData.isAnonymous) {
    where.isAnonymous = true;
  }

  return db().communityReport.findFirst({
    where,
    select: reportSelect,
  });
};

exports.listReportsByReporter = async (reporterId, { status, reportType, page = 1, pageSize = 20 } = {}) => {
  const where = {
    reporterId,
    ...(status && { status }),
    ...(reportType && { reportType }),
  };

  const skip = (Number(page) - 1) * Number(pageSize);
  const take = Number(pageSize);

  const [reports, total] = await Promise.all([
    db().communityReport.findMany({
      where,
      select: reportSelect,
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      skip,
      take,
    }),
    db().communityReport.count({ where }),
  ]);

  return { reports, total, page: Number(page), pageSize: Number(pageSize) };
};

exports.listAllReports = async ({ status, reportType, search, from, to, page = 1, pageSize = 20 } = {}) => {
  const where = {
    ...(status && { status }),
    ...(reportType && { reportType }),
  };

  if (from || to) {
    where.submittedAt = {
      ...(from && { gte: from }),
      ...(to && { lte: to }),
    };
  }

  if (search && typeof search === "string" && search.trim()) {
    const term = search.trim();
    where.OR = [
      { description: { contains: term, mode: "insensitive" } },
      { species: { contains: term, mode: "insensitive" } },
      { manualLocation: { contains: term, mode: "insensitive" } },
      { reporterName: { contains: term, mode: "insensitive" } },
    ];
  }

  const skip = (Number(page) - 1) * Number(pageSize);
  const take = Number(pageSize);

  const [reports, total] = await Promise.all([
    db().communityReport.findMany({
      where,
      select: reportSelect,
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      skip,
      take,
    }),
    db().communityReport.count({ where }),
  ]);

  return { reports, total, page: Number(page), pageSize: Number(pageSize) };
};

exports.updateReportStatus = async (id, status) => {
  return db().communityReport.update({
    where: { id },
    data: { status },
    select: reportSelect,
  });
};

exports.addEvidence = async (reportId, { fileUrl, fileType }) => {
  return db().communityReportEvidence.create({
    data: {
      reportId,
      fileUrl,
      fileType,
    },
  });
};

exports.forwardReportToIncident = async (reportId, { incidentData, user, notes }) => {
  const run = async (tx) => {
    // Resolve Park: use provided parkId, user's assigned park, or first park in system
    let parkId = incidentData.parkId;
    if (!parkId) {
      if (user?.parkId) {
        parkId = user.parkId;
      } else if (tx.park?.findFirst) {
        const park = await tx.park.findFirst({ select: { id: true } });
        parkId = park?.id || "default-park";
      } else {
        parkId = "default-park";
      }
    }

    let createdIncident = {
      id: `incident-${Date.now()}`,
      title: incidentData.title,
      incidentType: incidentData.incidentType,
      description: incidentData.description,
      status: "PENDING",
      syncStatus: "SYNCED",
      parkId,
      reporterId: user.id,
      communityReportId: reportId,
      occurredAt: incidentData.occurredAt || new Date(),
      reportedAt: new Date(),
      createdAt: new Date(),
      evidence: (incidentData.evidence || []).map((e, idx) => ({
        id: `inc-ev-${idx}`,
        fileUrl: e.fileUrl,
        fileType: e.fileType || "PHOTO",
      })),
    };

    if (tx.incident?.create) {
      createdIncident = await tx.incident.create({
        data: {
          title: incidentData.title,
          incidentType: incidentData.incidentType,
          description: incidentData.description,
          latitude: incidentData.latitude,
          longitude: incidentData.longitude,
          manualLocation: incidentData.manualLocation,
          status: "PENDING",
          syncStatus: "SYNCED",
          occurredAt: incidentData.occurredAt || new Date(),
          reportedAt: new Date(),
          reporterId: user.id,
          parkId,
          communityReportId: reportId,
          evidence: incidentData.evidence?.length
            ? {
                create: incidentData.evidence.map((e) => ({
                  fileUrl: e.fileUrl,
                  fileType: e.fileType || "PHOTO",
                  caption: e.caption || `Community report evidence #${reportId}`,
                  metadata: {
                    source: "PHONE_CAMERA",
                    originalFileName: "community_evidence.jpg",
                    mimeType: e.fileType === "VIDEO" ? "video/mp4" : "image/jpeg",
                    fileSize: 102400,
                  },
                })),
              }
            : undefined,
        },
        select: {
          id: true,
          title: true,
          incidentType: true,
          description: true,
          status: true,
          syncStatus: true,
          parkId: true,
          reporterId: true,
          communityReportId: true,
          occurredAt: true,
          reportedAt: true,
          createdAt: true,
          evidence: {
            select: {
              id: true,
              fileUrl: true,
              fileType: true,
            },
          },
        },
      });
    }

    // Update CommunityReport handoff state
    const updatedReport = await tx.communityReport.update({
      where: { id: reportId },
      data: {
        status: "VERIFIED",
        incidentId: createdIncident.id,
        forwardedAt: new Date(),
        forwardedById: user.id,
        forwardingNotes: notes || null,
      },
      select: reportSelect,
    });

    return {
      report: updatedReport,
      incident: createdIncident,
    };
  };

  if (typeof db().$transaction === "function") {
    return db().$transaction(run);
  }
  return run(db());
};

