import { useState } from "react";
import CreatePatrolForm from "./CreatePatrolForm";
const formatDate = (value) => (value ? String(value).slice(0, 10) : "—");
const formatTime = (value) =>
  value
    ? new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
export default function PatrolManagement() {
  const [patrol, setPatrol] = useState(null);
  return (
    <section className="panel patrol-panel">
      <h2>Patrol Management</h2>
      <p className="muted">
        Plan patrols and assign verified rangers to field operations. Every new
        patrol starts as Scheduled until a ranger begins it.
      </p>
      {patrol && (
        <div className="demo-notice patrol-success" role="status">
          <strong>Patrol created successfully.</strong>{" "}
          <span className="badge badge-scheduled">SCHEDULED</span>
          <dl className="patrol-details">
            <div>
              <dt>Patrol</dt>
              <dd>{patrol.routeName}</dd>
            </div>
            <div>
              <dt>Park / Ranger Area</dt>
              <dd>{patrol.park?.name || "—"}</dd>
            </div>
            <div>
              <dt>Lead ranger</dt>
              <dd>{patrol.ranger?.name || "—"}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{formatDate(patrol.scheduledDate)}</dd>
            </div>
            <div>
              <dt>Start</dt>
              <dd>{formatTime(patrol.startTime)}</dd>
            </div>
            <div>
              <dt>Expected end</dt>
              <dd>{formatTime(patrol.endTime)}</dd>
            </div>
          </dl>
        </div>
      )}
      <CreatePatrolForm onCreated={setPatrol} />
    </section>
  );
}
