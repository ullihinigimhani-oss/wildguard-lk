import { Link } from "react-router-dom";
import { incidents, metrics, patrols } from "../../constants/demo";
import StatusBadge from "../../components/StatusBadge/StatusBadge";
import useApiHealth from "../../hooks/useApiHealth";
export default function Dashboard() {
  const health = useApiHealth();
  return (
    <>
      <div className="dashboard-intro">
        <div>
          <span className="eyebrow">YALA NATIONAL PARK</span>
          <h2>Every day, a little more protected.</h2>
          <p className="muted">
            Your overview of the people, places and wildlife in your care.
          </p>
        </div>
        <span
          className={`api-status ${health === "API connected" ? "connected" : ""}`}
          role="status"
        >
          ● {health}
        </span>
      </div>
      <div className="demo-banner">
        <strong>Demo workspace</strong>
        <span>
          All operational figures and activity below are simulated. API status
          is live.
        </span>
      </div>
      <section className="metrics-grid" aria-label="Operations overview">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <div className="metric-top">
              <span>{metric.label}</span>
              <span
                className={`metric-icon ${metric.color}`}
                aria-hidden="true"
              >
                {metric.icon}
              </span>
            </div>
            <strong className="metric-value">{metric.value}</strong>
            <span className="metric-detail">{metric.detail}</span>
          </article>
        ))}
      </section>
      <div className="dashboard-grid">
        <section className="panel incidents-panel">
          <div className="panel-heading">
            <div>
              <h3>Recent incidents</h3>
              <p>Reports that need a closer look</p>
            </div>
            <Link to="/incidents">View all →</Link>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Incident</th>
                  <th>Priority</th>
                  <th>Reported</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map(([id, title, place, priority, time]) => (
                  <tr key={id}>
                    <td>
                      <span className="table-id">{id}</span>
                      <strong>{title}</strong>
                      <small>{place}</small>
                    </td>
                    <td>
                      <StatusBadge>{priority}</StatusBadge>
                    </td>
                    <td className="muted no-wrap">{time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="park-panel">
          <div>
            <span className="eyebrow">PARK OVERVIEW</span>
            <h3>Yala National Park</h3>
            <p>A landscape worth protecting.</p>
          </div>
          <div
            className="park-illustration"
            aria-label="Decorative landscape illustration, not a live map"
          >
            <span>06°22′ N · 81°31′ E</span>
            <svg viewBox="0 0 340 160" aria-hidden="true">
              <path
                d="M0 140L60 60 120 110 185 20 260 100 340 45V160H0Z"
                fill="#476850"
              />
              <path
                d="M0 160L100 110 150 150 250 70 340 140V160Z"
                fill="#719173"
              />
              <path
                d="M210 160Q100 110 170 95T205 45"
                fill="none"
                stroke="#c8d8a9"
                strokeWidth="4"
                strokeDasharray="6 5"
              />
              <circle cx="205" cy="45" r="6" fill="#e2b95f" />
            </svg>
          </div>
          <div className="park-facts">
            <div>
              <strong>3</strong>
              <span>Demo sectors</span>
            </div>
            <div>
              <strong>24</strong>
              <span>Demo rangers</span>
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Active patrols</h3>
              <p>Teams across the park</p>
            </div>
            <Link to="/patrols">View teams →</Link>
          </div>
          <div className="patrol-list">
            {patrols.map(([team, location, status]) => (
              <div className="patrol-row" key={team}>
                <span className="team-icon" aria-hidden="true">
                  ↗
                </span>
                <div>
                  <strong>{team}</strong>
                  <small>{location}</small>
                </div>
                <StatusBadge>{status}</StatusBadge>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Recent alerts</h3>
              <p>Wildlife monitoring · Simulated</p>
            </div>
            <Link to="/alerts">View all →</Link>
          </div>
          <div className="alert-list">
            <article>
              <span className="alert-dot" />
              <div>
                <strong>Elephant movement near boundary</strong>
                <p>North sector · Example monitoring alert</p>
                <small>15 minutes ago · Demo</small>
              </div>
            </article>
            <article>
              <span className="alert-dot green-dot" />
              <div>
                <strong>Collar signal restored</strong>
                <p>Block II · Example device status</p>
                <small>42 minutes ago · Demo</small>
              </div>
            </article>
          </div>
        </section>
      </div>
    </>
  );
}
