import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPatrol, getPatrolTrail } from "../../services/patrolApi";
import RangerTrackMap from "../../components/patrol/RangerTrackMap";
import {
  patrolPriorityLabel,
  patrolStatusLabel,
  patrolTypeLabel,
  priorityBadge,
  statusBadge,
} from "../../constants/patrols";

const POLL_MS = 7000;
// A position is "available" when the newest recorded point is within this age,
// matching the freshness window used by the live monitoring page.
const FRESHNESS_SECONDS = 120;
const formatWhen = (value) =>
  value
    ? new Date(value).toLocaleString([], {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
const gpsState = (location) =>
  !location
    ? "unavailable"
    : Date.now() - new Date(location.recordedAt).getTime() <=
        FRESHNESS_SECONDS * 1000
      ? "recent"
      : "stale";
const GPS_STATES = {
  recent: "Available",
  stale: "Stale",
  unavailable: "Unavailable",
};

export default function RangerTrack() {
  const { id } = useParams();
  const [patrol, setPatrol] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [trail, setTrail] = useState([]);
  const [trailError, setTrailError] = useState("");
  const [pollError, setPollError] = useState("");
  const [refreshedAt, setRefreshedAt] = useState(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    getPatrol(id)
      .then((data) => {
        if (!current) return;
        setPatrol(data);
        setError("");
      })
      .catch((err) => {
        if (!current) return;
        setError(
          err?.response?.status === 404
            ? "Patrol not found."
            : "Unable to load this patrol. Please try again.",
        );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [id, refresh]);

  useEffect(() => {
    if (!patrol) return undefined;
    let current = true;
    let timer;
    let inFlight = null;
    const load = async (background) => {
      if (inFlight) await inFlight.catch(() => {});
      const request = getPatrolTrail(id);
      inFlight = request;
      try {
        const points = await request;
        if (current) {
          setTrail(points);
          setRefreshedAt(new Date());
          setTrailError("");
          setPollError("");
        }
      } catch {
        if (current) {
          if (background)
            setPollError(
              "Unable to refresh the recorded route. Showing the last update; retrying automatically.",
            );
          else setTrailError("Unable to load the recorded route.");
        }
      } finally {
        if (inFlight === request) inFlight = null;
        if (current && patrol.status === "IN_PROGRESS")
          timer = setTimeout(() => load(true), POLL_MS);
      }
    };
    load(false);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [id, patrol, refresh]);

  const current = trail.at(-1) || null;
  const state = gpsState(current);

  return (
    <section className="panel patrol-panel live-monitoring">
      <p>
        <Link to="/patrols">← Back to patrols</Link>
      </p>

      {loading ? (
        <p role="status">Loading patrol route…</p>
      ) : error ? (
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
      ) : (
        <>
          <div className="patrol-list-heading">
            <div>
              <h2>{patrol.routeName}</h2>
              <p className="muted">
                {patrol.status === "IN_PROGRESS"
                  ? `Recording in progress. Positions refresh every ${POLL_MS / 1000} seconds.`
                  : "Saved route history for this patrol."}
              </p>
            </div>
          </div>

          <dl className="live-detail track-meta">
            <div>
              <dt>Ranger</dt>
              <dd>{patrol.ranger?.name || "Unassigned"}</dd>
            </div>
            <div>
              <dt>Park / area</dt>
              <dd>{patrol.park?.name || patrol.startLocation || "—"}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <span className={statusBadge(patrol.status)}>
                  {patrolStatusLabel(patrol.status)}
                </span>
              </dd>
            </div>
            <div>
              <dt>Type / priority</dt>
              <dd>
                {patrolTypeLabel(patrol.patrolType)}{" "}
                <span className={priorityBadge(patrol.priority)}>
                  {patrolPriorityLabel(patrol.priority)}
                </span>
              </dd>
            </div>
            <div>
              <dt>GPS status</dt>
              <dd>
                <span className={"gps-badge gps-" + state}>
                  {GPS_STATES[state]}
                </span>
              </dd>
            </div>
            <div>
              <dt>Last GPS update</dt>
              <dd>{formatWhen(current?.recordedAt)}</dd>
            </div>
          </dl>

          {trailError && (
            <p role="alert" className="field-error">
              {trailError}
            </p>
          )}
          {pollError && (
            <p role="alert" className="field-error">
              {pollError}
            </p>
          )}
          {refreshedAt && !trailError && (
            <p role="status" className="muted live-refreshed">
              Last checked{" "}
              {refreshedAt.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          )}

          <div className="map-container live-map">
            <RangerTrackMap
              key={patrol.id}
              plannedRoute={patrol.plannedRoute}
              trail={trail}
            />
          </div>

          <div className="track-legend">
            <span>
              <span className="legend-swatch planned" aria-hidden="true" />
              Planned route
            </span>
            <span>
              <span className="legend-swatch recorded" aria-hidden="true" />
              Recorded route ({trail.length}{" "}
              {trail.length === 1 ? "point" : "points"})
            </span>
            <span>
              <span className={"gps-badge gps-" + state}>
                {GPS_STATES[state]}
              </span>
            </span>
          </div>

          {trailError && (
            <button
              className="button secondary"
              onClick={() => setRefresh((n) => n + 1)}
            >
              Retry recorded route
            </button>
          )}
          {!trail.length && !trailError && (
            <p className="muted">
              No GPS positions have been recorded for this patrol yet.
            </p>
          )}
        </>
      )}
    </section>
  );
}