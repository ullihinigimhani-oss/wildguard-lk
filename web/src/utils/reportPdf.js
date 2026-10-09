// Conservation Report — PDF generator
// Uses jsPDF + jsPDF-AutoTable to produce a real .pdf file entirely in the
// browser from the report data already held in React state.
// No extra server round-trip; auth headers are not needed.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── Brand colours ─────────────────────────────────────────────────────────
const GREEN      = [36, 92, 69];   // #245c45
const GREEN_DARK = [21, 63, 51];   // #153f33
const GREY_LIGHT = [245, 247, 244]; // #f5f7f4
const GREY_MID   = [103, 117, 109]; // #67756d
const WHITE      = [255, 255, 255];
const BORDER     = [227, 232, 226]; // #e3e8e2

// ── Helpers ───────────────────────────────────────────────────────────────

function fmt(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function clean(value) {
  if (value === null || value === undefined) return "—";
  return String(value).replace(/_/g, " ");
}

// Draws a labelled metric box. Returns the Y position after the box.
function metricBox(doc, x, y, w, label, value) {
  doc.setFillColor(...GREY_LIGHT);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(x, y, w, 22, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...GREY_MID);
  doc.text(label.toUpperCase(), x + 5, y + 7);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...GREEN);
  doc.text(String(value), x + 5, y + 17);

  return y + 22;
}

// Four metric boxes in a row across the page width.
function metricsRow(doc, metrics, startY) {
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const totalW = pageW - margin * 2;
  const boxW = (totalW - 9) / 4; // 3 gaps of 3 px each

  metrics.forEach(([label, value], i) => {
    metricBox(doc, margin + i * (boxW + 3), startY, boxW, label, value);
  });
  return startY + 28;
}

// Section heading — small green bar + bold label.
function sectionHeading(doc, text, y) {
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...GREEN);
  doc.rect(margin, y, pageW - margin * 2, 0.8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...GREEN_DARK);
  doc.text(text, margin, y + 6);
  return y + 10;
}

// Auto-wrap to new page if `neededHeight` does not fit.
function checkPage(doc, currentY, neededHeight = 20) {
  const pageH = doc.internal.pageSize.getHeight();
  if (currentY + neededHeight > pageH - 18) {
    doc.addPage();
    return 18;
  }
  return currentY;
}

// ── Cover / header block ──────────────────────────────────────────────────

function drawHeader(doc, reportData, reportLabel) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Green header band
  doc.setFillColor(...GREEN_DARK);
  doc.rect(0, 0, pageW, 36, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...WHITE);
  doc.text("WildGuard LK", margin, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 210, 195);
  doc.text("Conservation Management System", margin, 21);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.text(reportLabel, margin, 31);

  // Meta line below header
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GREY_MID);
  const generatedBy = `${reportData.generatedBy.name}  ·  Generated ${fmt(reportData.generatedAt)}`;
  doc.text(generatedBy, margin, 42);

  // Filters summary
  const f = reportData.filters;
  const filterParts = [
    f.dateFrom ? `From: ${fmt(f.dateFrom)}` : null,
    f.dateTo   ? `To: ${fmt(f.dateTo)}`     : null,
    f.area     ? `Area: ${f.area}`           : null,
    f.type     ? `Type: ${clean(f.type)}`    : null,
    f.status   ? `Status: ${clean(f.status)}` : null,
    f.priority ? `Priority: ${clean(f.priority)}` : null,
  ].filter(Boolean);

  if (filterParts.length) {
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY_MID);
    doc.text("Filters: " + filterParts.join("  ·  "), margin, 48);
    return 54;
  }
  return 50;
}

// ── Breakdown bar table (by type / status / etc.) ─────────────────────────
// Rendered as an autoTable with a thin inline bar drawn in each cell.

