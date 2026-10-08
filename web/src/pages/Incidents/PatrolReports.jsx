import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getPatrol } from "../../services/patrolApi";
import { incidentError } from "../../services/incidentApi";
import { patrolStatusLabel, statusBadge } from "../../constants/patrols";
import {
  pageNumber,
  readFilters,
  searchIncidents,
  useIncidentQuery,
} from "./incidentNavigation";
import { Pagination, QueryState } from "./IncidentControls";
import IncidentReportsTable from "./IncidentReportsTable";
import "./Incidents.css";
export default function PatrolReports() {
  const { patrolId } = useParams();
  const [params, setParams] = useSearchParams();
  const query = useIncidentQuery({ ...readFilters(params), patrolId }, true);
  const [patrol, setPatrol] = useState(null),
    [patrolError, setPatrolError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!query.authorized) return;
    let active = true;
    setPatrol(null);
    setPatrolError("");
    getPatrol(patrolId)
      .then((value) => {
        if (active) setPatrol(value);
      })
      .catch((error) => {
        if (active) setPatrolError(incidentError(error));
      });
    return () => {
      active = false;
    };
  }, [patrolId, query.authorized, revision]);
  const refresh = () => {
    query.refresh();
    setRevision((value) => value + 1);
  };
  const items = searchIncidents(
    query.data?.incidents || [],
    params.get("search") || "",
  );
  const valid = items.every(
    (item) => (item.patrolId || item.patrol?.id) === patrolId,
  );
  const page = Math.min(
    pageNumber(params.get("reportPage")),
    Math.max(1, Math.ceil(items.length / 25)),
  );
  const context = params.size ? `?${params}` : "";
  return (
    <div className="incident-page">
      <Link to={`/incidents${context}`}>← Back to Incidents</Link>
      <div className="panel-heading">
        <h2>Patrol Incident Reports</h2>
        <button
          className="button"
          onClick={refresh}
          disabled={!query.authorized || query.loading}
        >
          Refresh reports
        </button>
      </div>
      <QueryState query={{ ...query, refresh }} />
      {query.authorized && patrolError && (
        <div role="alert">
          {patrolError}
          <button className="button" onClick={refresh}>
            Retry reports
          </button>
        </div>
      )}
      {query.authorized && !patrol && !patrolError && !query.loading && (
        <p role="status">Loading patrol…</p>
      )}
      {query.authorized &&
        patrol &&
        !patrolError &&
        !query.loading &&
        !query.error && (
          <>
            <section className="panel incident-details">
              <h3>{patrol.routeName || patrol.id}</h3>
              <dl className="incident-facts">
                <div>
                  <dt>Park</dt>
                  <dd>{patrol.park?.name || "—"}</dd>
                </div>
                <div>
                  <dt>Assigned Ranger</dt>
                  <dd>{patrol.ranger?.name || "—"}</dd>
                </div>
                <div>
                  <dt>Patrol Status</dt>
                  <dd>
                    <span className={`badge ${statusBadge(patrol.status)}`}>
                      {patrolStatusLabel(patrol.status) || "—"}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Total Matching Incident Reports</dt>
                  <dd>{valid ? items.length : "—"}</dd>
                </div>
              </dl>
              <p>
                Counts and reports match the filters and search selected on
                Incidents.
              </p>
            </section>
            {!valid ? (
              <p role="alert">
                Unable to verify the patrol report list. Refresh and try again.
              </p>
            ) : !items.length ? (
              <p>
                No incident reports match this patrol and its current filters.
              </p>
            ) : (
              <>
                <section className="panel">
                  <IncidentReportsTable
                    items={items.slice((page - 1) * 25, page * 25)}
                    detailsPath={(item) =>
                      `/incidents/patrol/${encodeURIComponent(patrolId)}/${encodeURIComponent(item.id)}${context}`
                    }
                  />
                </section>
                <Pagination
                  label="Report pagination"
                  page={page}
                  total={items.length}
                  change={(value) => {
                    const next = new URLSearchParams(params);
                    next.set("reportPage", value);
                    setParams(next, { replace: true });
                  }}
                />
              </>
            )}
          </>
        )}
    </div>
  );
}
