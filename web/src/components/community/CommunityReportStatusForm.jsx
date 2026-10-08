import { useEffect, useId, useState } from "react";
import {
  communityReportStatusError,
  reportStatuses,
  updateCommunityReportStatus,
  validTransitions,
} from "../../services/communityReportApi";

const ALL = Object.entries(reportStatuses);

// Park Manager review control. The dropdown proposes the statuses the server
// currently allows for this report, and an explicit Update Status button
// applies the change. The button stays disabled while the selected status is
// unchanged and while a save is processing.
export default function CommunityReportStatusForm({ report, onSaved }) {
  const id = useId();
  const [value, setValue] = useState(report.status || "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  useEffect(() => {
    setValue(report.status || "");
  }, [report.id, report.status]);
  useEffect(() => {
    setFeedback(null);
  }, [report.id]);
  const transitions = validTransitions[report.status] || [];
  const options = transitions.length
    ? [
        [report.status, reportStatuses[report.status] || report.status],
        ...transitions.map((key) => [key, reportStatuses[key]]),
      ]
    : ALL;
  const save = async () => {
    if (saving || !value || value === report.status) return;
    const original = report.status;
    setSaving(true);
    setFeedback(null);
    try {
      const updated = await updateCommunityReportStatus(report.id, value);
      setValue(updated.status || value);
      setFeedback({
        type: "status",
        text: `Report status saved as ${reportStatuses[updated.status] || updated.status}.`,
      });
      onSaved?.(updated);
    } catch (failure) {
      setValue(original);
      setFeedback({ type: "alert", text: communityReportStatusError(failure) });
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="panel">
      <div className="panel-heading">
        <h3>Review status</h3>
      </div>
      <div className="community-status-row">
        <label htmlFor={id}>Update report status</label>
        <select
          id={id}
          value={value}
          disabled={saving}
          onChange={(event) => setValue(event.target.value)}
        >
          {options.map(([key, label]) => (
            <option key={key} value={key} disabled={key === report.status}>
              {label}
            </option>
          ))}
        </select>
        <button
          className="button"
          disabled={saving || value === report.status}
          onClick={save}
        >
          {saving ? "Updating…" : "Update Status"}
        </button>
      </div>
      <p className="muted small">
        Choose only the statuses shown; the server enforces the review
        lifecycle.
      </p>
      {feedback && <p role={feedback.type}>{feedback.text}</p>}
    </section>
  );
}