export default function Reporting() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Reporting</h1>
        <p className="muted">Generate and view research reports</p>
      </div>

      <div className="page-content">
        <div className="card">
          <div className="card-header">
            <h2>Research Reports</h2>
            <button className="button primary">Generate New Report</button>
          </div>
          <div className="card-body">
            <p className="empty-state">No reports generated yet</p>
          </div>
        </div>
      </div>
    </div>
  );
}
