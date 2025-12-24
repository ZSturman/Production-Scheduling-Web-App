import axios from 'axios';
import { auth } from './firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      auth.signOut();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API functions
export const productsApi = {
  list: (params?: Record<string, string>) => 
    api.get('/products', { params }),
  get: (jobNumber: string) => 
    api.get(`/products/${jobNumber}`),
  create: (data: Record<string, unknown>) => 
    api.post('/products', data),
  update: (jobNumber: string, data: Record<string, unknown>) => 
    api.patch(`/products/${jobNumber}`, data),
  lock: (jobNumber: string, reason: string) => 
    api.post(`/products/${jobNumber}/lock`, { reason }),
  unlock: (jobNumber: string) => 
    api.delete(`/products/${jobNumber}/lock`),
  reorder: (workCenter: string, orderedJobNumbers: string[]) => 
    api.post('/products/reorder', { workCenter, orderedJobNumbers }),
};

export const workCentersApi = {
  list: (includeInactive = false) => 
    api.get('/work-centers', { params: { includeInactive } }),
  get: (id: string) => 
    api.get(`/work-centers/${id}`),
  create: (data: Record<string, unknown>) => 
    api.post('/work-centers', data),
  update: (id: string, data: Record<string, unknown>) => 
    api.patch(`/work-centers/${id}`, data),
  getJobs: (id: string) => 
    api.get(`/work-centers/${id}/jobs`),
};

export const scheduleApi = {
  recalculate: () => 
    api.post('/schedule/recalculate'),
  getGantt: (params?: Record<string, string>) => 
    api.get('/schedule/gantt', { params }),
  getSummary: () => 
    api.get('/schedule/summary'),
};

export const syncApi = {
  getStatus: () => 
    api.get('/sync/status'),
  trigger: (recalculate = false) => 
    api.post('/sync/trigger', {}, { params: { recalculate } }),
  refresh: () => 
    api.post('/sync/refresh'),
};

export const settingsApi = {
  get: () => 
    api.get('/settings'),
  update: (data: Record<string, unknown>) => 
    api.patch('/settings', data),
};

export const holidaysApi = {
  list: (year?: string) => 
    api.get('/holidays', { params: { year } }),
  create: (data: Record<string, unknown>) => 
    api.post('/holidays', data),
  delete: (date: string) => 
    api.delete(`/holidays/${date}`),
};

export const auditApi = {
  list: (params?: Record<string, string>) => 
    api.get('/audit', { params }),
};

export const healthApi = {
  check: () => 
    api.get('/health'),
};
