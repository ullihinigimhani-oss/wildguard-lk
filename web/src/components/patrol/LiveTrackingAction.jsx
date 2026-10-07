import PatrolActionIcon from "./PatrolActionIcon";
export default function LiveTrackingAction({ patrolId, onSelect }) {
  return (
    <button
      type="button"
      className="patrol-action live-tracking-action"
      onClick={() => onSelect(patrolId)}
    >
      <PatrolActionIcon kind="tracking" />Live Tracking
    </button>
  );
}
