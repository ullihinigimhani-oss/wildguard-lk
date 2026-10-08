import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { getAllAnimals, getAnimalLocationsByDateRange, getDensityZones } from "../../services/sensorApi";

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
    html: `<div style="font-size: 24px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">${emoji}</div>`,
    className: 'emoji-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

export default function WildlifeMonitoring() {
  const [animals, setAnimals] = useState([]);
  const [selectedAnimal, setSelectedAnimal] = useState('');
  const [densityZones, setDensityZones] = useState([]);
  const [routeLocations, setRouteLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedAnimal) {
      loadAnimalRoute(selectedAnimal);
    }
  }, [selectedAnimal]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [animalsRes, zonesRes] = await Promise.all([
        getAllAnimals(),
        getDensityZones(
          new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          new Date().toISOString(),
          300
        )
      ]);
      setAnimals(animalsRes.data || []);
      setDensityZones(zonesRes.data || []);
    } catch (err) {
      setError('Failed to load data');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAnimalRoute = async (animalId) => {
    try {
      const response = await getAnimalLocationsByDateRange(
        animalId,
        new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        new Date().toISOString()
      );
      setRouteLocations(response.data || []);
    } catch (err) {
      console.error('Error loading animal route:', err);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Wildlife Monitoring</h1>
        <p className="muted">Historical Analysis & Zone Tracking</p>
      </div>

      <div className="page-content">
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#67756d' }}>
            Loading monitoring data...
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
          <>
            {/* Stats Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '20px',
              marginBottom: '30px'
            }}>
              <div style={{
                background: 'white',
                padding: '24px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                borderLeft: '4px solid #245c45'
              }}>
                <div style={{ fontSize: '14px', color: '#67756d', marginBottom: '8px' }}>
                  Total Animals
                </div>
                <div style={{ fontSize: '36px', fontWeight: '600', color: '#245c45' }}>
                  {animals.length}
                </div>
              </div>

              <div style={{
                background: 'white',
                padding: '24px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                borderLeft: '4px solid #e74c3c'
              }}>
                <div style={{ fontSize: '14px', color: '#67756d', marginBottom: '8px' }}>
                  Animals Near High Risk Zones
                </div>
                <div style={{ fontSize: '36px', fontWeight: '600', color: '#e74c3c' }}>
                  --
                </div>
                <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                  Coming soon
                </div>
              </div>

              <div style={{
                background: 'white',
                padding: '24px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                borderLeft: '4px solid #f39c12'
              }}>
                <div style={{ fontSize: '14px', color: '#67756d', marginBottom: '8px' }}>
                  Verified Incidents Reported
                </div>
                <div style={{ fontSize: '36px', fontWeight: '600', color: '#f39c12' }}>
                  --
                </div>
                <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                  Coming soon
                </div>
              </div>
            </div>

            {/* Maps Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '20px',
              marginBottom: '20px'
            }}>
              {/* Top Left - Animal Presence Zones */}
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{ color: '#245c45', marginBottom: '15px', fontSize: '18px' }}>
                  Animal Presence Zones (Last 3 Days)
                </h3>
                <div style={{ height: '400px', borderRadius: '8px', overflow: 'hidden' }}>
                  <MapContainer
                    center={[7.8731, 80.7718]}
                    zoom={7}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {densityZones.map((zone, idx) => {
                      const emoji = SPECIES_EMOJIS[zone.species] || '🐾';
                      const color = zone.species === 'Elephant' ? '#245c45' :
                                   zone.species === 'Leopard' ? '#e74c3c' :
                                   zone.species === 'Sloth Bear' ? '#f39c12' :
                                   zone.species === 'Sambar Deer' ? '#8e44ad' :
                                   zone.species === 'Spotted Deer' ? '#9b59b6' :
                                   zone.species === 'Wild Boar' ? '#d35400' :
                                   zone.species === 'Wild Buffalo' ? '#7f8c8d' :
                                   zone.species === 'Wild Goat' ? '#c0392b' :
                                   zone.species === 'Purple-faced Langur' ? '#16a085' :
                                   zone.species === 'Golden Jackal' ? '#27ae60' :
                                   '#3498db';
                      return (
                        <Circle
                          key={idx}
                          center={[zone.center.latitude, zone.center.longitude]}
                          radius={zone.radius}
                          pathOptions={{
                            color,
                            fillColor: color,
                            fillOpacity: 0.3,
                            weight: 2
                          }}
                        >
                          <Popup>
                            <div style={{ minWidth: '200px' }}>
                              <div style={{ fontSize: '20px', marginBottom: '8px' }}>{emoji}</div>
                              <strong>{zone.species} Zone</strong>
                              <div style={{ marginTop: '8px', fontSize: '13px' }}>
                                <div>Animals in area: <strong>{zone.animalCount}</strong></div>
                                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                  {zone.animalCodes.join(', ')}
                                </div>
                                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                  Radius: {zone.radius}m
                                </div>
                              </div>
                            </div>
                          </Popup>
                        </Circle>
                      );
                    })}
                    {densityZones.length === 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: 'white',
                        padding: '15px 25px',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        zIndex: 1000,
                        textAlign: 'center'
                      }}>
                        No density zones found (need 3+ animals of same species within 300m)
                      </div>
                    )}
                  </MapContainer>
                </div>
                <div style={{ marginTop: '15px', fontSize: '13px', color: '#67756d' }}>
                  <strong>Species Areas:</strong>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginTop: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#f5f5f5', borderRadius: '4px' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#245c45' }}></div>
                      <span style={{ fontSize: '12px' }}>🐘 Elephant Areas</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#f5f5f5', borderRadius: '4px' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#e74c3c' }}></div>
                      <span style={{ fontSize: '12px' }}>🐆 Leopard Areas</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#f5f5f5', borderRadius: '4px' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#f39c12' }}></div>
                      <span style={{ fontSize: '12px' }}>🐻 Sloth Bear Areas</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#f5f5f5', borderRadius: '4px' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#8e44ad' }}></div>
                      <span style={{ fontSize: '12px' }}>🦌 Sambar Deer Areas</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#f5f5f5', borderRadius: '4px' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#9b59b6' }}></div>
                      <span style={{ fontSize: '12px' }}>🦌 Spotted Deer Areas</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#f5f5f5', borderRadius: '4px' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#d35400' }}></div>
                      <span style={{ fontSize: '12px' }}>🐗 Wild Boar Areas</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#f5f5f5', borderRadius: '4px' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#7f8c8d' }}></div>
                      <span style={{ fontSize: '12px' }}>🐃 Wild Buffalo Areas</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#f5f5f5', borderRadius: '4px' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#c0392b' }}></div>
                      <span style={{ fontSize: '12px' }}>🐐 Wild Goat Areas</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#f5f5f5', borderRadius: '4px' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#16a085' }}></div>
                      <span style={{ fontSize: '12px' }}>🐒 Purple-faced Langur Areas</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#f5f5f5', borderRadius: '4px' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#27ae60' }}></div>
                      <span style={{ fontSize: '12px' }}>🦊 Golden Jackal Areas</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Right - Animal Route Tracking */}
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{ color: '#245c45', marginBottom: '15px', fontSize: '18px' }}>
                  Animal Route Tracking (Last 3 Days)
                </h3>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>
                    Select Animal
                  </label>
                  <select
                    value={selectedAnimal}
                    onChange={(e) => setSelectedAnimal(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #cbd8cf',
                      borderRadius: '6px',
                      fontSize: '14px',
                      background: 'white'
                    }}
                  >
                    <option value="">Select an animal to view route</option>
                    {animals.map((animal) => (
                      <option key={animal.id} value={animal.id}>
                        {animal.animalCode} {animal.name ? `(${animal.name})` : ''} - {animal.species}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ height: '400px', borderRadius: '8px', overflow: 'hidden' }}>
                  <MapContainer
                    center={[7.8731, 80.7718]}
                    zoom={7}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {routeLocations.length > 0 && (
                      <>
                        <Polyline
                          positions={routeLocations.map(loc => [loc.latitude, loc.longitude])}
                          pathOptions={{ color: 'black', weight: 3, opacity: 0.8 }}
                        />
                        {routeLocations.map((loc, idx) => (
                          <CircleMarker
                            key={idx}
                            center={[loc.latitude, loc.longitude]}
                            radius={5}
                            pathOptions={{ color: 'black', fillColor: 'black', fillOpacity: 1 }}
                          >
                            <Popup>
                              <div style={{ minWidth: '150px' }}>
                                <div style={{ fontSize: '12px', color: '#666' }}>
                                  {new Date(loc.recordedAt).toLocaleString()}
                                </div>
                                {loc.heartRate && (
                                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                                    HR: {loc.heartRate} BPM
                                  </div>
                                )}
                                {loc.temperature && (
                                  <div style={{ fontSize: '12px' }}>
                                    Temp: {loc.temperature}°C
                                  </div>
                                )}
                              </div>
                            </Popup>
                          </CircleMarker>
                        ))}
                      </>
                    )}
                  </MapContainer>
                </div>
                {selectedAnimal && routeLocations.length === 0 && (
                  <div style={{ marginTop: '10px', fontSize: '13px', color: '#67756d', textAlign: 'center' }}>
                    No location data available for this animal in the last 3 days
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
