import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Circle, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { createRiskZone, getAllRiskZones, deleteRiskZone, updateRiskZone } from "../../services/riskZoneApi";
import { listIncidents, markIncidentAsDone, incidentStatuses } from "../../services/incidentApi";

function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click: (e) => {
      onLocationSelect(e.latlng);
    }
  });
  return null;
}

export default function Reporting() {
  const [form, setForm] = useState({
    name: '',
    description: '',
    riskLevel: 'LOW',
    centerLatitude: '',
    centerLongitude: '',
    radiusMeters: 100,
    parkId: 'default-park-id'
  });
  const [mapMarker, setMapMarker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [riskZones, setRiskZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [incidentsLoading, setIncidentsLoading] = useState(true);

  useEffect(() => {
    loadRiskZones();
    loadIncidents();
  }, []);

  const loadRiskZones = async () => {
    try {
      setZonesLoading(true);
      const response = await getAllRiskZones();
      setRiskZones(response.data || []);
    } catch (err) {
      console.error('Error loading risk zones:', err);
    } finally {
      setZonesLoading(false);
    }
  };

  const loadIncidents = async () => {
    try {
      setIncidentsLoading(true);
      // Load all incidents and filter out those marked as done
      const response = await listIncidents({});
      const activeIncidents = response.incidents.filter(
        inc => (!inc.markAsDone || inc.markAsDone === false) && inc.status !== 'WITHDRAWN'
      );
      setIncidents(activeIncidents || []);
    } catch (err) {
      console.error('Error loading incidents:', err);
      setIncidents([]);
    } finally {
      setIncidentsLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this risk zone?')) return;
    try {
      await deleteRiskZone(id);
      setMessage('Risk zone deleted successfully!');
      loadRiskZones();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('Failed to delete risk zone: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleZoneClick = (zone) => {
    setSelectedZone(zone);
    setShowUpdateModal(true);
  };

  const handleUpdateZone = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await updateRiskZone(selectedZone.id, {
        name: selectedZone.name,
        description: selectedZone.description,
        riskLevel: selectedZone.riskLevel,
        isActive: selectedZone.isActive
      });
      setMessage('Risk zone updated successfully!');
      setShowUpdateModal(false);
      loadRiskZones();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('Failed to update risk zone: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsDone = async (incidentId) => {
    if (!window.confirm('Mark this incident as done?')) return;
    try {
      await markIncidentAsDone(incidentId);
      setMessage('Incident marked as done!');
      loadIncidents();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('Failed to mark incident as done: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleIncidentClick = (incident) => {
    if (incident.latitude && incident.longitude) {
      setForm({
        ...form,
        centerLatitude: incident.latitude.toString(),
        centerLongitude: incident.longitude.toString()
      });
      setMapMarker([incident.latitude, incident.longitude]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await createRiskZone({
        ...form,
        centerLatitude: parseFloat(form.centerLatitude),
        centerLongitude: parseFloat(form.centerLongitude),
        radiusMeters: parseFloat(form.radiusMeters)
      });
      setMessage('Risk zone added successfully!');
      setForm({
        name: '',
        description: '',
        riskLevel: 'LOW',
        centerLatitude: '',
        centerLongitude: '',
        radiusMeters: 100,
        parkId: 'default-park-id'
      });
      setMapMarker(null);
      loadRiskZones();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('Failed to add risk zone: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSelect = (latlng) => {
    setForm({
      ...form,
      centerLatitude: latlng.lat.toFixed(6),
      centerLongitude: latlng.lng.toFixed(6)
    });
    setMapMarker([latlng.lat, latlng.lng]);
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'LOW': return '#f1c40f';
      case 'MEDIUM': return '#e67e22';
      case 'HIGH': return '#e74c3c';
      case 'CRITICAL': return '#8b0000';
      default: return '#f1c40f';
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Reporting</h1>
        <p className="muted">Generate and view research reports</p>
      </div>

      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Left - Verified Incidents */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '30px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            minHeight: '500px'
          }}>
            <h2 style={{ color: '#245c45', marginBottom: '20px', fontSize: '20px' }}>Verified Incidents</h2>
            <p style={{ color: '#67756d', marginBottom: '20px', fontSize: '14px' }}>
              Click an incident to populate location in the risk zone form
            </p>
            {incidentsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#67756d' }}>
                Loading incidents...
              </div>
            ) : incidents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#67756d' }}>
                No verified incidents found
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflow: 'auto' }}>
                {incidents.map((incident) => (
                  <div
                    key={incident.id}
                    onClick={() => handleIncidentClick(incident)}
                    style={{
                      padding: '15px',
                      border: '1px solid #cbd8cf',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: '#fafafa'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f0f4ed'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#fafafa'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', color: '#245c45', marginBottom: '5px', fontSize: '14px' }}>
                          {incident.title || incident.incidentType}
                        </div>
                        <div style={{ fontSize: '12px', color: '#67756d', marginBottom: '3px' }}>
                          Type: {incident.incidentType}
                        </div>
                        {incident.latitude && incident.longitude && (
                          <div style={{ fontSize: '12px', color: '#67756d' }}>
                            Location: {incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}
                          </div>
                        )}
                        <div style={{ fontSize: '11px', color: '#67756d', marginTop: '4px' }}>
                          {new Date(incident.reportedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsDone(incident.id);
                        }}
                        style={{
                          padding: '6px 12px',
                          background: '#245c45',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          fontWeight: '500',
                          marginLeft: '8px'
                        }}
                      >
                        Mark as Done
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right - Risk Zone Form */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '30px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ color: '#245c45', marginBottom: '20px', fontSize: '20px' }}>Add Risk Zone</h2>
            <p style={{ color: '#67756d', marginBottom: '20px', fontSize: '14px' }}>
              Mark high-risk areas on the field map
            </p>

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

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>
                  Zone Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Northern Waterhole Area"
                  required
                  style={{ width: '100%', padding: '10px', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px' }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe the risk area"
                  rows="2"
                  style={{ width: '100%', padding: '10px', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px', resize: 'vertical' }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>
                  Risk Level
                </label>
                <select
                  value={form.riskLevel}
                  onChange={(e) => setForm({ ...form, riskLevel: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px', background: 'white' }}
                >
                  <option value="LOW">LOW (Yellow)</option>
                  <option value="MEDIUM">MEDIUM (Orange)</option>
                  <option value="HIGH">HIGH (Red)</option>
                  <option value="CRITICAL">CRITICAL (Dark Red)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.centerLatitude}
                    onChange={(e) => setForm({ ...form, centerLatitude: e.target.value })}
                    placeholder="e.g., 7.8731"
                    required
                    style={{ width: '100%', padding: '10px', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.centerLongitude}
                    onChange={(e) => setForm({ ...form, centerLongitude: e.target.value })}
                    placeholder="e.g., 80.7718"
                    required
                    style={{ width: '100%', padding: '10px', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>
                  Radius (meters)
                </label>
                <input
                  type="number"
                  value={form.radiusMeters}
                  onChange={(e) => setForm({ ...form, radiusMeters: e.target.value })}
                  placeholder="100"
                  required
                  style={{ width: '100%', padding: '10px', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>
                  Location Preview (Click on map to select)
                  {mapMarker && <span style={{ marginLeft: '10px', color: '#245c45', fontWeight: 'normal' }}>
                    Selected: {mapMarker[0].toFixed(4)}, {mapMarker[1].toFixed(4)}
                  </span>}
                </label>
                <div style={{ height: '250px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd8cf' }}>
                  <MapContainer center={[7.8731, 80.7718]} zoom={7} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapClickHandler onLocationSelect={handleLocationSelect} />
                    {mapMarker && form.centerLatitude && form.centerLongitude && (
                      <Circle
                        center={[parseFloat(form.centerLatitude), parseFloat(form.centerLongitude)]}
                        radius={parseFloat(form.radiusMeters)}
                        pathOptions={{
                          color: getRiskColor(form.riskLevel),
                          fillColor: getRiskColor(form.riskLevel),
                          fillOpacity: 0.3,
                          weight: 2
                        }}
                      />
                    )}
                  </MapContainer>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{ padding: '12px 24px', background: '#245c45', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.65 : 1 }}
              >
                {loading ? 'Adding...' : 'Add Risk Zone'}
              </button>
            </form>
          </div>
        </div>

        {/* Risk Zones List */}
        <div style={{
          marginTop: '20px',
          background: 'white',
          borderRadius: '12px',
          padding: '30px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ color: '#245c45', marginBottom: '20px', fontSize: '20px' }}>Risk Zones</h2>
          {zonesLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#67756d' }}>
              Loading risk zones...
            </div>
          ) : riskZones.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#67756d' }}>
              No risk zones added yet
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
              {riskZones.map((zone) => (
                <div
                  key={zone.id}
                  onClick={() => handleZoneClick(zone)}
                  style={{
                    padding: '16px',
                    border: '1px solid #cbd8cf',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong style={{ color: '#243b32', fontSize: '15px' }}>{zone.name}</strong>
                      <div style={{ marginTop: '4px', fontSize: '12px', color: '#67756d' }}>
                        {zone.centerLatitude.toFixed(4)}, {zone.centerLongitude.toFixed(4)}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: 'white',
                        background: getRiskColor(zone.riskLevel)
                      }}
                    >
                      {zone.riskLevel}
                    </div>
                  </div>
                  {zone.description && (
                    <div style={{ fontSize: '13px', color: '#67756d', marginTop: '4px' }}>
                      {zone.description}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#67756d' }}>
                      Radius: {zone.radiusMeters}m
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(zone.id);
                      }}
                      style={{
                        padding: '6px 12px',
                        background: '#e74c3c',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Update Modal */}
        {showUpdateModal && selectedZone && (
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
              <h2 style={{ color: '#245c45', marginBottom: '20px', fontSize: '20px' }}>Update Risk Zone</h2>
              <form onSubmit={handleUpdateZone}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>Zone Name</label>
                  <input
                    type="text"
                    value={selectedZone.name}
                    onChange={(e) => setSelectedZone({ ...selectedZone, name: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>Description</label>
                  <textarea
                    value={selectedZone.description || ''}
                    onChange={(e) => setSelectedZone({ ...selectedZone, description: e.target.value })}
                    rows="2"
                    style={{ width: '100%', padding: '10px', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', resize: 'vertical' }}
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>Risk Level</label>
                  <select
                    value={selectedZone.riskLevel}
                    onChange={(e) => setSelectedZone({ ...selectedZone, riskLevel: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', background: 'white' }}
                  >
                    <option value="LOW">LOW (Yellow)</option>
                    <option value="MEDIUM">MEDIUM (Orange)</option>
                    <option value="HIGH">HIGH (Red)</option>
                    <option value="CRITICAL">CRITICAL (Dark Red)</option>
                  </select>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#243b32' }}>Status</label>
                  <select
                    value={selectedZone.isActive ? 'true' : 'false'}
                    onChange={(e) => setSelectedZone({ ...selectedZone, isActive: e.target.value === 'true' })}
                    required
                    style={{ width: '100%', padding: '10px', border: '1px solid #cbd8cf', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', background: 'white' }}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
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
    </div>
  );
}
