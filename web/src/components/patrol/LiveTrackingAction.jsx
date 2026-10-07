export default function LiveTrackingAction({ patrolId, onSelect }) {
  return (
    <button
      type="button"
      className="text-button live-tracking-action"
      onClick={() => onSelect(patrolId)}
    >
      Live Tracking
    </button>
  );
}
