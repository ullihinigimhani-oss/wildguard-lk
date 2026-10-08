const db = () => require('../config/database');

exports.findAnimalByCode = (animalCode) =>
  db().animal.findUnique({ where: { animalCode } });

exports.createAnimal = (data) =>
  db().animal.create({ data });

exports.createAnimalLocation = (data) =>
  db().animalLocation.create({ data });

exports.findLatestLocationByAnimalId = (animalId) =>
  db().animalLocation.findFirst({
    where: { animalId },
    orderBy: { recordedAt: 'desc' }
  });

exports.updateAnimalLocation = (id, data) =>
  db().animalLocation.update({
    where: { id },
    data
  });

exports.getAllAnimals = () =>
  db().animal.findMany({
    include: {
      locations: {
        orderBy: { recordedAt: 'desc' },
        take: 1
      },
      collar: true
    }
  });

exports.getAnimalsWithLatestLocations = () =>
  db().animal.findMany({
    include: {
      locations: {
        orderBy: { recordedAt: 'desc' },
        take: 1
      }
    }
  });

exports.getAnimalLocationsByDateRange = (animalId, startDate, endDate) =>
  db().animalLocation.findMany({
    where: {
      animalId,
      recordedAt: {
        gte: startDate,
        lte: endDate
      }
    },
    orderBy: { recordedAt: 'asc' }
  });

exports.getAllLocationsByDateRange = (startDate, endDate) =>
  db().animalLocation.findMany({
    where: {
      recordedAt: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      animal: true
    },
    orderBy: { recordedAt: 'asc' }
  });

exports.calculateDensityZones = (locations, radiusMeters = 300) => {
  const zones = [];
  const processed = new Set();

  locations.forEach((loc1, i) => {
    if (processed.has(i)) return;

    const species = loc1.animal?.species;
    if (!species) return;

    // Count animals of same species within radius
    const nearbyAnimals = [i];
    locations.forEach((loc2, j) => {
      if (i === j) return;
      if (loc2.animal?.species !== species) return;

      const distance = calculateDistance(
        loc1.latitude,
        loc1.longitude,
        loc2.latitude,
        loc2.longitude
      );

      if (distance <= radiusMeters) {
        nearbyAnimals.push(j);
      }
    });

    // If 3+ animals of same species in area, create a zone
    if (nearbyAnimals.length >= 3) {
      nearbyAnimals.forEach(idx => processed.add(idx));

      // Calculate center point of the cluster
      const centerLat = nearbyAnimals.reduce((sum, idx) => sum + locations[idx].latitude, 0) / nearbyAnimals.length;
      const centerLng = nearbyAnimals.reduce((sum, idx) => sum + locations[idx].longitude, 0) / nearbyAnimals.length;

      zones.push({
        species,
        center: { latitude: centerLat, longitude: centerLng },
        radius: radiusMeters,
        animalCount: nearbyAnimals.length,
        animalCodes: nearbyAnimals.map(idx => locations[idx].animal?.animalCode).filter(Boolean)
      });
    }
  });

  return zones;
};

// Haversine formula to calculate distance between two points in meters
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

exports.updateAnimal = (id, data) =>
  db().animal.update({
    where: { id },
    data
  });

exports.deleteAnimal = (id) =>
  db().animal.delete({
    where: { id }
  });
