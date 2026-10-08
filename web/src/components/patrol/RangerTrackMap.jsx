import { useEffect, useRef } from "react";
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
import { pointTypeLabel } from "./routePlanning";

// Fallback view before any real coordinate is available. Positions are never
// hard-coded; they always come from the planned route or recorded GPS history.
const FALLBACK_CENTER = [7.8731, 80.7718];

const pointSymbol = (type, checkpoint) =>
  type === "CHECKPOINT"
    ? String(checkpoint)
    : { START: "S", END: "E", HIGH_RISK: "!", OBSERVATION: "O" }[type] || "•";

const plannedIcon = (point, checkpoint) =>
  L.divIcon({
    className: "route-marker-container",
    html: `<span class="route-marker route-marker-${String(point.type).toLowerCase()}">${pointSymbol(point.type, checkpoint)}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

const trackIcon = () =>
  L.divIcon({
    className: "ranger-marker",
    html: '<div class="ranger-pin is-selected" aria-hidden="true">🧭</div>',
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

function FitTrack({ points }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || !points.length) return;
    fitted.current = true;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
  }, [points, map]);
  return null;
}

export default function RangerTrackMap({ plannedRoute = [], trail = [] }) {
  const plannedPoints = plannedRoute.map((point) => [
    point.latitude,
    point.longitude,
  ]);
  const recordedPoints = trail.map((point) => [point.latitude, point.longitude]);
  const allPoints = [...plannedPoints, ...recordedPoints];
  const current = trail.at(-1) || null;
  const center = allPoints[0] || FALLBACK_CENTER;
  let checkpoint = 0;
  return (
    <MapContainer
      center={center}
      zoom={allPoints.length ? 12 : 7}
      scrollWheelZoom
      className="live-map-canvas"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitTrack points={allPoints} />
      {plannedPoints.length > 1 && (
        <Polyline
          positions={plannedPoints}
          pathOptions={{ color: "#285c49", weight: 3, dashArray: "7 5" }}
        />
      )}
      {recordedPoints.length > 1 && (
        <Polyline
          positions={recordedPoints}
          pathOptions={{ color: "#b45309", weight: 4, opacity: 0.85 }}
        />
      )}
      {plannedRoute.map((point) => {
        const symbolAt = point.type === "CHECKPOINT" ? ++checkpoint : 0;
        return (
          <Marker
            key={`planned-${point.order}`}
            position={[point.latitude, point.longitude]}
            icon={plannedIcon(point, symbolAt)}
            title={point.label || pointTypeLabel(point.type)}
          />
        );
      })}
      {current && (
        <Marker
          position={[current.latitude, current.longitude]}
          icon={trackIcon()}
        >
          <Popup>
            <div className="live-popup">
              <strong>Current position</strong>
              <div className="small">
                Coordinates: {current.latitude.toFixed(5)},{" "}
                {current.longitude.toFixed(5)}
              </div>
              <div className="small muted">
                Last GPS update: {formatWhen(current.recordedAt)}
              </div>
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}