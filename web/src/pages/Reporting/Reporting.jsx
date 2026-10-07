import { useState } from "react";
import DataTable from "../../components/DataTable/DataTable";

export default function Reporting() {
  const [reports, setReports] = useState([]);

  const columns = [
    { key: "id", header: "ID" },
    { key: "title", header: "Report Title" },
    { key: "type", header: "Type" },
    { key: "date", header: "Date" },
    { key: "status", header: "Status" },
  ];

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
            {reports.length === 0 ? (
              <p className="empty-state">No reports generated yet</p>
            ) : (
              <DataTable columns={columns} data={reports} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
