import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  downloadReport,
  generateReport,
  reportApiError,
  reportTypeDescriptions,
  reportTypeLabels,
  toSriLankaFrom,
  toSriLankaTo,
} from "../../services/conservationReportApi";
import { downloadReportAsPdf } from "../../utils/reportPdf";
import "./ConservationReports.css";

// ── Constants ─────────────────────────────────────────────────────────────

const REPORT_TYPES = [
  {
    key: "INCIDENT",
    icon: "◇",
    label: reportTypeLabels.INCIDENT,
    description: reportTypeDescriptions.INCIDENT,
    filters: ["type", "status"],
    typeOptions: [
      ["", "All types"],
      ["POACHING_SNARE", "Poaching / Snare"],
      ["ILLEGAL_CAMPSITE", "Illegal Campsite"],
      ["WILDLIFE_CONFLICT", "Wildlife Conflict"],
      ["ANIMAL_CARCASS", "Animal Carcass"],
    ],
    statusOptions: [
      ["", "All statuses"],
      ["PENDING", "Pending"],
      ["UNDER_REVIEW", "Under review"],
      ["RESPONDING", "Responding"],
      ["RESOLVED", "Resolved"],
      ["VERIFIED", "Verified"],
      ["REJECTED", "Rejected"],
    ],
  },
  {
    key: "PATROL",
    icon: "↗",
    label: reportTypeLabels.PATROL,
    description: reportTypeDescriptions.PATROL,
    filters: ["type", "status", "priority"],
    typeOptions: [
      ["", "All types"],
      ["ROUTINE", "Routine"],
      ["ANTI_POACHING", "Anti-Poaching"],
      ["WILDLIFE_MONITORING", "Wildlife Monitoring"],
      ["CONFLICT_RESPONSE", "Conflict Response"],
      ["SPECIAL", "Special"],
    ],
    statusOptions: [
      ["", "All statuses"],
      ["SCHEDULED", "Scheduled"],
      ["IN_PROGRESS", "In Progress"],
      ["COMPLETED", "Completed"],
      ["CANCELLED", "Cancelled"],
    ],
    priorityOptions: [
      ["", "All priorities"],
      ["LOW", "Low"],
      ["MEDIUM", "Medium"],
      ["HIGH", "High"],
    ],
  },
  {
    key: "CONFLICT_TREND",
    icon: "◈",
    label: reportTypeLabels.CONFLICT_TREND,
    description: reportTypeDescriptions.CONFLICT_TREND,
    filters: ["type", "status"],
    typeOptions: [
      ["", "All types"],
      ["WILDLIFE_SIGHTING", "Wildlife Sighting"],
      ["HUMAN_WILDLIFE_CONFLICT", "Human-Wildlife Conflict"],
      ["SUSPICIOUS_ACTIVITY", "Suspicious Activity"],
    ],
    statusOptions: [
      ["", "All statuses"],
      ["PENDING", "Pending"],
      ["UNDER_REVIEW", "Under review"],
      ["VERIFIED", "Verified"],
      ["REJECTED", "Rejected"],
    ],
  },
];

const INITIAL_FILTERS = {
  from: "",
  to: "",
  area: "",
  type: "",
  status: "",
  priority: "",
};

// ── Small helpers ─────────────────────────────────────────────────────────

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d) ? "—" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function BarRow({ label, count, max }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="cr-bar-row">
      <span className="cr-bar-label">{label}</span>
      <div className="cr-bar-track" aria-hidden="true">
        <div className="cr-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="cr-bar-count">{count}</span>
    </div>
  );
}