function breakdownTable(doc, title, items, startY) {
  if (!items?.length) return startY;

  let y = checkPage(doc, startY, 30);
  y = sectionHeading(doc, title, y);

  const max = items[0].count;
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Category", "Count", ""]],
    body: items.map((item) => [
      clean(item.key),
      item.count,
      "", // bar column — drawn via didDrawCell
    ]),
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [36, 59, 50],
    },
    headStyles: {
      fillColor: GREEN_DARK,
      textColor: WHITE,
      fontStyle: "bold",
      fontSize: 7.5,
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 18, halign: "right" },
      2: { cellWidth: pageW - margin * 2 - 70 - 18 },
    },
    alternateRowStyles: { fillColor: GREY_LIGHT },
    didDrawCell(data) {
      if (data.section === "body" && data.column.index === 2) {
        const count = items[data.row.index].count;
        const pct = max > 0 ? count / max : 0;
        const trackX = data.cell.x + 3;
        const trackY = data.cell.y + data.cell.height / 2 - 2;
        const trackW = data.cell.width - 6;
        const trackH = 4;

        doc.setFillColor(...BORDER);
        doc.roundedRect(trackX, trackY, trackW, trackH, 1, 1, "F");

        if (pct > 0) {
          doc.setFillColor(...GREEN);
          doc.roundedRect(trackX, trackY, trackW * pct, trackH, 1, 1, "F");
        }
      }
    },
  });

  return doc.lastAutoTable.finalY + 6;
}

// ── Records table ─────────────────────────────────────────────────────────

function recordsTable(doc, title, head, rows, startY) {
  if (!rows?.length) return startY;

  let y = checkPage(doc, startY, 30);
  y = sectionHeading(doc, title, y);

  const margin = 14;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [head],
    body: rows,
    styles: {
      fontSize: 7.5,
      cellPadding: 2.5,
      overflow: "linebreak",
      textColor: [36, 59, 50],
    },
    headStyles: {
      fillColor: GREEN_DARK,
      textColor: WHITE,
      fontStyle: "bold",
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: GREY_LIGHT },
    didDrawPage(data) {
      // Repeat header text on continuation pages
      doc.setFontSize(7);
      doc.setTextColor(...GREY_MID);
      doc.text(
        `WildGuard — ${title}  (continued)`,
        data.settings.margin.left,
        10
      );
    },
  });

  return doc.lastAutoTable.finalY + 6;
}

// ── Report-type specific builders ─────────────────────────────────────────

function buildIncidentPdf(doc, reportData, startY) {
  const { summary, incidents } = reportData;
  const byType   = summary.byType   || [];
  const byStatus = summary.byStatus || [];

  let y = metricsRow(doc, [
    ["Total Incidents",   summary.totalIncidents],
    ["Resolved",          byStatus.find((s) => s.key === "RESOLVED")?.count ?? 0],
    ["Pending / Active",  (byStatus.find((s) => s.key === "PENDING")?.count ?? 0) +
                          (byStatus.find((s) => s.key === "RESPONDING")?.count ?? 0) +
                          (byStatus.find((s) => s.key === "UNDER_REVIEW")?.count ?? 0)],
    ["Types",             byType.length],
  ], startY);

  y = breakdownTable(doc, "Incidents by Type",   byType,   y);
  y = breakdownTable(doc, "Incidents by Status", byStatus, y);

  y = recordsTable(
    doc,
    "Incident Records",
    ["Title", "Type", "Status", "Reported", "Location", "Reporter"],
    (incidents || []).map((inc) => [
      inc.title || "—",
      clean(inc.type),
      clean(inc.status),
      fmt(inc.reportedAt),
      inc.location || "—",
      inc.reporterName || "—",
    ]),
    y
  );

  return y;
}

