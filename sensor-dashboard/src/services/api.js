import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 10000,
});

export const addSensorData = async (data) => {
  const response = await api.post('/sensors', data);
  return response.data;
};

export const createAnimal = async (data) => {
  const response = await api.post('/sensors/animals', data);
  return response.data;
};

export const getAllAnimals = async () => {
  const response = await api.get('/sensors/animals');
  return response.data;
};

export const updateAnimal = async (id, data) => {
  const response = await api.put(`/sensors/animals/${id}`, data);
  return response.data;
};

export const deleteAnimal = async (id) => {
  const response = await api.delete(`/sensors/animals/${id}`);
  return response.data;
};

export default api;
