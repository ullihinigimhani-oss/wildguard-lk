import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
export default function Dashboard() {
  const { user } = useAuth();
  const summaries = [
    ['Active Patrol', 'No patrol data available'],
    ['Reported Incidents', 'No incident data available'],
    ['Pending Sync', 'Sync is not connected yet'],
    ['Recent Activity', 'No activity data available'],
  ];
  return <>
    <div className="dashboard-intro"><div>
      <span className="eyebrow">YOUR CONSERVATION WORKSPACE</span>
      <h2>Welcome back, {user.name}</h2>
      <p className="muted">Monitor patrol activity, record field observations and respond to wildlife incidents.</p>
      <span className="status-badge">{user.role.replaceAll('_', ' ')}</span>
    </div></div>
    <p className="demo-notice">Field operations are being prepared. The empty states below are not live database statistics.</p>
    <section className="metrics-grid" aria-label="Operations overview">
      {summaries.map(([title, description]) => <article className="metric-card" key={title}><h3>{title}</h3><p className="muted">{description}</p></article>)}
    </section>
    <section className="panel quick-actions"><div className="panel-heading"><div><h3>Quick Actions</h3><p>Explore upcoming field tools</p></div></div>
      <div className="quick-action-grid">{[['Start Patrol','/patrols'],['Report Field Incident','/incidents'],['View Patrol History','/patrols'],['Open Field Map','/map']].map(([label,path]) => <Link className="button secondary" to={path} key={label}>{label} <small>Coming soon</small></Link>)}</div>
    </section>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-heading"><div><h3>Current Patrol</h3><p>Ranger field operations</p></div></div>
        <dl className="patrol-details">{[['Status','Not available yet'],['Start time','—'],['Distance','—'],['Activities logged','—']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <Link className="button primary" to="/patrols">Start Patrol</Link>
      </section>
      <section className="panel"><div className="panel-heading"><div><h3>Recent Field Activity</h3><p>Field activity will appear here when connected.</p></div></div>
        <p>No field activity available yet.</p><Link className="button secondary" to="/incidents">Report an incident</Link>
      </section>
    </div>
  </>;
}
