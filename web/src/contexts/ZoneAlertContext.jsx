import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { getAllAnimals } from '../services/sensorApi';
import { getAllRiskZones } from '../services/riskZoneApi';

const ZoneAlertContext = createContext(null);

export const useZoneAlerts = () => {
  const context = useContext(ZoneAlertContext);
  if (!context) {
    throw new Error('useZoneAlerts must be used within ZoneAlertProvider');
  }
  return context;
};

export const ZoneAlertProvider = ({ children }) => {
  const [alerts, setAlerts] = useState([]);
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set());
  const pollVersion = useRef(0);

  // Calculate distance between two points in meters
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const checkZoneEntries = async () => {
    const version = ++pollVersion.current;
    try {
      const [animalsResponse, zonesResponse] = await Promise.all([
        getAllAnimals(),
        getAllRiskZones()
      ]);

      const animals = animalsResponse.data || [];
      const zones = zonesResponse.data || [];

      const newAlerts = [];

      animals.forEach(animal => {
        if (!animal.locations || animal.locations.length === 0) return;

        const latestLocation = animal.locations[0];
        const animalLat = latestLocation.latitude;
        const animalLng = latestLocation.longitude;

        zones.forEach(zone => {
          if (!zone.isActive) return;

          const distance = calculateDistance(
            animalLat,
            animalLng,
            zone.centerLatitude,
            zone.centerLongitude
          );

          if (distance <= zone.radiusMeters) {
            const alertKey = `${animal.id}-${zone.id}`;
            if (!dismissedAlerts.has(alertKey)) {
              newAlerts.push({
                id: alertKey,
                animal: animal,
                zone: zone,
                riskLevel: zone.riskLevel,
                timestamp: new Date()
              });
            }
          }
        });
      });

      if (version === pollVersion.current) setAlerts(newAlerts);
    } catch (err) {
      console.error('Error checking zone entries:', err);
    }
  };

  const dismissAlert = (alertId) => {
    setDismissedAlerts(prev => new Set([...prev, alertId]));
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  useEffect(() => {
    // Check zone entries every 5 seconds
    const interval = setInterval(checkZoneEntries, 5000);
    checkZoneEntries(); // Initial check

    return () => {
      clearInterval(interval);
      // Invalidate pending work on dismissal, replacement effects and unmount.
      ++pollVersion.current;
    };
  }, [dismissedAlerts]);

  return (
    <ZoneAlertContext.Provider value={{ alerts, dismissAlert }}>
      {children}
    </ZoneAlertContext.Provider>
  );
};