function TrendMini({ trend }) {
  if (!trend?.length) return null;
  const max = Math.max(...trend.map((t) => t.count), 1);
  return (
    <div className="cr-trend">
      <h4>Trend over period</h4>
      <div className="cr-trend-bars" role="img" aria-label="Trend chart">
        {trend.map((point) => (
          <div key={point.bucket} className="cr-trend-bar-wrap">
            <div
              className="cr-trend-bar"
              title={`${point.label}: ${point.count}`}
              style={{ height: `${Math.round((point.count / max) * 70) + 2}px` }}
            />
            <span className="cr-trend-label">{point.label.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Summary panel depending on report type ────────────────────────────────

function SummaryPanel({ reportData }) {
  const { reportType, summary } = reportData;

  if (reportType === "INCIDENT_REPORT") {
    const total = summary.totalIncidents;
    const byType = summary.byType || [];
    const byStatus = summary.byStatus || [];
    const maxType = byType[0]?.count || 1;
    const maxStatus = byStatus[0]?.count || 1;

    return (
      <>
        <div className="cr-metrics">
          <div className="cr-metric">
            <div className="cr-metric-label">Total Incidents</div>
            <div className="cr-metric-value">{total}</div>
          </div>
          <div className="cr-metric">
            <div className="cr-metric-label">Most Common Type</div>
            <div className="cr-metric-value" style={{ fontSize: 18, paddingTop: 6 }}>
              {byType[0]?.key?.replace(/_/g, " ") || "—"}
            </div>
          </div>
          <div className="cr-metric">
            <div className="cr-metric-label">Resolved</div>
            <div className="cr-metric-value">
              {byStatus.find((s) => s.key === "RESOLVED")?.count ?? 0}
            </div>
          </div>
          <div className="cr-metric">
            <div className="cr-metric-label">Pending / Active</div>
            <div className="cr-metric-value">
              {(byStatus.find((s) => s.key === "PENDING")?.count ?? 0) +
               (byStatus.find((s) => s.key === "RESPONDING")?.count ?? 0) +
               (byStatus.find((s) => s.key === "UNDER_REVIEW")?.count ?? 0)}
            </div>
          </div>
        </div>
        <TrendMini trend={summary.trend} />
        <div className="cr-breakdowns">
          <div className="cr-breakdown">
            <h4>By Incident Type</h4>
            {byType.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>No data</p>
            ) : (
              byType.map((item) => (
                <BarRow key={item.key} label={item.key.replace(/_/g, " ")} count={item.count} max={maxType} />
              ))
            )}
          </div>
          <div className="cr-breakdown">
            <h4>By Status</h4>
            {byStatus.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>No data</p>
            ) : (
              byStatus.map((item) => (
                <BarRow key={item.key} label={item.key.replace(/_/g, " ")} count={item.count} max={maxStatus} />
              ))
            )}
          </div>
        </div>
      </>
    );
  }

  if (reportType === "PATROL_OPERATIONS_REPORT") {
    const total = summary.totalPatrols;
    const byStatus = summary.byStatus || [];
    const byType = summary.byType || [];
    const byPriority = summary.byPriority || [];
    const maxStatus = byStatus[0]?.count || 1;
    const maxType = byType[0]?.count || 1;

    return (
      <>
        <div className="cr-metrics">
          <div className="cr-metric">
            <div className="cr-metric-label">Total Patrols</div>
            <div className="cr-metric-value">{total}</div>
          </div>
          <div className="cr-metric">
            <div className="cr-metric-label">Completed</div>
            <div className="cr-metric-value">
              {byStatus.find((s) => s.key === "COMPLETED")?.count ?? 0}
            </div>
          </div>
          <div className="cr-metric">
            <div className="cr-metric-label">Scheduled</div>
            <div className="cr-metric-value">
              {byStatus.find((s) => s.key === "SCHEDULED")?.count ?? 0}
            </div>
          </div>
          <div className="cr-metric">
            <div className="cr-metric-label">High Priority</div>
            <div className="cr-metric-value">
              {byPriority.find((p) => p.key === "HIGH")?.count ?? 0}
            </div>
          </div>
        </div>
        <TrendMini trend={summary.trend} />
        <div className="cr-breakdowns">
          <div className="cr-breakdown">
            <h4>By Patrol Type</h4>
            {byType.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>No data</p>
            ) : (
              byType.map((item) => (
                <BarRow key={item.key} label={item.key.replace(/_/g, " ")} count={item.count} max={maxType} />
              ))
            )}
          </div>
          <div className="cr-breakdown">
            <h4>By Status</h4>
            {byStatus.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>No data</p>
            ) : (
              byStatus.map((item) => (
                <BarRow key={item.key} label={item.key.replace(/_/g, " ")} count={item.count} max={maxStatus} />
              ))
            )}
          </div>
        </div>
      </>
    );
  }

  if (reportType === "CONFLICT_TREND_REPORT") {
    const total = summary.totalReports;
    const conflict = summary.conflictReports;
    const byType = summary.byType || [];
    const byArea = summary.byArea || [];
    const byStatus = summary.byStatus || [];
    const maxType = byType[0]?.count || 1;
    const maxArea = byArea[0]?.count || 1;

    return (
      <>
        <div className="cr-metrics">
          <div className="cr-metric">
            <div className="cr-metric-label">Total Reports</div>
            <div className="cr-metric-value">{total}</div>
          </div>
          <div className="cr-metric">
            <div className="cr-metric-label">Conflict Reports</div>
            <div className="cr-metric-value">{conflict}</div>
          </div>
          <div className="cr-metric">
            <div className="cr-metric-label">Verified</div>
            <div className="cr-metric-value">
              {byStatus.find((s) => s.key === "VERIFIED")?.count ?? 0}
            </div>
          </div>
          <div className="cr-metric">
            <div className="cr-metric-label">Pending Review</div>
            <div className="cr-metric-value">
              {(byStatus.find((s) => s.key === "PENDING")?.count ?? 0) +
               (byStatus.find((s) => s.key === "UNDER_REVIEW")?.count ?? 0)}
            </div>
          </div>
        </div>
        <TrendMini trend={summary.trend} />
        <div className="cr-breakdowns">
          <div className="cr-breakdown">
            <h4>By Report Type</h4>
            {byType.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>No data</p>
            ) : (
              byType.map((item) => (
                <BarRow key={item.key} label={item.key.replace(/_/g, " ")} count={item.count} max={maxType} />
              ))
            )}
          </div>
          <div className="cr-breakdown">
            <h4>Top Locations</h4>
            {byArea.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>No location data</p>
            ) : (
              byArea.slice(0, 8).map((item) => (
                <BarRow key={item.key} label={item.key} count={item.count} max={maxArea} />
              ))
            )}
          </div>
        </div>
      </>
    );
  }

  return null;
}

