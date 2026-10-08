const repository = require('../repositories/sensor.repository');

exports.addSensorData = async ({ animalCode, latitude, longitude, heartRate, temperature, activityLevel, recordedAt }) => {
  console.log('Adding sensor data for animal:', animalCode);
  
  // Find or create animal by code
  let animal = await repository.findAnimalByCode(animalCode);
  
  if (!animal) {
    // Create new animal if doesn't exist
    animal = await repository.createAnimal({
      animalCode,
      species: 'Unknown',
      name: null,
      sex: null,
      notes: 'Created from sensor data'
    });
  }

  // Find the latest location for this animal
  const latestLocation = await repository.findLatestLocationByAnimalId(animal.id);
  const recordedTime = recordedAt ? new Date(recordedAt) : new Date();
  
  // If latest location exists and is within 1 hour, update it
  if (latestLocation) {
    const timeDiff = recordedTime - new Date(latestLocation.recordedAt);
    const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
    
    if (timeDiff < oneHour) {
      console.log('Updating existing location for animal:', animalCode);
      const updatedLocation = await repository.updateAnimalLocation(latestLocation.id, {
        latitude,
        longitude,
        recordedAt: recordedTime,
        heartRate,
        temperature,
        activityLevel
      });
      return updatedLocation;
    }
  }

  // Otherwise create a new location
  console.log('Creating new location for animal:', animalCode);
  const location = await repository.createAnimalLocation({
    animalId: animal.id,
    latitude,
    longitude,
    recordedAt: recordedTime,
    heartRate,
    temperature,
    activityLevel,
    source: 'MOCK_COLLAR'
  });

  return location;
};

exports.createAnimal = async ({ animalCode, species, name, sex, notes }) => {
  console.log('Creating animal with data:', { animalCode, species, name, sex, notes });
  
  // Check if animal code already exists
  const existingAnimal = await repository.findAnimalByCode(animalCode);
  if (existingAnimal) {
    throw new Error(`Animal with code ${animalCode} already exists`);
  }
  
  const result = await repository.createAnimal({
    animalCode,
    species,
    name: name || null,
    sex: sex || null,
    notes: notes || null
  });
  console.log('Animal created successfully:', result);
  return result;
};

exports.getAllAnimals = async () => {
  return await repository.getAllAnimals();
};

exports.getAnimalsWithLatestLocations = async () => {
  return await repository.getAnimalsWithLatestLocations();
};

exports.getAnimalLocationsByDateRange = async (animalId, startDate, endDate) => {
  return await repository.getAnimalLocationsByDateRange(animalId, startDate, endDate);
};

exports.getAllLocationsByDateRange = async (startDate, endDate) => {
  return await repository.getAllLocationsByDateRange(startDate, endDate);
};

exports.getDensityZones = async (startDate, endDate, radiusMeters = 300) => {
  const locations = await repository.getAllLocationsByDateRange(startDate, endDate);
  return repository.calculateDensityZones(locations, radiusMeters);
};

exports.updateAnimal = async (id, { species, name, sex, notes }) => {
  return await repository.updateAnimal(id, { species, name, sex, notes });
};

exports.deleteAnimal = async (id) => {
  return await repository.deleteAnimal(id);
};

exports.getAnimalsNearHighRiskZones = async () => {
  const db = require('../config/database');
  
  // Get all HIGH and CRITICAL risk zones
  const riskZones = await db.riskZone.findMany({
    where: {
      riskLevel: { in: ['HIGH', 'CRITICAL'] },
      isActive: true
    },
    select: {
      id: true,
      centerLatitude: true,
      centerLongitude: true,
      radiusMeters: true
    }
  });

  if (riskZones.length === 0) {
    return 0;
  }

  // Get all animals with their latest locations
  const animalsWithLocations = await repository.getAnimalsWithLatestLocations();
  
  let count = 0;
  
  for (const animal of animalsWithLocations) {
    if (!animal.locations || animal.locations.length === 0) continue;
    
    const latestLocation = animal.locations[0];
    const animalLat = latestLocation.latitude;
    const animalLng = latestLocation.longitude;
    
    // Check if animal is within any high risk zone
    for (const zone of riskZones) {
      const distance = calculateDistance(
        animalLat, animalLng,
        zone.centerLatitude, zone.centerLongitude
      );
      
      if (distance <= zone.radiusMeters) {
        count++;
        break; // Count animal once even if in multiple zones
      }
    }
  }
  
  return count;
};

// Haversine formula to calculate distance between two coordinates in meters
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
