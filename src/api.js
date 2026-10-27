import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  timeout: 15000,
});

API.interceptors.request.use((request) => {
  const token = localStorage.getItem('token');
  if (token) request.headers.Authorization = `Bearer ${token}`;
  return request;
});

export const loginUser = (credentials) => API.post('/auth/login', credentials);
export const registerUser = (userData) => API.post('/auth/register', userData);
export const getShipments = (params = {}) => API.get('/shipments', { params });
export const createShipment = (shipment) => API.post('/shipments', shipment);
export const updateShipment = (id, changes) => API.put(`/shipments/${id}`, changes);
export const updateShipmentStatus = (id, status) => API.patch(`/shipments/${id}/status`, { status });
export const deleteShipment = (id) => API.delete(`/shipments/${id}`);

export default API;
