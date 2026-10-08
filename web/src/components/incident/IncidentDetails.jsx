import { useEffect, useState } from "react";
import {
  getIncident,
  incidentError,
  incidentTypes,
} from "../../services/incidentApi";
import { Status, time } from "./incidentPresentation";
import PrivateEvidence from "./PrivateEvidence";
import IncidentLocation from "./IncidentLocation";
import IncidentStatusForm from "./IncidentStatusForm";
export default function IncidentDetails({ id, patrolId }) {
  const [incident, setIncident] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, refresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setIncident(null);
    setError("");
    getIncident(id, controller.signal)
      .then((value) => {
        if (active) {
          if (
            patrolId !== undefined &&
            (value.patrolId ?? value.patrol?.id ?? null) !== patrolId
          ) {
            setError("This incident does not belong to the selected patrol.");
          } else setIncident(value);
        }
      })
      .catch((failure) => {
        if (active) setError(incidentError(failure));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [id, patrolId, revision]);
  return (
    <section className="panel incident-details" aria-label="Incident details">
      <div className="panel-heading">
        <h2
          tabIndex={-1}
          ref={(element) => element?.focus({ preventScroll: true })}
        >
          Incident details
        </h2>
      </div>
      {loading && <p role="status">Loading incident details…</p>}
      {error && (
        <div role="alert">
          {error}
          <button
            className="button"
            onClick={() => refresh((value) => value + 1)}
          >
            Retry details
          </button>
        </div>
      )}
      {incident && (
        <>
          <h3>{incident.title || "Untitled report"}</h3>
          <Status incident={incident} />
          <dl className="incident-facts">
            {[
              ["Reference", incident.id],
              [
                "Type",
                incidentTypes[incident.incidentType] || incident.incidentType,
              ],
              ["Reporting Ranger", incident.reporter?.name],
              ["Assigned Ranger", incident.patrol?.ranger?.name],
              ["Patrol", incident.patrol?.routeName],
              ["Park", incident.park?.name],
              ["Occurred", time(incident.occurredAt)],
              ["Created", time(incident.createdAt)],
              ["Updated", time(incident.updatedAt)],
              ...(incident.withdrawnAt
                ? [["Withdrawn", time(incident.withdrawnAt)]]
                : []),
              ...(incident.severity ? [["Severity", incident.severity]] : []),
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || "—"}</dd>
              </div>
            ))}
          </dl>
          <h3>Description</h3>
          <p className="incident-description">{incident.description || "—"}</p>
          <h3>Incident location</h3>
          {incident.manualLocation && (
            <p className="incident-manual-location">
              {incident.manualLocation}
            </p>
          )}
          <IncidentLocation
            latitude={incident.latitude}
            longitude={incident.longitude}
          />
          <h3>Evidence ({incident.evidence?.length || 0})</h3>
          <div className="incident-evidence-grid">
            {incident.evidence?.map((item) => (
              <PrivateEvidence
                key={item.id}
                incidentId={incident.id}
                evidence={item}
              />
            ))}
          </div>
          {!incident.evidence?.length && <p>No evidence attached.</p>}
          <IncidentStatusForm
            incident={incident}
            onSaved={(updated) => setIncident({ ...incident, ...updated })}
          />
        </>
      )}
    </section>
  );
}
