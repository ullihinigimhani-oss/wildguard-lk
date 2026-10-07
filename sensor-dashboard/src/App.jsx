import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { addSensorData, createAnimal, getAllAnimals, updateAnimal } from './services/api';

// Fix for default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Species list with their code prefixes
const SPECIES_LIST = [
  { name: 'Elephant', prefix: 'ELE', emoji: '🐘' },
  { name: 'Leopard', prefix: 'LEO', emoji: '🐆' },
  { name: 'Sloth Bear', prefix: 'BEA', emoji: '🐻' },
  { name: 'Sambar Deer', prefix: 'SAM', emoji: '🦌' },
  { name: 'Spotted Deer', prefix: 'SPD', emoji: '🦌' },
  { name: 'Wild Boar', prefix: 'BOA', emoji: '🐗' },
  { name: 'Wild Buffalo', prefix: 'BUF', emoji: '🐃' },
  { name: 'Wild Goat', prefix: 'GOA', emoji: '🐐' },
  { name: 'Purple-faced Langur', prefix: 'LAN', emoji: '🐒' },
  { name: 'Golden Jackal', prefix: 'JAC', emoji: '🦊' }
];

function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click: (e) => {
      onLocationSelect(e.latlng);
    }
  });
  return null;
}

export default function App() {
  const [locationForm, setLocationForm] = useState({
    species: '',
    animalCode: '',
    latitude: null,
    longitude: null,
    heartRate: '',
    temperature: '',
    activityLevel: '',
    timestamp: new Date().toISOString().slice(0, 16)
  });
  const [animalForm, setAnimalForm] = useState({
    species: '',
    animalCode: '',
    name: '',
    sex: '',
    notes: ''
  });
  const [animals, setAnimals] = useState([]);
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [mapMarker, setMapMarker] = useState(null);

  useEffect(() => {
    loadAnimals();
  }, []);

  const loadAnimals = async () => {
    try {
      const response = await getAllAnimals();
      setAnimals(response.data || []);
    } catch (err) {
      console.error('Failed to load animals:', err);
    }
  };

  // Generate next animal code for a species
  const generateAnimalCode = (species) => {
    const speciesData = SPECIES_LIST.find(s => s.name === species);
    if (!speciesData) return '';
    
    // Find existing animals of this species
    const existingAnimals = animals.filter(a => a.species === species);
    console.log('Existing animals for', species, ':', existingAnimals);
    
    const maxNumber = existingAnimals.reduce((max, animal) => {
      const match = animal.animalCode.match(new RegExp(`^${speciesData.prefix}(\\d+)$`));
      if (match) {
        const num = parseInt(match[1], 10);
        console.log(`Found code ${animal.animalCode} with number ${num}`);
        return num > max ? num : max;
      }
      return max;
    }, 0);
    
    const nextNumber = maxNumber + 1;
    const newCode = `${speciesData.prefix}${String(nextNumber).padStart(3, '0')}`;
    console.log('Generated code:', newCode);
    return newCode;
  };

  const handleSpeciesChange = (species) => {
    const newCode = generateAnimalCode(species);
    setAnimalForm({
      ...animalForm,
      species,
      animalCode: newCode
    });
  };

  const handleLocationSpeciesChange = (species) => {
    setLocationForm({
      ...locationForm,
      species,
      animalCode: ''
    });
  };

  const handleLocationAnimalCodeChange = (animalCode) => {
    setLocationForm({
      ...locationForm,
      animalCode
    });
  };

  const handleLocationSelect = (latlng) => {
    setLocationForm({
      ...locationForm,
      latitude: latlng.lat,
      longitude: latlng.lng
    });
    setMapMarker([latlng.lat, latlng.lng]);
  };

  const handleLocationSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await addSensorData({
        animalCode: locationForm.animalCode,
        latitude: locationForm.latitude,
        longitude: locationForm.longitude,
        heartRate: parseInt(locationForm.heartRate),
        temperature: parseFloat(locationForm.temperature),
        activityLevel: locationForm.activityLevel,
        recordedAt: new Date(locationForm.timestamp).toISOString()
      });
      setMessage('Sensor data added successfully!');
      setLocationForm({
        species: '',
        animalCode: '',
        latitude: null,
        longitude: null,
        heartRate: '',
        temperature: '',
        activityLevel: '',
        timestamp: new Date().toISOString().slice(0, 16)
      });
      setMapMarker(null);
      loadAnimals();
    } catch (err) {
      setError('Failed to add sensor data: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleAnimalSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await createAnimal({
        animalCode: animalForm.animalCode,
        species: animalForm.species,
        name: animalForm.name,
        sex: animalForm.sex,
        notes: animalForm.notes
      });
      setMessage('Animal added successfully!');
      setAnimalForm({
        species: '',
        animalCode: '',
        name: '',
        sex: '',
        notes: ''
      });
      loadAnimals();
    } catch (err) {
      setError('Failed to add animal: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleAnimalClick = (animal) => {
    setSelectedAnimal(animal);
    setShowUpdateModal(true);
  };

  const handleUpdateAnimal = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await updateAnimal(selectedAnimal.id, {
        species: selectedAnimal.species,
        name: selectedAnimal.name,
        sex: selectedAnimal.sex,
        notes: selectedAnimal.notes
      });
      setMessage('Animal updated successfully!');
      setShowUpdateModal(false);
      loadAnimals();
    } catch (err) {
      setError('Failed to update animal: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#f5f7f4',
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <header style={{
        background: '#245c45',
        color: 'white',
        padding: '20px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px' }}>Sensor Data Dashboard</h1>
          <p style={{ margin: '5px 0 0', fontSize: '14px', opacity: 0.9 }}>Wildlife Tracking Collar Management</p>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1 }}>
        <main style={{ flex: 1, padding: '30px', overflow: 'auto' }}>
          {message && (
            <div style={{
              background: '#e0efdf',
              color: '#245638',
              padding: '12px 16px',
              borderRadius: '6px',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              {message}
            </div>
          )}

          {error && (
            <div style={{
              background: '#f8e8e5',
              color: '#974836',
              padding: '12px 16px',
              borderRadius: '6px',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          {/* Animal Registration Form */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '25px',
            marginBottom: '25px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ color: '#245c45', marginBottom: '20px', fontSize: '20px' }}>Register New Animal</h2>
            <form onSubmit={handleAnimalSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>Species</label>
                  <select
                    value={animalForm.species}
                    onChange={(e) => handleSpeciesChange(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', background: 'white' }}
                  >
                    <option value="">Select species</option>
                    {SPECIES_LIST.map((species) => (
                      <option key={species.name} value={species.name}>
                        {species.emoji} {species.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>Animal Code</label>
                  <input
                    type="text"
                    value={animalForm.animalCode}
                    onChange={(e) => setAnimalForm({ ...animalForm, animalCode: e.target.value })}
                    placeholder="Auto-generated when species selected"
                    required
                    style={{ width: '100%', padding: '10px', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', background: '#f5f5f5' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>Name</label>
                  <input
                    type="text"
                    value={animalForm.name}
                    onChange={(e) => setAnimalForm({ ...animalForm, name: e.target.value })}
                    placeholder="Optional name"
                    style={{ width: '100%', padding: '10px', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>Sex</label>
                  <select
                    value={animalForm.sex}
                    onChange={(e) => setAnimalForm({ ...animalForm, sex: e.target.value })}
                    style={{ width: '100%', padding: '10px', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', background: 'white' }}
                  >
                    <option value="">Select sex</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>Notes</label>
                <textarea
                  value={animalForm.notes}
                  onChange={(e) => setAnimalForm({ ...animalForm, notes: e.target.value })}
                  placeholder="Additional notes about the animal"
                  rows="2"
                  style={{ width: '100%', padding: '10px', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{ padding: '12px 24px', background: '#245c45', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.65 : 1 }}
              >
                {loading ? 'Adding...' : 'Register Animal'}
              </button>
            </form>
          </div>

          {/* Sensor Data Form with Map */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '25px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ color: '#245c45', marginBottom: '20px', fontSize: '20px' }}>Add Sensor Data</h2>
            <form onSubmit={handleLocationSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>Species</label>
                  <select
                    value={locationForm.species}
                    onChange={(e) => handleLocationSpeciesChange(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', background: 'white' }}
                  >
                    <option value="">Select species</option>
                    {SPECIES_LIST.map((species) => (
                      <option key={species.name} value={species.name}>
                        {species.emoji} {species.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>Animal Code</label>
                  <select
                    value={locationForm.animalCode}
                    onChange={(e) => handleLocationAnimalCodeChange(e.target.value)}
                    required
                    disabled={!locationForm.species}
                    style={{ width: '100%', padding: '10px', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', background: 'white', opacity: !locationForm.species ? 0.65 : 1 }}
                  >
                    <option value="">Select animal code</option>
                    {locationForm.species && animals
                      .filter(a => a.species === locationForm.species)
                      .map((animal) => (
                        <option key={animal.id} value={animal.animalCode}>
                          {animal.animalCode} {animal.name ? `(${animal.name})` : ''}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>
                  Location (Click on map to select)
                  {mapMarker && <span style={{ marginLeft: '10px', color: '#245c45', fontWeight: 'normal' }}>
                    Selected: {mapMarker[0].toFixed(4)}, {mapMarker[1].toFixed(4)}
                  </span>}
                </label>
                <div style={{ height: '300px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd8cf' }}>
                  <MapContainer center={[7.8731, 80.7718]} zoom={7} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapClickHandler onLocationSelect={handleLocationSelect} />
                    {mapMarker && <Marker position={mapMarker} />}
                  </MapContainer>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>Heart Rate (BPM)</label>
                  <input
                    type="number"
                    value={locationForm.heartRate}
                    onChange={(e) => setLocationForm({ ...locationForm, heartRate: e.target.value })}
                    placeholder="e.g., 60"
                    required
                    style={{ width: '100%', padding: '10px', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>Temperature (°C)</label>
                  <input
                    type="number"
                    step="any"
                    value={locationForm.temperature}
                    onChange={(e) => setLocationForm({ ...locationForm, temperature: e.target.value })}
                    placeholder="e.g., 37.5"
                    required
                    style={{ width: '100%', padding: '10px', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>Activity Level</label>
                  <select
                    value={locationForm.activityLevel}
                    onChange={(e) => setLocationForm({ ...locationForm, activityLevel: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', background: 'white' }}
                  >
                    <option value="">Select activity</option>
                    <option value="RESTING">Resting</option>
                    <option value="WALKING">Walking</option>
                    <option value="RUNNING">Running</option>
                    <option value="FEEDING">Feeding</option>
                    <option value="SLEEPING">Sleeping</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>Timestamp</label>
                  <input
                    type="datetime-local"
                    value={locationForm.timestamp}
                    onChange={(e) => setLocationForm({ ...locationForm, timestamp: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !mapMarker || !locationForm.animalCode}
                style={{ padding: '12px 24px', background: '#245c45', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: (loading || !mapMarker || !locationForm.animalCode) ? 'not-allowed' : 'pointer', opacity: (loading || !mapMarker || !locationForm.animalCode) ? 0.65 : 1 }}
              >
                {loading ? 'Adding...' : 'Add Sensor Data'}
              </button>
            </form>
          </div>
        </main>

        {/* Right Sidebar - Animals List */}
        <aside style={{
          width: '350px',
          background: 'white',
          borderLeft: '1px solid #e3e8e2',
          padding: '25px',
          overflow: 'auto'
        }}>
          <h2 style={{ color: '#245c45', marginBottom: '20px', fontSize: '20px' }}>Animals ({animals.length})</h2>
          {animals.length === 0 ? (
            <p style={{ color: '#67756d', fontSize: '14px' }}>No animals registered yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {animals.map((animal) => (
                <div
                  key={animal.id}
                  onClick={() => handleAnimalClick(animal)}
                  style={{
                    padding: '15px',
                    border: '1px solid #e3e8e2',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: '#fafafa'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#f0f4ed'}
                  onMouseLeave={(e) => e.target.style.background = '#fafafa'}
                >
                  <div style={{ fontWeight: '600', color: '#245c45', marginBottom: '5px', fontSize: '14px' }}>
                    {animal.animalCode}
                  </div>
                  <div style={{ fontSize: '12px', color: '#67756d', marginBottom: '3px' }}>
                    {animal.species}
                  </div>
                  {animal.name && (
                    <div style={{ fontSize: '12px', color: '#67756d' }}>
                      Name: {animal.name}
                    </div>
                  )}
                  {animal.locations && animal.locations.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#67756d', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e3e8e2' }}>
                      Last location: {animal.locations[0].latitude.toFixed(4)}, {animal.locations[0].longitude.toFixed(4)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* Update Modal */}
      {showUpdateModal && selectedAnimal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '30px',
            width: '500px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2 style={{ color: '#245c45', marginBottom: '20px', fontSize: '20px' }}>Update Animal</h2>
            <form onSubmit={handleUpdateAnimal}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>Animal Code</label>
                <input
                  type="text"
                  value={selectedAnimal.animalCode}
                  disabled
                  style={{ width: '100%', padding: '10px', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', background: '#f5f5f5' }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>Species</label>
                <input
                  type="text"
                  value={selectedAnimal.species}
                  onChange={(e) => setSelectedAnimal({ ...selectedAnimal, species: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>Name</label>
                <input
                  type="text"
                  value={selectedAnimal.name || ''}
                  onChange={(e) => setSelectedAnimal({ ...selectedAnimal, name: e.target.value })}
                  style={{ width: '100%', padding: '10px', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>Sex</label>
                <select
                  value={selectedAnimal.sex || ''}
                  onChange={(e) => setSelectedAnimal({ ...selectedAnimal, sex: e.target.value })}
                  style={{ width: '100%', padding: '10px', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', background: 'white' }}
                >
                  <option value="">Select sex</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Unknown">Unknown</option>
                </select>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>Notes</label>
                <textarea
                  value={selectedAnimal.notes || ''}
                  onChange={(e) => setSelectedAnimal({ ...selectedAnimal, notes: e.target.value })}
                  rows="3"
                  style={{ width: '100%', padding: '10px', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowUpdateModal(false)}
                  style={{ padding: '12px 24px', background: 'white', color: '#245c45', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ padding: '12px 24px', background: '#245c45', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.65 : 1 }}
                >
                  {loading ? 'Updating...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
