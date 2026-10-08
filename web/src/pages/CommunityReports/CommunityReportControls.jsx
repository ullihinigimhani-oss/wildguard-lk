import { reportTypes, reportStatuses } from "../../services/communityReportApi";

export function QueryState({ query }) {
  if (!query.authorized)
    return (
      <p role="alert">
        Only approved Park Managers can view community report management.
      </p>
    );
  if (query.loading) return <p role="status">Loading community reports…</p>;
  if (query.error)
    return (
      <div role="alert">
        {query.error}
        <button className="button" onClick={query.refresh}>
          Retry reports
        </button>
      </div>
    );
  return null;
}

export function Pagination({ page, total, size, change, label }) {
  return (
    <nav className="community-controls" aria-label={label}>
      <button
        className="button"
        disabled={page <= 1}
        onClick={() => change(page - 1)}
      >
        Previous
      </button>
      <span>
        Page {page} · {total} {total === 1 ? "report" : "reports"}
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

export default function CommunityReportFilters({
  filters,
  update,
  search,
  setSearch,
  clear,
}) {
  return (
    <>
      <div className="users-filters">
        {[
          ["status", "Report status", reportStatuses],
          ["reportType", "Report type", reportTypes],
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
          Search reports
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            maxLength={120}
          />
        </label>
      </div>
      <div className="community-controls">
        <button className="button" onClick={clear}>
          Clear filters
        </button>
      </div>
    </>
  );
}