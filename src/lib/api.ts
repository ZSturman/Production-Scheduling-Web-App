import axios from 'axios';
import { auth } from './firebase';

// API base - uses Next.js rewrite proxy in development
const API_BASE_URL = '';

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
      // Token expired or invalid - redirect to login
      if (typeof window !== 'undefined') {
        auth.signOut();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Products API
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

// Work Centers API
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

// Schedule API
export const scheduleApi = {
  recalculate: () => 
    api.post('/schedule/recalculate'),
  getGantt: (params?: Record<string, string>) => 
    api.get('/schedule/gantt', { params }),
  getSummary: () => 
    api.get('/schedule/summary'),
};

// Sync API
export const syncApi = {
  getStatus: () => 
    api.get('/sync/status'),
  trigger: (recalculate = false) => 
    api.post('/sync/trigger', {}, { params: { recalculate } }),
};

// Settings API
export const settingsApi = {
  get: () => 
    api.get('/settings'),
  update: (data: Record<string, unknown>) => 
    api.patch('/settings', data),
};

// Holidays API
export const holidaysApi = {
  list: () => 
    api.get('/holidays'),
  create: (data: Record<string, unknown>) => 
    api.post('/holidays', data),
  delete: (date: string) => 
    api.delete(`/holidays/${date}`),
};

// Organizations API
export const organizationsApi = {
  create: (name: string) => 
    api.post('/organizations', { name }),
  getMe: () => 
    api.get('/organizations/me'),
  invite: (email: string, role: string) => 
    api.post('/organizations/invite', { email, role }),
  getInvites: () => 
    api.get('/organizations/invites'),
  getInviteByCode: (code: string) => 
    api.get(`/organizations/invite/${code}`),
  join: (inviteCode: string) => 
    api.post('/organizations/join', { inviteCode }),
};

// Config API
export const configApi = {
  getGoogleSheets: () => 
    api.get('/config/google-sheets'),
  testGoogleSheets: (spreadsheetId: string, serviceAccountJson: string) => 
    api.post('/config/google-sheets/test', { spreadsheetId, serviceAccountJson }),
  validateGoogleSheets: (spreadsheetId: string, serviceAccountJson: string) => 
    api.post('/config/google-sheets/validate', { spreadsheetId, serviceAccountJson }),
  saveGoogleSheets: (spreadsheetId: string, serviceAccountJson: string) => 
    api.post('/config/google-sheets/save', { spreadsheetId, serviceAccountJson }),
  deleteGoogleSheets: () => 
    api.delete('/config/google-sheets'),
};

// Re-export type aliases for convenience
export type { Product, WorkCenter, GanttData, GanttTask, AppSettings as Settings } from '@/types';
