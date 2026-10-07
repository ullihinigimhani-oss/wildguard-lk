import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for default marker icon in React Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Sample data - replace with actual API data
const sampleMarkers = [
  { id: 1, position: [6.9271, 80.7718], title: "Yala National Park", type: "Park" },
  { id: 2, position: [7.5833, 80.4167], title: "Wilpattu National Park", type: "Park" },
  { id: 3, position: [8.0167, 80.8833], title: "Minneriya National Park", type: "Park" },
  { id: 4, position: [6.8500, 81.0000], title: "Kumana National Park", type: "Park" },
];

function MapView() {
  const map = useMap();
  return null;
}

export default function FieldMap() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Field Map</h1>
        <p className="muted">View park locations and field operations</p>
      </div>

      <div className="page-content">
        <div className="map-container">
          <MapContainer
            center={[7.8731, 80.7718]}
            zoom={7}
            style={{ height: "600px", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapView />
            {sampleMarkers.map((marker) => (
              <Marker key={marker.id} position={marker.position}>
                <Popup>
                  <strong>{marker.title}</strong>
                  <br />
                  Type: {marker.type}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