function buildPatrolPdf(doc, reportData, startY) {
  const { summary, patrols } = reportData;
  const byStatus   = summary.byStatus   || [];
  const byType     = summary.byType     || [];
  const byPriority = summary.byPriority || [];

  let y = metricsRow(doc, [
    ["Total Patrols", summary.totalPatrols],
    ["Completed",     byStatus.find((s) => s.key === "COMPLETED")?.count ?? 0],
    ["Scheduled",     byStatus.find((s) => s.key === "SCHEDULED")?.count ?? 0],
    ["High Priority", byPriority.find((p) => p.key === "HIGH")?.count ?? 0],
  ], startY);

  y = breakdownTable(doc, "Patrols by Type",     byType,     y);
  y = breakdownTable(doc, "Patrols by Status",   byStatus,   y);
  y = breakdownTable(doc, "Patrols by Priority", byPriority, y);

  y = recordsTable(
    doc,
    "Patrol Records",
    ["Route", "Type", "Priority", "Status", "Ranger", "Scheduled", "Waypoints", "Incidents"],
    (patrols || []).map((p) => [
      p.routeName || "—",
      clean(p.type),
      clean(p.priority),
      clean(p.status),
      p.rangerName || "—",
      fmt(p.scheduledDate),
      String(p.waypointCount ?? 0),
      String(p.incidentCount ?? 0),
    ]),
    y
  );

  return y;
}

function buildConflictPdf(doc, reportData, startY) {
  const { summary, reports } = reportData;
  const byType   = summary.byType   || [];
  const byStatus = summary.byStatus || [];
  const byArea   = summary.byArea   || [];

  let y = metricsRow(doc, [
    ["Total Reports",   summary.totalReports],
    ["Conflict Reports", summary.conflictReports],
    ["Verified",        byStatus.find((s) => s.key === "VERIFIED")?.count ?? 0],
    ["Pending Review",  (byStatus.find((s) => s.key === "PENDING")?.count ?? 0) +
                        (byStatus.find((s) => s.key === "UNDER_REVIEW")?.count ?? 0)],
  ], startY);

  y = breakdownTable(doc, "Reports by Type",      byType,   y);
  y = breakdownTable(doc, "Reports by Status",    byStatus, y);
  y = breakdownTable(doc, "Reports by Location",  byArea,   y);

  y = recordsTable(
    doc,
    "Community Report Records",
    ["Type", "Species", "Status", "Submitted", "Location", "Anonymous"],
    (reports || []).map((r) => [
      clean(r.type),
      r.species || "—",
      clean(r.status),
      fmt(r.submittedAt),
      r.location || "—",
      r.isAnonymous ? "Yes" : "No",
    ]),
    y
  );

  return y;
}

// ── Footer on every page ──────────────────────────────────────────────────

function addFooters(doc) {
  const totalPages = doc.internal.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BORDER);
    doc.line(14, pageH - 12, pageW - 14, pageH - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...GREY_MID);
    doc.text("WildGuard LK  ·  Conservation Management System", 14, pageH - 7);
    doc.text(`Page ${i} of ${totalPages}`, pageW - 14, pageH - 7, { align: "right" });
  }
}

// ── Public entry point ────────────────────────────────────────────────────

const REPORT_LABELS = {
  INCIDENT_REPORT:           "Incident Report",
  PATROL_OPERATIONS_REPORT:  "Patrol Operations Report",
  CONFLICT_TREND_REPORT:     "Human-Wildlife Conflict Trend Report",
};

/**
 * Generate and immediately download a PDF for the given report data object.
 * This is called from the React page with the data already in state.
 *
 * @param {object} reportData – the object returned by generateReport() API call
 */
export function downloadReportAsPdf(reportData) {
  const label = REPORT_LABELS[reportData.reportType] || "Conservation Report";

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  let y = drawHeader(doc, reportData, label);

  switch (reportData.reportType) {
    case "INCIDENT_REPORT":
      buildIncidentPdf(doc, reportData, y);
      break;
    case "PATROL_OPERATIONS_REPORT":
      buildPatrolPdf(doc, reportData, y);
      break;
    case "CONFLICT_TREND_REPORT":
      buildConflictPdf(doc, reportData, y);
      break;
    default:
      doc.text("Unknown report type.", 14, y + 10);
  }

  addFooters(doc);

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `${reportData.reportType.toLowerCase()}_${dateStr}.pdf`;
  doc.save(filename);
}
