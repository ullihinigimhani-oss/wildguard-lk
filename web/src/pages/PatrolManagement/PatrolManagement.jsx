import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listAssignableRangers, listPatrols } from "../../services/patrolApi";
import {
  patrolPriorities,
  patrolStatuses,
  patrolTypes,
  patrolPriorityLabel,
  patrolStatusLabel,
  patrolTypeLabel,
  priorityBadge,
  statusBadge,
} from "../../constants/patrols";
const initialFilters = {
  search: "",
  status: "",
  rangerId: "",
  date: "",
  patrolType: "",
  priority: "",
  page: 1,
};
const formatDate = (value) => (value ? String(value).slice(0, 10) : "—");
const formatTime = (value) =>
  value
    ? new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
export default function PatrolManagement() {
  const [filters, setFilters] = useState(initialFilters);
  const [rangers, setRangers] = useState([]);
  const [result, setResult] = useState({ patrols: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const hasFilters = Boolean(
    filters.search ||
      filters.status ||
      filters.rangerId ||
      filters.date ||
      filters.patrolType ||
      filters.priority,
  );
  const update = (patch) =>
    setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
  useEffect(() => {
    let current = true;
    listAssignableRangers()
      .then((list) => {
        if (current) setRangers(list);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [refresh]);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(
      () =>
        listPatrols({ ...filters })
          .then((data) => {
            if (current) setResult(data);
          })
          .catch(() => {
            if (current) setError("Unable to load patrols. Please try again.");
          })
          .finally(() => {
            if (current) setLoading(false);
          }),
      200,
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [filters, refresh]);
  return (
    <section className="panel patrol-panel">
      <div className="patrol-list-heading">
        <div>
          <h2>Patrol Management</h2>
          <p className="muted">
            Review scheduled and active patrols, verify assignments, and open a
            patrol for full details.
          </p>
        </div>
        <Link className="button primary" to="/patrols/new">
          Create Patrol
        </Link>
      </div>
      <div className="users-filters">
        <label>
          Search patrol title
          <input
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            maxLength={120}
          />
        </label>
        <label>
          Status
          <select
            value={filters.status}
            onChange={(e) => update({ status: e.target.value })}
          >
            <option value="">All statuses</option>
            {patrolStatuses.map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </label>
        <label>
          Assigned ranger
          <select
            value={filters.rangerId}
            onChange={(e) => update({ rangerId: e.target.value })}
          >
            <option value="">All rangers</option>
            {rangers.map((ranger) => (
              <option key={ranger.id} value={ranger.id}>
                {ranger.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input
            type="date"
            value={filters.date}
            onChange={(e) => update({ date: e.target.value })}
          />
        </label>
        <label>
          Patrol type
          <select
            value={filters.patrolType}
            onChange={(e) => update({ patrolType: e.target.value })}
          >
            <option value="">All types</option>
            {patrolTypes.map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </label>
        <label>
          Priority
          <select
            value={filters.priority}
            onChange={(e) => update({ priority: e.target.value })}
          >
            <option value="">All priorities</option>
            {patrolPriorities.map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </label>
        {hasFilters && (
          <button
            className="button secondary"
            onClick={() => setFilters(initialFilters)}
          >
            Clear filters
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading patrols…</p>
      ) : error ? (
        <button
          className="button secondary"
          onClick={() => setRefresh((n) => n + 1)}
        >
          Retry
        </button>
      ) : (
        <>
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  {[
                    "Patrol",
                    "Park / Ranger Area",
                    "Assigned Ranger",
                    "Date",
                    "Start",
                    "Expected end",
                    "Type",
                    "Priority",
                    "Status",
                    "Actions",
                  ].map((heading) => (
                    <th key={heading}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.patrols.map((patrol) => (
                  <tr key={patrol.id}>
                    <td>
                      <strong>{patrol.routeName}</strong>
                      <br />
                      <span className="small muted">{patrol.id}</span>
                    </td>
                    <td>{patrol.park?.name || "—"}</td>
                    <td>
                      {patrol.ranger?.name || "—"}
                      <br />
                      <span className="small muted">
                        {patrol.ranger?.email || ""}
                      </span>
                    </td>
                    <td className="no-wrap">
                      {formatDate(patrol.scheduledDate)}
                    </td>
                    <td className="no-wrap">{formatTime(patrol.startTime)}</td>
                    <td className="no-wrap">{formatTime(patrol.endTime)}</td>
                    <td className="no-wrap">
                      {patrolTypeLabel(patrol.patrolType)}
                    </td>
                    <td>
                      <span className={priorityBadge(patrol.priority)}>
                        {patrolPriorityLabel(patrol.priority)}
                      </span>
                    </td>
                    <td>
                      <span className={statusBadge(patrol.status)}>
                        {patrolStatusLabel(patrol.status)}
                      </span>
                    </td>
                    <td>
                      <Link
                        className="text-button"
                        to={`/patrols/${patrol.id}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!result.patrols.length && (
            <p className="muted">
              {hasFilters
                ? "No patrols match the current filters."
                : "No patrols yet. Create the first patrol."}
            </p>
          )}
          {result.total > 0 && (
            <div className="users-pagination">
              <button
                className="button secondary"
                disabled={filters.page === 1}
                onClick={() => update({ page: filters.page - 1 })}
              >
                Previous
              </button>
              <span>
                Page {filters.page} · {result.total} patrols
              </span>
              <button
                className="button secondary"
                disabled={filters.page * 25 >= result.total}
                onClick={() => update({ page: filters.page + 1 })}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
