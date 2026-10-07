import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { getAnimalsWithLatestLocations } from "../../services/sensorApi";

// Species emoji mapping
const SPECIES_EMOJIS = {
  'Elephant': '🐘',
  'Leopard': '🐆',
  'Sloth Bear': '🐻',
  'Sambar Deer': '🦌',
  'Spotted Deer': '🦌',
  'Wild Boar': '🐗',
  'Wild Buffalo': '🐃',
  'Wild Goat': '🐐',
  'Purple-faced Langur': '🐒',
  'Golden Jackal': '🦊'
};

// Create custom emoji icon
const createEmojiIcon = (emoji) => {
  return L.divIcon({
    html: `<div style="font-size: 32px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">${emoji}</div>`,
    className: 'emoji-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

export default function FieldMap() {
  const [animals, setAnimals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAnimals();
  }, []);

  const loadAnimals = async () => {
    try {
      setLoading(true);
      const response = await getAnimalsWithLatestLocations();
      const animalsWithLocations = response.data.filter(
        animal => animal.locations && animal.locations.length > 0
      );
      setAnimals(animalsWithLocations);
    } catch (err) {
      setError('Failed to load animal data');
      console.error('Error loading animals:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Field Map</h1>
        <p className="muted">View wildlife tracking locations</p>
      </div>

      <div className="page-content">
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#67756d' }}>
            Loading animal locations...
          </div>
        )}
        
        {error && (
          <div style={{ 
            background: '#f8e8e5', 
            color: '#974836', 
            padding: '12px 16px', 
            borderRadius: '6px', 
            marginBottom: '20px' 
          }}>
            {error}
          </div>
        )}

        {!loading && !error && (
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
              {animals.map((animal) => {
                const latestLocation = animal.locations[0];
                const emoji = SPECIES_EMOJIS[animal.species] || '🐾';
                return (
                  <Marker
                    key={animal.id}
                    position={[latestLocation.latitude, latestLocation.longitude]}
                    icon={createEmojiIcon(emoji)}
                  >
                    <Popup>
                      <div style={{ minWidth: '200px' }}>
                        <div style={{ fontSize: '20px', marginBottom: '8px' }}>{emoji}</div>
                        <strong>{animal.animalCode}</strong>
                        {animal.name && <div style={{ marginTop: '4px' }}>Name: {animal.name}</div>}
                        <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                          Species: {animal.species}
                        </div>
                        {latestLocation.heartRate && (
                          <div style={{ marginTop: '4px', fontSize: '12px' }}>
                            Heart Rate: {latestLocation.heartRate} BPM
                          </div>
                        )}
                        {latestLocation.temperature && (
                          <div style={{ marginTop: '4px', fontSize: '12px' }}>
                            Temperature: {latestLocation.temperature}°C
                          </div>
                        )}
                        {latestLocation.activityLevel && (
                          <div style={{ marginTop: '4px', fontSize: '12px' }}>
                            Activity: {latestLocation.activityLevel}
                          </div>
                        )}
                        <div style={{ marginTop: '8px', fontSize: '11px', color: '#999' }}>
                          Last updated: {new Date(latestLocation.recordedAt).toLocaleString()}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
              {animals.length === 0 && (
                <div style={{ 
                  position: 'absolute', 
                  top: '50%', 
                  left: '50%', 
                  transform: 'translate(-50%, -50%)',
                  background: 'white',
                  padding: '20px',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  zIndex: 1000
                }}>
                  No animal locations found
                </div>
              )}
            </MapContainer>
          </div>
        )}
      </div>
    </div>
  );
}
