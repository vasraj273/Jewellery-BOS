import axios from 'axios';

/**
 * Base URL resolution:
 *   - Vite injects VITE_API_BASE_URL at build time (.env.production / .env.development).
 *   - Empty / unset → relative '/api' (works in dev via Vite proxy).
 *   - Set (e.g. https://jbos-api.onrender.com) → absolute calls against deployed backend.
 *
 * Trailing slash on VITE_API_BASE_URL is tolerated.
 */
const RAW_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const API_ROOT = `${RAW_BASE}/api`;

export const api = axios.create({
  baseURL: API_ROOT,
  timeout: 30000
});

// Auth token is injected by AuthContext via api.defaults.headers.common.Authorization.
// On any 401 from a request that actually carried a token, broadcast so
// AuthContext can clear state. Requests sent before the header is set should
// NOT trigger a forced logout — that would bounce the user mid-login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || '';
    const hadToken =
      !!(error?.config?.headers?.Authorization || error?.config?.headers?.authorization);
    if (status === 401 && hadToken && !url.includes('/auth/login')) {
      try { window.dispatchEvent(new Event('jbos:unauthorized')); } catch { /* ssr safety */ }
    }
    return Promise.reject(error);
  }
);

export const quotationsApi = {
  list:      (params = {})      => api.get('/quotations', { params }).then(r => r.data.data),
  get:       (id)               => api.get(`/quotations/${id}`).then(r => r.data.data),
  create:    (payload)          => api.post('/quotations', payload).then(r => r.data.data),
  calculate: (payload)          => api.post('/quotations/calculate', payload).then(r => r.data.data),
  previewDraft: (payload)       => api.post('/quotations/preview-draft', payload, { responseType: 'text' }).then(r => r.data),
  remove:    (id)               => api.delete(`/quotations/${id}`).then(r => r.data),

  // Auth-aware fetchers — go through axios so the JWT goes with them.
  // Plain <iframe src> / <a href> bypass interceptors and 401 on protected
  // endpoints. Components feed iframe via srcDoc and open PDF as a blob URL.
  previewHtml: (id)             => api.get(`/quotations/${id}/preview`, { responseType: 'text' }).then(r => r.data),
  pdfBlob:     (id)             => api.get(`/quotations/${id}/pdf`,     { responseType: 'blob' }).then(r => r.data),

  sendWhatsApp: (id)            => api.post(`/quotations/${id}/whatsapp/send`).then(r => r.data),
  whatsappConfig: ()            => api.get('/quotations/whatsapp/config').then(r => r.data.data)
};

export const ratesApi = {
  gold:                () => api.get('/rates/gold').then(r => r.data.data),
  goldLatest:          (location) => api.get('/rates/gold/latest', { params: location ? { location } : {} }).then(r => r.data.data),
  goldLocations:       () => api.get('/rates/gold/locations').then(r => r.data.data),
  goldConfig:          () => api.get('/rates/gold/config').then(r => r.data.data),
  goldRefresh:         () => api.post('/rates/gold/refresh').then(r => r.data.data),
  goldManual:          (payload) => api.post('/rates/gold/manual', payload).then(r => r.data.data),
  goldClearOverride:   (payload) => api.post('/rates/gold/clear-override', payload).then(r => r.data.data),
  diamond:             () => api.get('/rates/diamond').then(r => r.data.data),
  gemstone:            () => api.get('/rates/gemstone').then(r => r.data.data),
  making:              () => api.get('/rates/making').then(r => r.data.data)
};

export const usersApi = {
  list:          ()             => api.get('/users').then(r => r.data.data),
  create:        (payload)      => api.post('/users', payload).then(r => r.data.data),
  update:        (id, payload)  => api.put(`/users/${id}`, payload).then(r => r.data.data),
  resetPassword: (id, password) => api.put(`/users/${id}/password`, { password }).then(r => r.data),
  deactivate:    (id)           => api.delete(`/users/${id}`).then(r => r.data.data)
};

export const auditApi = {
  recent: (limit = 100) => api.get('/audit', { params: { limit } }).then(r => r.data.data)
};

export const settingsApi = {
  get:    ()        => api.get('/settings').then(r => r.data.data),
  update: (patch)   => api.put('/settings', patch).then(r => r.data.data)
};

export const mastersApi = {
  // type ∈ product_categories | metal_types | purities | diamond_types | cities | making_presets
  list:        (type, { all = false } = {}) =>
    api.get(`/masters/${type}`, { params: all ? { all: 1 } : {} }).then(r => r.data.data),
  create:      (type, payload)     => api.post(`/masters/${type}`, payload).then(r => r.data.data),
  update:      (type, id, payload) => api.put(`/masters/${type}/${id}`, payload).then(r => r.data.data),
  deactivate:  (type, id)          => api.delete(`/masters/${type}/${id}`).then(r => r.data.data)
};

export const leadsApi = {
  list:        (params = {})        => api.get('/leads', { params }).then(r => r.data.data),
  get:         (id)                 => api.get(`/leads/${id}`).then(r => r.data.data),
  create:      (payload)            => api.post('/leads', payload).then(r => r.data.data),
  update:      (id, payload)        => api.put(`/leads/${id}`, payload).then(r => r.data.data),
  followups:   (id)                 => api.get(`/leads/${id}/followups`).then(r => r.data.data),
  addFollowup: (id, payload)        => api.post(`/leads/${id}/followups`, payload).then(r => r.data.data),
  stats:       ()                   => api.get('/leads/stats').then(r => r.data.data),
  sources:     ()                   => api.get('/leads/sources').then(r => r.data.data),
  statuses:    ()                   => api.get('/leads/statuses').then(r => r.data.data)
};

export const uploadsApi = {
  image: (file) => {
    const fd = new FormData();
    fd.append('image', file);
    return api.post('/uploads/image', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data.data);
  }
};
