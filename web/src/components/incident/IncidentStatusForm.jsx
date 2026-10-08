import { useEffect, useId, useState } from "react";
import {
  incidentStatuses,
  statusErrorMessage,
  updateIncidentStatus,
} from "../../services/incidentApi";

const OPTIONS = Object.entries(incidentStatuses);

// Park Manager review control. Choosing a value in the select saves it
// immediately; there is no separate save button. The select only proposes one
// of the existing Incident lifecycle values; the server decides whether it may
// be written, and a rejected save reverts the select.
export default function IncidentStatusForm({ incident, onSaved, compact }) {
  const id = useId();
  const [value, setValue] = useState(incident.status || "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  useEffect(() => {
    setValue(incident.status || "");
  }, [incident.id, incident.status]);
  useEffect(() => {
    setFeedback(null);
  }, [incident.id]);
  const withdrawn = Boolean(incident.withdrawnAt || incident.withdrawn);
  const save = async (next) => {
    if (withdrawn || saving || !next || next === incident.status) return;
    setValue(next);
    setSaving(true);
    setFeedback(null);
    try {
      const updated = await updateIncidentStatus(incident.id, next);
      setValue(updated.status || next);
      setFeedback({
        type: "status",
        text: `Status saved as ${incidentStatuses[updated.status] || updated.status}.`,
      });
      onSaved?.(updated);
    } catch (failure) {
      setValue(incident.status || "");
      setFeedback({ type: "alert", text: statusErrorMessage(failure) });
    } finally {
      setSaving(false);
    }
  };
  if (withdrawn && compact) return null;
  if (withdrawn)
    return (
      <p className="incident-status-form muted">
        This report was withdrawn. Its status stays {incidentStatuses[incident.status] || incident.status}{" "}
        and can no longer be changed.
      </p>
    );
  return (
    <div
      className={compact ? "incident-status-form compact" : "incident-status-form"}
    >
      {!compact && <h3>Review status</h3>}
      <div className="incident-status-row">
        {!compact && <label htmlFor={id}>Update incident status</label>}
        <select
          id={id}
          aria-label={
            compact ? `Status for incident ${incident.id}` : undefined
          }
          value={value}
          disabled={saving}
          onChange={(event) => save(event.target.value)}
        >
          {OPTIONS.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        {saving && <span className="muted small">Saving…</span>}
      </div>
      {!compact && !saving && (
        <p className="muted small">Choose a status to save it.</p>
      )}
      {feedback && (
        <p role={feedback.type} className={compact ? "small" : undefined}>
          {feedback.text}
        </p>
      )}
    </div>
  );
}
