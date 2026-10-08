import { useEffect, useState } from "react";
import {
  communityReportError,
  getCommunityReport,
  mediaUrl,
  reportStatusClass,
  reportStatuses,
  reportTypes,
} from "../../services/communityReportApi";
import { time } from "../incident/incidentPresentation";
import CommunityReportStatusForm from "./CommunityReportStatusForm";

export default function CommunityReportDetails({ id }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError("");
    getCommunityReport(id, controller.signal)
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((failure) => {
        if (active && !controller.signal.aborted)
          setError(communityReportError(failure));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [id, revision]);

  if (loading) return <p role="status">Loading report…</p>;
  if (error)
    return (
      <div role="alert">
        {error}
        <button
          className="button"
          onClick={() => setRevision((value) => value + 1)}
        >
          Retry report
        </button>
      </div>
    );
  if (!report)
    return <p role="alert">Community report unavailable.</p>;

  const location =
    report.manualLocation ||
    (report.latitude != null && report.longitude != null
      ? `${report.latitude}, ${report.longitude}`
      : "Not recorded");
  return (
    <div className="community-details">
      <section className="panel">
        <div className="panel-heading">
          <h3>{reportTypes[report.reportType] || report.reportType}</h3>
          <span className={`badge ${reportStatusClass[report.status] || ""}`}>
            {reportStatuses[report.status] || report.status}
          </span>
        </div>
        <dl className="community-facts">
          <div>
            <dt>Reference</dt>
            <dd>{report.id}</dd>
          </div>
          <div>
            <dt>Submitted</dt>
            <dd>{time(report.submittedAt)}</dd>
          </div>
          <div>
            <dt>Species</dt>
            <dd>{report.species || "Not recorded"}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{location}</dd>
          </div>
          <div>
            <dt>Reporter</dt>
            <dd>
              {report.isAnonymous
                ? "Anonymous community member"
                : report.reporterName || report.reporter?.name || "Community Member"}
            </dd>
          </div>
          <div>
            <dt>Contact</dt>
            <dd>{report.isAnonymous ? "Withheld" : report.reporterPhone || "Not provided"}</dd>
          </div>
        </dl>
        <h4>Description</h4>
        <p className="community-description">{report.description}</p>
      </section>
      <CommunityReportStatusForm report={report} onSaved={setReport} />
      {report.evidence?.length ? (
        <section className="panel" aria-label="Evidence">
          <div className="panel-heading">
            <h3>Evidence ({report.evidence.length})</h3>
          </div>
          <div className="community-evidence-grid">
            {report.evidence.map((item) => {
              const src = mediaUrl(item.fileUrl);
              const isVideo = String(item.fileType || "").startsWith("video");
              return (
                <div key={item.id} className="community-evidence">
                  {src &&
                    (isVideo ? (
                      <video controls src={src} aria-label={`Evidence video ${item.id}`} />
                    ) : (
                      <img src={src} alt={`Evidence ${item.id}`} />
                    ))}
                  <a href={src} target="_blank" rel="noreferrer">
                    Open evidence <span className="muted small">{item.id}</span>
                  </a>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <p className="muted small">
          No evidence files were attached to this report.
        </p>
      )}
    </div>
  );
}