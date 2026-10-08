import { Link, useSearchParams } from "react-router-dom";
import { patrolStatusLabel, statusBadge } from "../../constants/patrols";
import {
  groupPatrols,
  pageNumber,
  readFilters,
  searchIncidents,
  useIncidentQuery,
} from "./incidentNavigation";
import { time } from "../../components/incident/incidentPresentation";
import IncidentFilters, { Pagination, QueryState } from "./IncidentControls";
import IncidentReportsTable from "./IncidentReportsTable";
import "./Incidents.css";

export default function Incidents() {
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params),
    search = params.get("search") || "";
  const query = useIncidentQuery(filters, true);
  const items = query.data?.incidents || [];
  const { patrols, unassigned } = groupPatrols(searchIncidents(items, search));
  const page = Math.min(
    pageNumber(params.get("page")),
    Math.max(1, Math.ceil(patrols.length / 25)),
  );
  const otherPage = Math.min(
    pageNumber(params.get("otherPage")),
    Math.max(1, Math.ceil(unassigned.length / 25)),
  );
  const update = (patch, reset = true) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) =>
      value === "" || value === "false"
        ? next.delete(key)
        : next.set(key, String(value)),
    );
    if (reset) {
      next.delete("page");
      next.delete("otherPage");
      next.delete("reportPage");
    }
    setParams(next, { replace: true });
  };
  const context = params.size ? `?${params}` : "";
  return (
    <div className="incident-page">
      <div className="panel-heading">
        <div>
          <h2>Incidents</h2>
          <p>Patrol reports and authorized incident history.</p>
        </div>
        <button
          className="button"
          disabled={query.loading || !query.authorized}
          onClick={query.refresh}
        >
          Refresh incidents
        </button>
      </div>
      {query.authorized && (
        <>
          <IncidentFilters
            filters={filters}
            update={update}
            items={items}
            search={search}
            setSearch={(value) => update({ search: value })}
            clear={() => setParams({}, { replace: true })}
          />
          <p>
            Report counts include all matching incidents across all pages.
            Withdrawn reports are excluded unless history is enabled.
          </p>
        </>
      )}
      <QueryState query={query} />
      {query.authorized && !query.loading && !query.error && (
        <>
          <section className="panel" aria-label="Patrol incident groups">
            <div className="panel-heading">
              <h3>Patrol Reports</h3>
            </div>
            {!patrols.length ? (
              <p className="incident-empty">
                No patrol reports match these filters.
              </p>
            ) : (
              <div className="table-scroll">
                <table className="incident-table">
                  <thead>
                    <tr>
                      {[
                        "Patrol Name",
                        "Park",
                        "Assigned Ranger",
                        "Patrol Status",
                        "Matching Reports",
                        "Latest Incident Date",
                        "Actions",
                      ].map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {patrols.slice((page - 1) * 25, page * 25).map((group) => (
                      <tr key={group.id}>
                        <td>{group.patrol?.routeName || group.id}</td>
                        <td>{group.park?.name || "—"}</td>
                        <td>{group.patrol?.ranger?.name || "—"}</td>
                        <td>
                          {group.patrol?.status ? (
                            <span
                              className={`badge ${statusBadge(group.patrol.status)}`}
                            >
                              {patrolStatusLabel(group.patrol.status)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <span className="badge badge-scheduled">
                            {group.count}
                          </span>
                        </td>
                        <td>{time(group.latest)}</td>
                        <td>
                          <Link
                            className="button"
                            to={`/incidents/patrol/${encodeURIComponent(group.id)}${context}`}
                            aria-label={`View reports for ${group.patrol?.routeName || group.id}`}
                          >
                            View Reports
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {!!patrols.length && (
            <Pagination
              label="Patrol pagination"
              page={page}
              total={patrols.length}
              change={(value) => update({ page: value }, false)}
            />
          )}
          <section className="panel" aria-label="Other / Unassigned Incidents">
            <div className="panel-heading">
              <h3>Other / Unassigned Incidents</h3>
            </div>
            {!unassigned.length ? (
              <p className="incident-empty">
                No unassigned incidents match these filters.
              </p>
            ) : (
              <IncidentReportsTable
                items={unassigned.slice((otherPage - 1) * 25, otherPage * 25)}
                detailsPath={(item) =>
                  `/incidents/unassigned/${encodeURIComponent(item.id)}${context}`
                }
                showReporter
              />
            )}
          </section>
          {!!unassigned.length && (
            <Pagination
              label="Unassigned pagination"
              page={otherPage}
              total={unassigned.length}
              change={(value) => update({ otherPage: value }, false)}
            />
          )}
        </>
      )}
    </div>
  );
}
