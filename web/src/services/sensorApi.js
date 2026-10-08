import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  timeout: 10000,
});

export const getAnimalsWithLatestLocations = async () => {
  const response = await api.get('/sensors/animals/locations');
  return response.data;
};

export const getAllAnimals = async () => {
  const response = await api.get('/sensors/animals');
  return response.data;
};

export const getAnimalLocationsByDateRange = async (animalId, startDate, endDate) => {
  const response = await api.get(`/sensors/animals/${animalId}/locations`, {
    params: { startDate, endDate }
  });
  return response.data;
};

export const getAllLocationsByDateRange = async (startDate, endDate) => {
  const response = await api.get('/sensors/locations', {
    params: { startDate, endDate }
  });
  return response.data;
};

export const getDensityZones = async (startDate, endDate, radius = 300) => {
  const response = await api.get('/sensors/zones/density', {
    params: { startDate, endDate, radius }
  });
  return response.data;
};

export default api;
