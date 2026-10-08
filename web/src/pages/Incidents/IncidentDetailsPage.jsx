import { Link, useParams, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import IncidentDetails from "../../components/incident/IncidentDetails";
import "./Incidents.css";
export default function IncidentDetailsPage() {
  const { patrolId, incidentId } = useParams();
  const { search } = useLocation();
  const { user } = useAuth() || {};
  const authorized =
    user?.role === "PARK_MANAGER" && user?.approvalStatus === "APPROVED";
  return (
    <div className="incident-page">
      <Link
        to={
          patrolId
            ? `/incidents/patrol/${encodeURIComponent(patrolId)}${search}`
            : `/incidents${search}`
        }
      >
        {patrolId ? "← Back to Patrol Reports" : "← Back to Incidents"}
      </Link>
      {authorized ? (
        <IncidentDetails
          key={`${patrolId || "unassigned"}/${incidentId}`}
          id={incidentId}
          patrolId={patrolId || null}
        />
      ) : (
        <p role="alert">
          Only approved Park Managers can view incident management.
        </p>
      )}
    </div>
  );
}
