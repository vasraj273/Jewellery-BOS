import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

export const quotationsApi = {
  list:      ()                 => api.get('/quotations').then(r => r.data.data),
  get:       (id)               => api.get(`/quotations/${id}`).then(r => r.data.data),
  create:    (payload)          => api.post('/quotations', payload).then(r => r.data.data),
  calculate: (payload)          => api.post('/quotations/calculate', payload).then(r => r.data.data),
  previewDraft: (payload)       => api.post('/quotations/preview-draft', payload, { responseType: 'text' }).then(r => r.data),
  remove:    (id)               => api.delete(`/quotations/${id}`).then(r => r.data),
  previewUrl: (id)              => `/api/quotations/${id}/preview`,
  pdfUrl:     (id)              => `/api/quotations/${id}/pdf`,
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

export const uploadsApi = {
  image: (file) => {
    const fd = new FormData();
    fd.append('image', file);
    return api.post('/uploads/image', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data.data);
  }
};
