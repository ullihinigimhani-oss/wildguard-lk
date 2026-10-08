import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  timeout: 10000,
});

export const getAllRiskZones = async () => {
  const response = await api.get('/risk-zones');
  return response.data;
};

export const createRiskZone = async (data) => {
  const response = await api.post('/risk-zones', data);
  return response.data;
};

export const updateRiskZone = async (id, data) => {
  const response = await api.put(`/risk-zones/${id}`, data);
  return response.data;
};

export const deleteRiskZone = async (id) => {
  const response = await api.delete(`/risk-zones/${id}`);
  return response.data;
};

export default api;
