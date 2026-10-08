import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
const icon = L.divIcon({
  className: "community-map-marker",
  html: "<span aria-hidden='true'>●</span>",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});
function ResizeCommunityMap() {
  const map = useMap();
  useEffect(() => {
    let frame;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    };
    resize();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    observer?.observe(map.getContainer());
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [map]);
  return null;
}
export default function CommunityReportLocation({ latitude, longitude }) {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return <p>Reported location coordinates unavailable.</p>;
  return (
    <div className="community-map" aria-label="Community report location map">
      <MapContainer
        center={[latitude, longitude]}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <ResizeCommunityMap />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <Marker position={[latitude, longitude]} icon={icon}>
          <Popup>Reported community location</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}