// ── Detail records tables ─────────────────────────────────────────────────

function IncidentRecords({ incidents }) {
  if (!incidents?.length)
    return <p className="muted" style={{ padding: "20px 23px", fontSize: 13 }}>No incidents in this period.</p>;
  return (
    <div className="users-table-wrap">
      <table className="users-table">
        <thead>
          <tr>
            {["Title", "Type", "Status", "Reported", "Location", "Reporter"].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {incidents.map((inc) => (
            <tr key={inc.id}>
              <td>
                <strong>{inc.title}</strong>
                <br />
                <span className="small muted">{inc.id.slice(0, 8)}</span>
              </td>
              <td>{inc.type?.replace(/_/g, " ") || "—"}</td>
              <td>
                <span className={`badge badge-${inc.status?.toLowerCase().replace("_", "-")}`}>
                  {inc.status?.replace(/_/g, " ")}
                </span>
              </td>
              <td className="muted" style={{ fontSize: 12 }}>{formatDate(inc.reportedAt)}</td>
              <td style={{ maxWidth: 180, whiteSpace: "normal", fontSize: 12 }}>{inc.location}</td>
              <td style={{ fontSize: 12 }}>
                {inc.reporterName}
                <br />
                <span className="muted">{inc.reporterRole}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PatrolRecords({ patrols }) {
  if (!patrols?.length)
    return <p className="muted" style={{ padding: "20px 23px", fontSize: 13 }}>No patrols in this period.</p>;
  return (
    <div className="users-table-wrap">
      <table className="users-table">
        <thead>
          <tr>
            {["Route", "Type", "Priority", "Status", "Ranger", "Scheduled", "Waypoints", "Incidents"].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {patrols.map((p) => (
            <tr key={p.id}>
              <td>
                <strong>{p.routeName}</strong>
                <br />
                <span className="small muted">{p.id.slice(0, 8)}</span>
              </td>
              <td style={{ fontSize: 12 }}>{p.type?.replace(/_/g, " ") || "—"}</td>
              <td>
                <span className={`badge badge-${p.priority?.toLowerCase()}`}>
                  {p.priority}
                </span>
              </td>
              <td>
                <span className={`badge badge-${p.status?.toLowerCase().replace("_", "-")}`}>
                  {p.status?.replace(/_/g, " ")}
                </span>
              </td>
              <td style={{ fontSize: 12 }}>{p.rangerName}</td>
              <td className="muted" style={{ fontSize: 12 }}>{formatDate(p.scheduledDate)}</td>
              <td style={{ textAlign: "right" }}>{p.waypointCount}</td>
              <td style={{ textAlign: "right" }}>{p.incidentCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConflictRecords({ reports }) {
  if (!reports?.length)
    return <p className="muted" style={{ padding: "20px 23px", fontSize: 13 }}>No reports in this period.</p>;
  return (
    <div className="users-table-wrap">
      <table className="users-table">
        <thead>
          <tr>
            {["Type", "Species", "Status", "Submitted", "Location", "Anonymous"].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.id}>
              <td style={{ fontSize: 12 }}>{r.type?.replace(/_/g, " ") || "—"}</td>
              <td style={{ fontSize: 12 }}>{r.species}</td>
              <td>
                <span className={`badge badge-${r.status?.toLowerCase().replace("_", "-")}`}>
                  {r.status?.replace(/_/g, " ")}
                </span>
              </td>
              <td className="muted" style={{ fontSize: 12 }}>{formatDate(r.submittedAt)}</td>
              <td style={{ maxWidth: 200, whiteSpace: "normal", fontSize: 12 }}>{r.location}</td>
              <td style={{ fontSize: 12 }}>{r.isAnonymous ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function ConservationReports() {
  const { user } = useAuth();
  const authorized = user?.role === "PARK_MANAGER" && user?.approvalStatus === "APPROVED";

  const [selectedType, setSelectedType] = useState(null);  // REPORT_TYPES[i]
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [downloading, setDownloading] = useState("");  // "CSV" | "PDF" | ""
  const [downloadError, setDownloadError] = useState("");

  const controllerRef = useRef(null);

  const update = (patch) => setFilters((f) => ({ ...f, ...patch }));

  // When the selected report type changes, clear the previous result and
  // reset type/status/priority filters (dates and area persist).
  function selectType(typeObj) {
    setSelectedType(typeObj);
    setReportData(null);
    setError("");
    setFilters((f) => ({ ...f, type: "", status: "", priority: "" }));
  }

  // ── Generate ────────────────────────────────────────────────────────────
  const generate = useCallback(async () => {
    if (!selectedType) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError("");
    setReportData(null);

    try {
      const data = await generateReport(
        {
          reportType: selectedType.key,
          from: toSriLankaFrom(filters.from),
          to: toSriLankaTo(filters.to),
          area: filters.area || undefined,
          type: filters.type || undefined,
          status: filters.status || undefined,
          priority: filters.priority || undefined,
        },
        controller.signal
      );
      setReportData(data);
    } catch (err) {
      if (err.name !== "CanceledError" && err.name !== "AbortError") {
        setError(reportApiError(err));
      }
    } finally {
      setLoading(false);
    }
  }, [selectedType, filters]);

  // Abort in-flight request on unmount
  useEffect(() => () => controllerRef.current?.abort(), []);

  // ── Download ────────────────────────────────────────────────────────────
  async function download(format) {
    if (!selectedType) return;
    setDownloading(format);
    setDownloadError("");
    try {
      if (format === "PDF") {
        // Generate from data already in state — no server round-trip needed.
        downloadReportAsPdf(reportData);
      } else {
        await downloadReport(
          {
            reportType: selectedType.key,
            from: toSriLankaFrom(filters.from),
            to: toSriLankaTo(filters.to),
            area: filters.area || undefined,
            type: filters.type || undefined,
            status: filters.status || undefined,
            priority: filters.priority || undefined,
          },
          format
        );
      }
    } catch (err) {
      setDownloadError(
        format === "PDF"
          ? "PDF generation failed. Try downloading the CSV instead."
          : reportApiError(err)
      );
    } finally {
      setDownloading("");
    }
  }

  // ── Detail records section ──────────────────────────────────────────────
  function DetailRecords() {
    if (!reportData) return null;
    const { reportType, incidents, patrols, reports } = reportData;
    if (reportType === "INCIDENT_REPORT")
      return (
        <div className="cr-records">
          <div className="cr-records-heading">
            <h4>Incident records</h4>
            <span>{incidents?.length ?? 0} records</span>
          </div>
          <IncidentRecords incidents={incidents} />
        </div>
      );
    if (reportType === "PATROL_OPERATIONS_REPORT")
      return (
        <div className="cr-records">
          <div className="cr-records-heading">
            <h4>Patrol records</h4>
            <span>{patrols?.length ?? 0} records</span>
          </div>
          <PatrolRecords patrols={patrols} />
        </div>
      );
    if (reportType === "CONFLICT_TREND_REPORT")
      return (
        <div className="cr-records">
          <div className="cr-records-heading">
            <h4>Community report records</h4>
            <span>{reports?.length ?? 0} records</span>
          </div>
          <ConflictRecords reports={reports} />
        </div>
      );
    return null;
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (!authorized) {
    return (
      <div className="panel">
        <div className="cr-state">
          <span className="cr-state-icon">◈</span>
          <h3>Conservation Reports</h3>
          <p>This section is available to approved Park Managers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cr-page">
      {/* ── Page header ── */}
      <div className="cr-heading">
        <div>
          <h2>Conservation Reports</h2>
          <p>
            Generate and download operational reports for your park — incidents,
            patrol coverage, and human-wildlife conflict trends.
          </p>
        </div>
      </div>

      {/* ── Step 1: Select report type ── */}
      <section className="panel" aria-labelledby="cr-step1-heading">
        <div className="panel-heading">
          <div>
            <h3 id="cr-step1-heading">1. Select report type</h3>
            <p>Choose the type of conservation report to generate</p>
          </div>
        </div>
        <div className="cr-type-grid" style={{ padding: "4px 23px 20px" }}>
          {REPORT_TYPES.map((type) => (
            <button
              key={type.key}
              className={`cr-type-card${selectedType?.key === type.key ? " selected" : ""}`}
              onClick={() => selectType(type)}
              aria-pressed={selectedType?.key === type.key}
            >
              <span className="cr-type-icon">{type.icon}</span>
              <h3>{type.label}</h3>
              <p>{type.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ── Step 2: Set filters ── */}
      {selectedType && (
        <section className="panel" aria-labelledby="cr-step2-heading">
          <div className="panel-heading">
            <div>
              <h3 id="cr-step2-heading">2. Set date range &amp; filters</h3>
              <p>Leave dates empty to include all available data</p>
            </div>
          </div>

          <div className="cr-filters">
            <label>
              From
              <input
                type="date"
                value={filters.from}
                max={filters.to || undefined}
                onChange={(e) => update({ from: e.target.value })}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={filters.to}
                min={filters.from || undefined}
                onChange={(e) => update({ to: e.target.value })}
              />
            </label>
            <label>
              Area / Location
              <input
                type="text"
                value={filters.area}
                placeholder="e.g. Block 10"
                maxLength={120}
                onChange={(e) => update({ area: e.target.value })}
              />
            </label>

            {selectedType.filters.includes("type") && (
              <label>
                {selectedType.key === "CONFLICT_TREND" ? "Report type" : "Type"}
                <select value={filters.type} onChange={(e) => update({ type: e.target.value })}>
                  {selectedType.typeOptions.map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </select>
              </label>
            )}

            {selectedType.filters.includes("status") && (
              <label>
                Status
                <select value={filters.status} onChange={(e) => update({ status: e.target.value })}>
                  {selectedType.statusOptions.map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </select>
              </label>
            )}

            {selectedType.filters.includes("priority") && (
              <label>
                Priority
                <select value={filters.priority} onChange={(e) => update({ priority: e.target.value })}>
                  {(selectedType.priorityOptions || []).map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </select>
              </label>
            )}

            <div className="cr-filters-actions">
              {(filters.from || filters.to || filters.area || filters.type || filters.status || filters.priority) && (
                <button
                  className="button secondary"
                  onClick={() => {
                    setFilters(INITIAL_FILTERS);
                    setReportData(null);
                    setError("");
                  }}
                >
                  Clear
                </button>
              )}
              <button
                className="button primary"
                onClick={generate}
                disabled={loading}
              >
                {loading ? "Generating…" : "Generate Report"}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="field-error" style={{ padding: "12px 23px 0", margin: 0 }}>
              {error}
            </p>
          )}
        </section>
      )}

      {/* ── Step 3: Report preview & export ── */}
      {loading && (
        <div className="panel">
          <div className="cr-state">
            <span className="cr-state-icon" aria-hidden="true">◌</span>
            <h3>Generating report…</h3>
            <p>Querying database for {selectedType?.label}</p>
          </div>
        </div>
      )}

      {!loading && reportData && (
        <section className="panel" aria-labelledby="cr-step3-heading">
          <div className="panel-heading">
            <div>
              <h3 id="cr-step3-heading">
                {selectedType?.label}
              </h3>
              <p>
                {reportData.filters.dateFrom
                  ? `${formatDate(reportData.filters.dateFrom)} – ${formatDate(reportData.filters.dateTo)}`
                  : "All time"}
                {reportData.filters.area ? ` · ${reportData.filters.area}` : ""}
                {reportData.filters.type ? ` · ${reportData.filters.type.replace(/_/g, " ")}` : ""}
                {reportData.filters.status ? ` · ${reportData.filters.status.replace(/_/g, " ")}` : ""}
                {" · Generated "}
                {formatDate(reportData.generatedAt)}
              </p>
            </div>
          </div>

          <SummaryPanel reportData={reportData} />

          <DetailRecords />

          {/* Export bar */}
          <div className="cr-export-bar">
            <p>Download a copy of this report</p>
            {downloadError && (
              <p role="alert" className="field-error" style={{ margin: 0 }}>
                {downloadError}
              </p>
            )}
            <div className="cr-export-buttons">
              <button
                className="button secondary"
                onClick={() => download("CSV")}
                disabled={!!downloading}
                aria-busy={downloading === "CSV"}
              >
                {downloading === "CSV" ? "Preparing…" : "⬇ Download CSV"}
              </button>
              <button
                className="button primary"
                onClick={() => download("PDF")}
                disabled={!!downloading}
                aria-busy={downloading === "PDF"}
              >
                {downloading === "PDF" ? "Preparing…" : "⬇ Download PDF"}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Idle state (type selected but not generated yet) ── */}
      {!loading && !reportData && selectedType && !error && (
        <div className="panel">
          <div className="cr-state">
            <span className="cr-state-icon" aria-hidden="true">{selectedType.icon}</span>
            <h3>{selectedType.label}</h3>
            <p>Set your filters above and click <strong>Generate Report</strong> to preview data before downloading.</p>
          </div>
        </div>
      )}

      {/* ── No type selected yet ── */}
      {!selectedType && (
        <div className="panel">
          <div className="cr-state">
            <span className="cr-state-icon" aria-hidden="true">◈</span>
            <h3>Select a report type to get started</h3>
            <p>Choose from Incident, Patrol Operations, or Conflict Trend reports above.</p>
          </div>
        </div>
      )}
    </div>
  );
}
