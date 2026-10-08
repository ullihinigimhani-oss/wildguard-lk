import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getPatrolTrail, listLiveRangers } from "../../services/patrolApi";
import LiveRangerMap from "../../components/patrol/LiveRangerMap";
import {
  patrolPriorityLabel,
  patrolStatusLabel,
  patrolTypeLabel,
  priorityBadge,
  statusBadge,
} from "../../constants/patrols";

const POLL_MS = 7000;
const GPS_STATES = {
  recent: "Available",
  stale: "Stale",
  unavailable: "Unavailable",
};
const gpsState = (location, freshnessSeconds) => {
  if (!location) return "unavailable";
  return Date.now() - new Date(location.recordedAt).getTime() <=
    freshnessSeconds * 1000
    ? "recent"
    : "stale";
};
const formatWhen = (value) =>
  value
    ? new Date(value).toLocaleString([], {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export default function RangerMonitoring() {
  const [data, setData] = useState({ rangers: [], freshnessSeconds: 120 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pollError, setPollError] = useState("");
  const [refreshedAt, setRefreshedAt] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [gpsFilter, setGpsFilter] = useState("all");
  const [trails, setTrails] = useState({});
  const [trailLoading, setTrailLoading] = useState(false);
  const [showTrail, setShowTrail] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const requestedTrails = useRef(new Set());

  useEffect(() => {
    let current = true;
    let timer;
    let inFlight = null;
    const load = async (background) => {
      if (inFlight) await inFlight.catch(() => {});
      const request = listLiveRangers();
      inFlight = request;
      try {
        const live = await request;
        if (current) {
          setData(live);
          setRefreshedAt(new Date());
          setError("");
          setPollError("");
        }
      } catch {
        if (current) {
          if (background)
            setPollError(
              "Unable to refresh Ranger positions. Showing the last update; retrying automatically.",
            );
          else setError("Unable to load Ranger positions. Please try again.");
        }
      } finally {
        if (inFlight === request) inFlight = null;
        if (current) {
          setLoading(false);
          timer = setTimeout(() => load(true), POLL_MS);
        }
      }
    };
    load(false);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [refresh]);

  useEffect(() => {
    if (!selectedId || requestedTrails.current.has(selectedId)) return;
    requestedTrails.current.add(selectedId);
    let current = true;
    setTrailLoading(true);
    getPatrolTrail(selectedId)
      .then((points) => {
        if (current) setTrails((prev) => ({ ...prev, [selectedId]: points }));
      })
      .catch(() => {
        if (current) setTrails((prev) => ({ ...prev, [selectedId]: null }));
      })
      .finally(() => {
        if (current) setTrailLoading(false);
      });
    return () => {
      current = false;
    };
  }, [selectedId]);

  const selected = data.rangers.find((ranger) => ranger.patrolId === selectedId);
  const stats = useMemo(() => {
    let recent = 0;
    let stale = 0;
    let unavailable = 0;
    data.rangers.forEach((ranger) => {
      const state = gpsState(ranger.location, data.freshnessSeconds);
      if (state === "recent") recent += 1;
      else if (state === "stale") stale += 1;
      else unavailable += 1;
    });
    return { recent, staleOrUnavailable: stale + unavailable };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const needle = query.trim().toLowerCase();
  const visible = data.rangers.filter((ranger) => {
    if (gpsFilter !== "all") {
      const state = gpsState(ranger.location, data.freshnessSeconds);
      if (gpsFilter === "available" && state !== "recent") return false;
      if (gpsFilter === "stale" && state !== "stale") return false;
      if (gpsFilter === "unavailable" && state !== "unavailable") return false;
    }
    if (!needle) return true;
    return [ranger.ranger?.name, ranger.ranger?.id, ranger.routeName, ranger.park?.name]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(needle));
  });

  return (
    <section className="panel patrol-panel live-monitoring">
      <div className="patrol-list-heading">
        <div>
          <h2>Live Ranger Monitoring</h2>
          <p className="muted">
            Positions refresh automatically every {POLL_MS / 1000} seconds.
            Timestamps show the last GPS update received from each Ranger.
          </p>
        </div>
        <Link className="button secondary" to="/patrols">
          Open Patrol Management
        </Link>
      </div>

      <div className="metrics-grid live-metrics">
        <div className="metric-card">
          <div className="metric-top">Active patrols</div>
          <strong className="metric-value">{data.rangers.length}</strong>
          <span className="metric-detail">Rangers currently in progress</span>
        </div>
        <div className="metric-card">
          <div className="metric-top">Recent GPS updates</div>
          <strong className="metric-value">{stats.recent}</strong>
          <span className="metric-detail">
            Updated within {data.freshnessSeconds}s
          </span>
        </div>
        <div className="metric-card">
          <div className="metric-top">Stale or unavailable</div>
          <strong className="metric-value">{stats.staleOrUnavailable}</strong>
          <span className="metric-detail">No recent position received</span>
        </div>
      </div>

      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {pollError && (
        <p role="alert" className="field-error">
          {pollError}
        </p>
      )}
      {refreshedAt && !error && (
        <p role="status" className="muted live-refreshed">
          Last checked {refreshedAt.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </p>
      )}

      {loading ? (
        <p role="status">Loading live Ranger positions…</p>
      ) : error ? (
        <button
          className="button secondary"
          onClick={() => {
            setLoading(true);
            setRefresh((n) => n + 1);
          }}
        >
          Retry
        </button>
      ) : !data.rangers.length ? (
        <p className="muted">
          No Rangers are currently on an active patrol. Start a patrol to see
          live positions here.
        </p>
      ) : (
        <>
          <div className="users-filters live-filters">
            <label>
              Search ranger or patrol
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, ranger ID, patrol or park"
              />
            </label>
            <label>
              GPS status
              <select
                value={gpsFilter}
                onChange={(event) => setGpsFilter(event.target.value)}
              >
                <option value="all">All</option>
                <option value="available">Available</option>
                <option value="stale">Stale</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </label>
          </div>

          <div className="dashboard-grid live-grid">
            <div className="map-container live-map">
              <LiveRangerMap
                rangers={data.rangers}
                selectedId={selectedId}
                onSelect={setSelectedId}
                trail={selected ? trails[selectedId] : null}
                showTrail={showTrail}
              />
            </div>
            <div className="live-side">
              <div className="live-list">
                <ul>
                  {visible.map((ranger) => {
                    const state = gpsState(
                      ranger.location,
                      data.freshnessSeconds,
                    );
                    return (
                      <li key={ranger.patrolId}>
                        <button
                          type="button"
                          className={
                            "live-item" +
                            (ranger.patrolId === selectedId
                              ? " is-selected"
                              : "")
                          }
                          aria-pressed={ranger.patrolId === selectedId}
                          onClick={() => setSelectedId(ranger.patrolId)}
                        >
                          <span className="live-item-main">
                            <strong>
                              {ranger.ranger?.name || "Unassigned ranger"}
                            </strong>
                            <span className="small muted">
                              {ranger.routeName} ·{" "}
                              {ranger.park?.name || ranger.startLocation || "—"}
                            </span>
                          </span>
                          <span className="live-item-meta">
                            <span className={"gps-badge gps-" + state}>
                              {GPS_STATES[state]}
                            </span>
                            <span className="small muted">
                              {formatWhen(ranger.location?.recordedAt)}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {!visible.length && (
                  <p className="muted live-empty-list">
                    No Rangers match the current filters.
                  </p>
                )}
              </div>

              {selected && (
                <div className="live-detail" aria-label="Selected ranger details">
                  <h3>{selected.ranger?.name || "Unassigned ranger"}</h3>
                  <dl>
                    <div>
                      <dt>Ranger ID</dt>
                      <dd>{selected.ranger?.id || "—"}</dd>
                    </div>
                    <div>
                      <dt>Patrol</dt>
                      <dd>{selected.routeName}</dd>
                    </div>
                    <div>
                      <dt>Park / area</dt>
                      <dd>
                        {selected.park?.name || selected.startLocation || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <span className={statusBadge(selected.status)}>
                          {patrolStatusLabel(selected.status)}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Type / priority</dt>
                      <dd>
                        {patrolTypeLabel(selected.patrolType)}{" "}
                        <span className={priorityBadge(selected.priority)}>
                          {patrolPriorityLabel(selected.priority)}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>GPS status</dt>
                      <dd>
                        <span
                          className={
                            "gps-badge gps-" +
                            gpsState(selected.location, data.freshnessSeconds)
                          }
                        >
                          {
                            GPS_STATES[
                              gpsState(selected.location, data.freshnessSeconds)
                            ]
                          }
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Coordinates</dt>
                      <dd>
                        {selected.location
                          ? `${selected.location.latitude.toFixed(5)}, ${selected.location.longitude.toFixed(5)}`
                          : "Not received"}
                      </dd>
                    </div>
                    <div>
                      <dt>Last GPS update</dt>
                      <dd>{formatWhen(selected.location?.recordedAt)}</dd>
                    </div>
                  </dl>
                  <label className="live-trail-toggle">
                    <input
                      type="checkbox"
                      checked={showTrail}
                      onChange={(event) => setShowTrail(event.target.checked)}
                    />
                    Show recorded route
                  </label>
                  {trailLoading && (
                    <p role="status" className="small muted">
                      Loading recorded route…
                    </p>
                  )}
                  <p className="live-detail-actions">
                    <Link to={`/patrols/${selected.patrolId}`}>
                      Open patrol details
                    </Link>
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}