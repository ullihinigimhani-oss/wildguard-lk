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

exports.listAllReports = async ({ status, reportType, search, page = 1, pageSize = 20 } = {}) => {
  const where = {
    ...(status && { status }),
    ...(reportType && { reportType }),
  };

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
