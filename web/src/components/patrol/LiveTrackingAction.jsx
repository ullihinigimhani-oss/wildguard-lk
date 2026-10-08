import { Link } from "react-router-dom";
import PatrolActionIcon from "./PatrolActionIcon";
export default function LiveTrackingAction({ patrolId }) {
  return (
    <Link
      className="patrol-action live-tracking-action"
      to={`/patrols/${patrolId}/track`}
    >
      <PatrolActionIcon kind="tracking" />Live Tracking
    </Link>
  );
}