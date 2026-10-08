import { incidentTypes, incidentStatuses } from "../../services/incidentApi";
export function QueryState({ query }) {
  if (!query.authorized)
    return (
      <p role="alert">
        Only approved Park Managers can view incident management.
      </p>
    );
  if (query.loading) return <p role="status">Loading incidents…</p>;
  if (query.error)
    return (
      <div role="alert">
        {query.error}
        <button className="button" onClick={query.refresh}>
          Retry incidents
        </button>
      </div>
    );
  return null;
}
export function Pagination({ page, total, size = 25, change, label }) {
  return (
    <nav className="incident-controls" aria-label={label}>
      <button
        className="button"
        disabled={page <= 1}
        onClick={() => change(page - 1)}
      >
        Previous
      </button>
      <span>
        Page {page} · {total}{" "}
        {label === "Patrol pagination" ? "patrols" : "incidents"}
      </span>
      <button
        className="button"
        disabled={page * size >= total}
        onClick={() => change(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
export default function IncidentFilters({
  filters,
  update,
  items,
  search,
  setSearch,
  clear,
}) {
  const options = { patrolId: {}, rangerId: {}, parkId: {} };
  items.forEach((item) => {
    if (item.patrol?.id)
      options.patrolId[item.patrol.id] =
        item.patrol.routeName || item.patrol.id;
    if (item.reporter?.id)
      options.rangerId[item.reporter.id] =
        item.reporter.name || item.reporter.id;
    if (item.park?.id)
      options.parkId[item.park.id] = item.park.name || item.park.id;
  });
  return (
    <>
      <div className="users-filters">
        {[
          ["patrolId", "Patrol"],
          ["rangerId", "Ranger"],
          ["parkId", "Park"],
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              aria-label={label}
              value={filters[key]}
              list={`incident-${key}`}
              onChange={(event) => update({ [key]: event.target.value })}
              placeholder={`${label} ID or select a loaded record`}
            />
            <datalist id={`incident-${key}`}>
              {Object.entries(options[key]).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </datalist>
          </label>
        ))}
        {[
          ["incidentType", "Incident type", incidentTypes],
          ["status", "Incident status", incidentStatuses],
        ].map(([key, label, values]) => (
          <label key={key}>
            {label}
            <select
              value={filters[key]}
              onChange={(event) => update({ [key]: event.target.value })}
            >
              <option value="">All</option>
              {Object.entries(values).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label>
          From date (Sri Lanka)
          <input
            type="date"
            value={filters.from}
            onChange={(event) => update({ from: event.target.value })}
          />
        </label>
        <label>
          To date (Sri Lanka)
          <input
            type="date"
            value={filters.to}
            onChange={(event) => update({ to: event.target.value })}
          />
        </label>
        <label>
          Search matching incidents
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            maxLength={120}
          />
        </label>
      </div>
      <div className="incident-controls">
        <label>
          <input
            type="checkbox"
            checked={filters.includeWithdrawn === "true"}
            onChange={(event) =>
              update({ includeWithdrawn: String(event.target.checked) })
            }
          />{" "}
          Include withdrawn history
        </label>
        <button className="button" onClick={clear}>
          Clear filters
        </button>
      </div>
    </>
  );
}
