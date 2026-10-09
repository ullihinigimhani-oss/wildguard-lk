export default function ChartPanel({
  title,
  subtitle,
  badge,
  controls,
  query,
  render,
  emptyText,
}) {
  if (query.loading)
    return (
      <section className="panel analytics-panel">
        <div className="panel-heading">
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <p className="analytics-state" role="status" data-testid="loading-analytics-state">
          Loading {title.toLowerCase()}…
        </p>
      </section>
    );
  if (query.error)
    return (
      <section className="panel analytics-panel">
        <div className="panel-heading">
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="analytics-state" role="alert">
          {query.error}
          <button className="button" onClick={query.refresh}>
            Retry analytics
          </button>
        </div>
      </section>
    );
  if (!query.data || query.data.total === 0)
    return (
      <section className="panel analytics-panel">
        <div className="panel-heading">
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <p className="analytics-empty">{emptyText}</p>
      </section>
    );
  return (
    <section className="panel analytics-panel">
      <div className="panel-heading">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {badge ? (
          <span className="badge badge-scheduled">{badge}</span>
        ) : null}
      </div>
      {controls ? <div className="analytics-controls">{controls}</div> : null}
      <div className="analytics-body">{render(query.data)}</div>
    </section>
  );
}