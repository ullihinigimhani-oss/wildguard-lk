import { Link, useSearchParams } from "react-router-dom";
import {
  reportStatusClass,
  reportStatuses,
  reportTypes,
} from "../../services/communityReportApi";
import { time } from "../../components/incident/incidentPresentation";
import CommunityReportFilters, {
  Pagination,
  QueryState,
} from "./CommunityReportControls";
import {
  pageNumber,
  readFilters,
  useCommunityReportQuery,
} from "./communityReportNavigation";
import "./CommunityReports.css";

export default function CommunityReports() {
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const search = params.get("search") || "";
  const page = pageNumber(params.get("page"));
  const size = 25;
  const query = useCommunityReportQuery(filters, page);
  const items = query.data?.reports || [];
  const total = query.data?.total || 0;

  const update = (patch, reset = true) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) =>
      value === "" || value === "false"
        ? next.delete(key)
        : next.set(key, String(value)),
    );
    if (reset) next.delete("page");
    setParams(next, { replace: true });
  };

  return (
    <div className="community-page">
      <div className="panel-heading">
        <div>
          <h2>Community Reports</h2>
          <p>Incoming sightings, conflicts and suspicious activity reports.</p>
        </div>
        <button
          className="button"
          disabled={query.loading || !query.authorized}
          onClick={query.refresh}
        >
          Refresh reports
        </button>
      </div>
      {query.authorized && (
        <CommunityReportFilters
          filters={filters}
          update={update}
          search={search}
          setSearch={(value) => update({ search: value })}
          clear={() => setParams({}, { replace: true })}
        />
      )}
      <QueryState query={query} />
      {query.authorized && !query.loading && !query.error && (
        <>
          {!items.length ? (
            <p className="community-empty">
              No community reports match these filters.
            </p>
          ) : (
            <>
              <div className="table-scroll">
                <table className="community-table">
                  <thead>
                    <tr>
                      {[
                        "Report Type",
                        "Species",
                        "Status",
                        "Location",
                        "Reporter",
                        "Submitted",
                        "Actions",
                      ].map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>{reportTypes[item.reportType] || item.reportType}</td>
                        <td>{item.species || "—"}</td>
                        <td>
                          <span
                            className={`badge ${reportStatusClass[item.status] || ""}`}
                          >
                            {reportStatuses[item.status] || item.status}
                          </span>
                        </td>
                        <td>{item.manualLocation || "—"}</td>
                        <td>
                          {item.isAnonymous
                            ? "Anonymous"
                            : item.reporterName || item.reporter?.name || "—"}
                        </td>
                        <td>{time(item.submittedAt)}</td>
                        <td>
                          <Link
                            className="button"
                            to={`/community-reports/${encodeURIComponent(item.id)}`}
                            aria-label={`View report ${item.id}`}
                          >
                            View Report
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {total > size && (
                <Pagination
                  label="Community report pagination"
                  page={page}
                  total={total}
                  size={size}
                  change={(value) => update({ page: value }, false)}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}