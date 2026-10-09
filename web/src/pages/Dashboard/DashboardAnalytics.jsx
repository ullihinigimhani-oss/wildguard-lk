import { useSearchParams } from "react-router-dom";
import ChartPanel from "../../components/charts/ChartPanel";
import TrendChart from "../../components/charts/TrendChart";
import BarChart from "../../components/charts/BarChart";
import {
  incidentStatuses,
  incidentTypes,
  patrolPriorities,
  patrolStatuses,
  patrolTypes,
  periods,
  reportStatuses,
  reportTypes,
} from "../../services/analyticsApi";
import {
  readFilters,
  useCommunityAnalyticsQuery,
  useIncidentAnalyticsQuery,
  useKpisQuery,
  usePatrolAnalyticsQuery,
} from "../Analytics/analyticsNavigation";

function PanelSelect({ label, value, options, onChange }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All</option>
        {Object.entries(options).map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function MetricCards({ query }) {
  if (query.loading)
    return (
      <p className="analytics-state" role="status">
        Loading conservation metrics…
      </p>
    );
  if (query.error)
    return (
      <div className="analytics-state" role="alert">
        {query.error}
        <button className="button" onClick={query.refresh}>
          Retry metrics
        </button>
      </div>
    );
  const data = query.data;
  if (!data) return null;
  const cards = [
    ["Patrols scheduled", data.patrols.scheduled],
    ["Patrols in progress", data.patrols.inProgress],
    ["Patrols completed", data.patrols.completed],
    ["Incidents reported", data.incidents.total],
    ["Community reports", data.community.total],
    ["Human-wildlife conflicts", data.community.conflictCount],
  ];
  return (
    <section className="analytics-metrics" aria-label="Conservation overview">
      {cards.map(([label, value]) => (
        <div key={label} className="metric-card">
          <div className="analytics-metric-value">{value}</div>
          <div className="analytics-metric-label">{label}</div>
        </div>
      ))}
    </section>
  );
}

function TrendBlock({ heading, points, ariaLabel }) {
  return (
    <div className="analytics-chart-block">
      <h4>{heading}</h4>
      <TrendChart points={points} ariaLabel={ariaLabel} />
    </div>
  );
}

function BarBlocks({ blocks }) {
  return (
    <div className="analytics-chart-row">
      {blocks.map(({ heading, items, labels }) => (
        <div className="analytics-chart-block" key={heading}>
          <h4>{heading}</h4>
          <BarChart items={items} labels={labels} />
        </div>
      ))}
    </div>
  );
}

export default function DashboardAnalytics() {
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const kpis = useKpisQuery(filters);
  const incidents = useIncidentAnalyticsQuery(filters);
  const patrols = usePatrolAnalyticsQuery(filters);
  const community = useCommunityAnalyticsQuery(filters);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) =>
      value === "" ? next.delete(key) : next.set(key, String(value)),
    );
    setParams(next, { replace: true });
  };
  const clear = () => setParams({}, { replace: true });
  const anyLoading =
    kpis.loading || incidents.loading || patrols.loading || community.loading;

  return (
    <div className="conserve-analytics">
      <div className="analytics-topbar">
        <div>
          <h3>Conservation &amp; Operational Overview</h3>
          <p className="muted">Live aggregations from patrols, ranger incidents and community reports.</p>
        </div>
        <button
          className="button"
          onClick={() => {
            kpis.refresh();
            incidents.refresh();
            patrols.refresh();
            community.refresh();
          }}
          disabled={anyLoading}
        >
          Refresh
        </button>
      </div>

      <div className="analytics-filterbar">
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
          Granularity
          <select
            value={filters.period}
            onChange={(event) => update({ period: event.target.value })}
          >
            {Object.entries(periods).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Area / location
          <input
            value={filters.area}
            onChange={(event) => update({ area: event.target.value })}
            maxLength={200}
            placeholder="e.g. Kataragama"
          />
        </label>
        <button className="button secondary" onClick={clear}>
          Clear filters
        </button>
      </div>

      <MetricCards query={kpis} />

      <div className="analytics-panels">
        <ChartPanel
          title="Incident analytics"
          subtitle="Ranger incidents by time, type and status."
          badge={
            incidents.data
              ? `${incidents.data.total} ${incidents.data.total === 1 ? "incident" : "incidents"}`
              : undefined
          }
          query={incidents}
          controls={
            <>
              <PanelSelect
                label="Incident type"
                value={filters.incidentType}
                options={incidentTypes}
                onChange={(value) => update({ incidentType: value })}
              />
              <PanelSelect
                label="Incident status"
                value={filters.incidentStatus}
                options={incidentStatuses}
                onChange={(value) => update({ incidentStatus: value })}
              />
            </>
          }
          emptyText="No incidents match these filters."
          render={(data) => (
            <>
              <TrendBlock
                heading={`Incidents over time (${periods[data.period] || periods.month})`}
                points={data.trend}
                ariaLabel="Incidents over time"
              />
              <BarBlocks
                blocks={[
                  { heading: "By type", items: data.byType, labels: incidentTypes },
                  { heading: "By status", items: data.byStatus, labels: incidentStatuses },
                ]}
              />
            </>
          )}
        />

        <ChartPanel
          title="Patrol analytics"
          subtitle="Patrol coverage by status, type and priority."
          badge={
            patrols.data
              ? `${patrols.data.total} ${patrols.data.total === 1 ? "patrol" : "patrols"}`
              : undefined
          }
          query={patrols}
          controls={
            <>
              <PanelSelect
                label="Patrol type"
                value={filters.patrolType}
                options={patrolTypes}
                onChange={(value) => update({ patrolType: value })}
              />
              <PanelSelect
                label="Patrol status"
                value={filters.patrolStatus}
                options={patrolStatuses}
                onChange={(value) => update({ patrolStatus: value })}
              />
              <PanelSelect
                label="Patrol priority"
                value={filters.patrolPriority}
                options={patrolPriorities}
                onChange={(value) => update({ patrolPriority: value })}
              />
            </>
          }
          emptyText="No patrols match these filters."
          render={(data) => (
            <>
              <TrendBlock
                heading={`Patrols over time (${periods[data.period] || periods.month})`}
                points={data.trend}
                ariaLabel="Patrols over time"
              />
              <BarBlocks
                blocks={[
                  { heading: "By status", items: data.byStatus, labels: patrolStatuses },
                  { heading: "By type", items: data.byType, labels: patrolTypes },
                  { heading: "By priority", items: data.byPriority, labels: patrolPriorities },
                ]}
              />
            </>
          )}
        />

        <ChartPanel
          title="Community report analytics"
          subtitle="Public reports by time, type, status and area."
          badge={
            community.data
              ? `${community.data.total} ${community.data.total === 1 ? "report" : "reports"}`
              : undefined
          }
          query={community}
          controls={
            <>
              <PanelSelect
                label="Report type"
                value={filters.reportType}
                options={reportTypes}
                onChange={(value) => update({ reportType: value })}
              />
              <PanelSelect
                label="Report status"
                value={filters.reportStatus}
                options={reportStatuses}
                onChange={(value) => update({ reportStatus: value })}
              />
            </>
          }
          emptyText="No community reports match these filters."
          render={(data) => (
            <>
              <TrendBlock
                heading={`Community reports over time (${periods[data.period] || periods.month})`}
                points={data.trend}
                ariaLabel="Community reports over time"
              />
              <BarBlocks
                blocks={[
                  { heading: "By type", items: data.byType, labels: reportTypes },
                  { heading: "By status", items: data.byStatus, labels: reportStatuses },
                  { heading: "Common areas", items: data.byArea, labels: {} },
                ]}
              />
            </>
          )}
        />
      </div>
    </div>
  );
}