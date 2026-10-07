import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPatrol } from "../../services/patrolApi";
import {
  patrolPriorityLabel,
  patrolStatusLabel,
  patrolTypeLabel,
  priorityBadge,
  statusBadge,
} from "../../constants/patrols";
const formatDate = (value) => (value ? String(value).slice(0, 10) : "—");
const formatTime = (value) =>
  value
    ? new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
export default function PatrolDetails() {
  const { id } = useParams();
  const [patrol, setPatrol] = useState(null);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let current = true;
    setState("loading");
    setError("");
    getPatrol(id)
      .then((record) => {
        if (!current) return;
        setPatrol(record);
        setState("ready");
      })
      .catch((failure) => {
        if (!current) return;
        if (failure?.response?.status === 404) {
          setState("missing");
        } else {
          setError("Unable to load this patrol. Please try again.");
          setState("error");
        }
      });
    return () => {
      current = false;
    };
  }, [id, refresh]);
  return (
    <section className="panel patrol-panel">
      <p>
        <Link to="/patrols">← Back to patrols</Link>
      </p>
      {state === "loading" && <p role="status">Loading patrol…</p>}
      {state === "error" && (
        <>
          <p role="alert" className="field-error">
            {error}
          </p>
          <button
            className="button secondary"
            onClick={() => setRefresh((n) => n + 1)}
          >
            Retry
          </button>
        </>
      )}
      {state === "missing" && (
        <>
          <h2>Patrol not found</h2>
          <p role="alert" className="field-error">
            Patrol not found. It may have been removed.
          </p>
        </>
      )}
      {state === "ready" && patrol && (
        <>
          <div className="patrol-details-heading">
            <h2>{patrol.routeName}</h2>
            <span className={statusBadge(patrol.status)}>
              {patrolStatusLabel(patrol.status)}
            </span>
          </div>
          <dl className="patrol-details">
            <div>
              <dt>Patrol title</dt>
              <dd>{patrol.routeName}</dd>
            </div>
            <div>
              <dt>Park / Ranger Area</dt>
              <dd>{patrol.park?.name || "—"}</dd>
            </div>
            <div>
              <dt>Assigned Ranger</dt>
              <dd>
                {patrol.ranger?.name || "—"}
                {patrol.ranger?.email && (
                  <>
                    <br />
                    <span className="small muted">{patrol.ranger.email}</span>
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{formatDate(patrol.scheduledDate)}</dd>
            </div>
            <div>
              <dt>Start time</dt>
              <dd>{formatTime(patrol.startTime)}</dd>
            </div>
            <div>
              <dt>Expected end time</dt>
              <dd>{formatTime(patrol.endTime)}</dd>
            </div>
            <div>
              <dt>Patrol type</dt>
              <dd>{patrolTypeLabel(patrol.patrolType)}</dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>
                <span className={priorityBadge(patrol.priority)}>
                  {patrolPriorityLabel(patrol.priority)}
                </span>
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{patrolStatusLabel(patrol.status)}</dd>
            </div>
            <div>
              <dt>Start location</dt>
              <dd>{patrol.startLocation || "—"}</dd>
            </div>
            <div>
              <dt>Latitude</dt>
              <dd>{patrol.latitude ?? "—"}</dd>
            </div>
            <div>
              <dt>Longitude</dt>
              <dd>{patrol.longitude ?? "—"}</dd>
            </div>
            <div>
              <dt>Instructions / Notes</dt>
              <dd>{patrol.description || "—"}</dd>
            </div>
          </dl>
          <p className="patrol-details-actions">
            <Link className="button primary" to="/patrols/new">
              Create Patrol
            </Link>
          </p>
        </>
      )}
    </section>
  );
}
