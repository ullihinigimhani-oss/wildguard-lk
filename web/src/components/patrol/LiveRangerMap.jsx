import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { patrolStatusLabel, statusBadge } from "../../constants/patrols";

// Fallback view when no Ranger has a GPS fix yet. Real positions are never
// hard-coded; they always come from the live monitoring API.
const FALLBACK_CENTER = [7.8731, 80.7718];

const rangerIcon = (selected) =>
  L.divIcon({
    className: "ranger-marker",
    html: `<div class="ranger-pin${selected ? " is-selected" : ""}" aria-hidden="true">🧭</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -14],
  });

const formatWhen = (value) =>
  value
    ? new Date(value).toLocaleString([], {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function FollowSelection({ target }) {
  const map = useMap();
  // Only recentre when the selected Ranger changes, so periodic refreshes do
  // not fight with a manager panning the map.
  useEffect(() => {
    if (target)
      map.setView([target.latitude, target.longitude], Math.max(map.getZoom(), 13));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.patrolId, map]);
  return null;
}

export default function LiveRangerMap({
  rangers,
  selectedId,
  onSelect,
  trail,
  showTrail,
}) {
  const positioned = rangers.filter((ranger) => ranger.location);
  const selected = positioned.find((ranger) => ranger.patrolId === selectedId);
  const start = positioned[0]?.location || null;
  const center = start
    ? [start.latitude, start.longitude]
    : FALLBACK_CENTER;
  return (
    <MapContainer
      center={center}
      zoom={positioned.length ? 11 : 7}
      scrollWheelZoom
      className="live-map-canvas"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FollowSelection target={selected?.location} />
      {showTrail && Array.isArray(trail) && trail.length > 1 && (
        <Polyline
          positions={trail.map((point) => [point.latitude, point.longitude])}
          pathOptions={{ color: "#2f6b4f", weight: 3, opacity: 0.75 }}
        />
      )}
      {positioned.map((ranger) => (
        <Marker
          key={ranger.patrolId}
          position={[ranger.location.latitude, ranger.location.longitude]}
          icon={rangerIcon(ranger.patrolId === selectedId)}
          eventHandlers={{ click: () => onSelect(ranger.patrolId) }}
        >
          <Popup>
            <div className="live-popup">
              <strong>{ranger.ranger?.name || "Ranger"}</strong>
              <div className="small muted">Ranger ID: {ranger.ranger?.id || "—"}</div>
              <div>Patrol: {ranger.routeName}</div>
              <div>Area: {ranger.park?.name || ranger.startLocation || "—"}</div>
              <div>
                Status:{" "}
                <span className={statusBadge(ranger.status)}>
                  {patrolStatusLabel(ranger.status)}
                </span>
              </div>
              <div className="small">
                Coordinates: {ranger.location.latitude.toFixed(5)},{" "}
                {ranger.location.longitude.toFixed(5)}
              </div>
              <div className="small muted">
                Last GPS update: {formatWhen(ranger.location.recordedAt)}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}