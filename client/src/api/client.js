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

/**
 * Resolve a server-stored asset path (e.g. uploaded document `/uploads/x.pdf`)
 * to an absolute URL on the API origin. Without this, a relative `/uploads/...`
 * href resolves against the CLIENT origin (jbos-client) where the file does not
 * exist, so the document opens as "Not Found". Already-absolute URLs pass through.
 */
export function assetUrl(p) {
  if (!p) return p;
  if (/^https?:\/\//i.test(p)) return p;
  return `${RAW_BASE}${p.startsWith('/') ? '' : '/'}${p}`;
}

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
  updateImage: (id, product_image_path) => api.patch(`/quotations/${id}/image`, { product_image_path }).then(r => r.data.data),

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
  deactivate:    (id)           => api.put(`/users/${id}`, { is_active: false }).then(r => r.data.data),
  remove:        (id, purge = false) => api.delete(`/users/${id}`, { params: { purge } }).then(r => r.data.data)
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

export const customersApi = {
  list:      (params = {})   => api.get('/customers', { params }).then(r => r.data.data),
  get:       (id)            => api.get(`/customers/${id}`).then(r => r.data.data),
  update:    (id, payload)   => api.put(`/customers/${id}`, payload).then(r => r.data.data),
  events:    (id)            => api.get(`/customers/${id}/events`).then(r => r.data.data),
  addEvent:  (id, payload)   => api.post(`/customers/${id}/events`, payload).then(r => r.data.data),
  addReminder: (id, payload) => api.post(`/customers/${id}/reminders`, payload).then(r => r.data.data),
  stats:     ()              => api.get('/customers/stats').then(r => r.data.data)
};

export const remindersApi = {
  list:      (params = {})   => api.get('/reminders', { params }).then(r => r.data.data),
  dashboard: ()              => api.get('/reminders/dashboard').then(r => r.data.data),
  markDone:  (id)            => api.put(`/reminders/${id}`, { status: 'done' }).then(r => r.data.data)
};

export const analyticsApi = {
  sales:       () => api.get('/analytics/sales').then(r => r.data.data),
  conversion:  () => api.get('/analytics/conversion').then(r => r.data.data),
  performance: (params = {}) => api.get('/analytics/performance', { params }).then(r => r.data.data)
};

export const employeesApi = {
  list:       (params = {}) => api.get('/employees', { params }).then(r => r.data.data),
  get:        (id)          => api.get(`/employees/${id}`).then(r => r.data.data),
  create:     (payload)     => api.post('/employees', payload).then(r => r.data.data),
  update:     (id, payload) => api.put(`/employees/${id}`, payload).then(r => r.data.data),
  deactivate: (id)          => api.delete(`/employees/${id}`).then(r => r.data.data),
  // compensation
  getComp:    (id)          => api.get(`/employees/${id}/compensation`).then(r => r.data.data),
  saveComp:   (id, payload) => api.put(`/employees/${id}/compensation`, payload).then(r => r.data.data),
  // documents
  docs:       (id)          => api.get(`/employees/${id}/documents`).then(r => r.data.data),
  addDoc:     (id, payload) => api.post(`/employees/${id}/documents`, payload).then(r => r.data.data),
  removeDoc:  (docId)       => api.delete(`/employees/documents/${docId}`).then(r => r.data.data)
};

export const shiftsApi = {
  list:       (params = {})       => api.get('/shifts', { params }).then(r => r.data.data),
  create:     (payload)           => api.post('/shifts', payload).then(r => r.data.data),
  update:     (id, payload)       => api.put(`/shifts/${id}`, payload).then(r => r.data.data),
  deactivate: (id)                => api.delete(`/shifts/${id}`).then(r => r.data.data),
  activate:   (id)                => api.put(`/shifts/${id}/activate`).then(r => r.data.data),
  assign:     (employeeId, shiftId) => api.put(`/shifts/assign/${employeeId}`, { shift_id: shiftId }).then(r => r.data.data)
};

export const tasksApi = {
  list:      (params = {}) => api.get('/tasks', { params }).then(r => r.data.data),
  create:    (payload)     => api.post('/tasks', payload).then(r => r.data.data),
  update:    (id, payload) => api.put(`/tasks/${id}`, payload).then(r => r.data.data),
  dashboard: ()            => api.get('/tasks/dashboard').then(r => r.data.data)
};

export const incentivesApi = {
  list:      (params = {}) => api.get('/incentives', { params }).then(r => r.data.data),
  create:    (payload)     => api.post('/incentives', payload).then(r => r.data.data),
  setStatus: (id, status)  => api.put(`/incentives/${id}`, { status }).then(r => r.data.data),
  dashboard: ()            => api.get('/incentives/dashboard').then(r => r.data.data),
  mySummary: ()            => api.get('/incentives/my-summary').then(r => r.data.data)
};

export const hrCalendarApi = {
  month:       (month)       => api.get('/hr-calendar', { params: month ? { month } : {} }).then(r => r.data.data),
  createEvent: (payload)     => api.post('/hr-calendar/events', payload).then(r => r.data.data),
  updateEvent: (id, payload) => api.put(`/hr-calendar/events/${id}`, payload).then(r => r.data.data),
  deleteEvent: (id)          => api.delete(`/hr-calendar/events/${id}`).then(r => r.data.data)
};

export const docUploadApi = {
  upload: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/uploads/document', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data.data);
  }
};

export const attendanceApi = {
  list:    (params = {}) => api.get('/attendance', { params }).then(r => r.data.data),
  mark:    (payload)     => api.post('/attendance', payload).then(r => r.data.data),
  edit:    (id, payload) => api.put(`/attendance/${id}`, payload).then(r => r.data.data),
  today:   ()            => api.get('/attendance/today').then(r => r.data.data),
  myToday: ()            => api.get('/attendance/my-today').then(r => r.data.data)
};

export const leavesApi = {
  list:      (params = {}) => api.get('/leaves', { params }).then(r => r.data.data),
  request:   (payload)     => api.post('/leaves', payload).then(r => r.data.data),
  decide:    (id, status)  => api.put(`/leaves/${id}`, { status }).then(r => r.data.data),
  dashboard: ()            => api.get('/leaves/dashboard').then(r => r.data.data)
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

// ── M8 — Inventory + Procurement ──────────────────────────────
export const inventoryApi = {
  list:      (params = {}) => api.get('/inventory', { params }).then(r => r.data.data),
  get:       (id)          => api.get(`/inventory/${id}`).then(r => r.data.data),
  create:    (payload)     => api.post('/inventory', payload).then(r => r.data.data),
  update:    (id, payload) => api.put(`/inventory/${id}`, payload).then(r => r.data.data),
  archive:   (id)          => api.delete(`/inventory/${id}`).then(r => r.data.data),
  movement:  (id, payload) => api.post(`/inventory/${id}/movement`, payload).then(r => r.data.data),
  reserve:   (id, payload) => api.post(`/inventory/${id}/reserve`, payload).then(r => r.data.data),
  release:   (id)          => api.post(`/inventory/${id}/release`).then(r => r.data.data),
  sell:      (id, payload) => api.post(`/inventory/${id}/sell`, payload).then(r => r.data.data),
  summary:   ()            => api.get('/inventory/summary').then(r => r.data.data),
  alerts:    (params = {}) => api.get('/inventory/alerts', { params }).then(r => r.data.data)
};

export const suppliersApi = {
  list:       (params = {}) => api.get('/suppliers', { params }).then(r => r.data.data),
  get:        (id)          => api.get(`/suppliers/${id}`).then(r => r.data.data),
  create:     (payload)     => api.post('/suppliers', payload).then(r => r.data.data),
  update:     (id, payload) => api.put(`/suppliers/${id}`, payload).then(r => r.data.data),
  deactivate: (id)          => api.delete(`/suppliers/${id}`).then(r => r.data.data),
  activate:   (id)          => api.put(`/suppliers/${id}/activate`).then(r => r.data.data)
};

export const purchasesApi = {
  list:   (params = {}) => api.get('/purchases', { params }).then(r => r.data.data),
  get:    (id)          => api.get(`/purchases/${id}`).then(r => r.data.data),
  create: (payload)     => api.post('/purchases', payload).then(r => r.data.data)
};

// ── M9 — Sales Orders + Production + Job Work + Repairs ────────
export const salesOrdersApi = {
  list:       (params = {}) => api.get('/sales-orders', { params }).then(r => r.data.data),
  get:        (id)          => api.get(`/sales-orders/${id}`).then(r => r.data.data),
  fromQuote:  (quoteId, payload = {}) => api.post(`/sales-orders/from-quote/${quoteId}`, payload).then(r => r.data.data),
  create:     (payload)     => api.post('/sales-orders', payload).then(r => r.data.data),
  update:     (id, payload) => api.put(`/sales-orders/${id}`, payload).then(r => r.data.data),
  setStatus:  (id, status)  => api.put(`/sales-orders/${id}/status`, { status }).then(r => r.data.data),
  dashboard:  ()            => api.get('/sales-orders/dashboard').then(r => r.data.data)
};

export const productionApi = {
  list:          (params = {}) => api.get('/production', { params }).then(r => r.data.data),
  get:           (id)          => api.get(`/production/${id}`).then(r => r.data.data),
  setStage:      (id, payload) => api.put(`/production/${id}/stage`, payload).then(r => r.data.data),
  update:        (id, payload) => api.put(`/production/${id}`, payload).then(r => r.data.data),
  finishedStock: (id, payload) => api.post(`/production/${id}/finished-stock`, payload).then(r => r.data.data),
  alerts:        ()            => api.get('/production/alerts').then(r => r.data.data)
};

export const karigarsApi = {
  list:       (params = {}) => api.get('/karigars', { params }).then(r => r.data.data),
  get:        (id)          => api.get(`/karigars/${id}`).then(r => r.data.data),
  create:     (payload)     => api.post('/karigars', payload).then(r => r.data.data),
  update:     (id, payload) => api.put(`/karigars/${id}`, payload).then(r => r.data.data),
  deactivate: (id)          => api.delete(`/karigars/${id}`).then(r => r.data.data),
  activate:   (id)          => api.put(`/karigars/${id}/activate`).then(r => r.data.data)
};

export const jobWorksApi = {
  list:      (params = {}) => api.get('/job-works', { params }).then(r => r.data.data),
  get:       (id)          => api.get(`/job-works/${id}`).then(r => r.data.data),
  create:    (payload)     => api.post('/job-works', payload).then(r => r.data.data),
  update:    (id, payload) => api.put(`/job-works/${id}`, payload).then(r => r.data.data),
  dashboard: ()            => api.get('/job-works/dashboard').then(r => r.data.data)
};

export const repairsApi = {
  list:      (params = {}) => api.get('/repairs', { params }).then(r => r.data.data),
  get:       (id)          => api.get(`/repairs/${id}`).then(r => r.data.data),
  create:    (payload)     => api.post('/repairs', payload).then(r => r.data.data),
  update:    (id, payload) => api.put(`/repairs/${id}`, payload).then(r => r.data.data),
  dashboard: ()            => api.get('/repairs/dashboard').then(r => r.data.data)
};

// ── M10 — Finance + Accounts + Billing ────────────────────────
export const accountsApi = {
  groups:        ()              => api.get('/accounts/groups').then(r => r.data.data),
  list:          (params = {})   => api.get('/accounts', { params }).then(r => r.data.data),
  create:        (payload)       => api.post('/accounts', payload).then(r => r.data.data),
  update:        (id, payload)   => api.put(`/accounts/${id}`, payload).then(r => r.data.data),
  deactivate:    (id)            => api.delete(`/accounts/${id}`).then(r => r.data.data),
  journals:      (params = {})   => api.get('/accounts/journals', { params }).then(r => r.data.data),
  journal:       (id)            => api.get(`/accounts/journals/${id}`).then(r => r.data.data),
  createJournal: (payload)       => api.post('/accounts/journals', payload).then(r => r.data.data),
  ledger:        (accountId, params = {}) => api.get(`/accounts/ledger/${accountId}`, { params }).then(r => r.data.data)
};

export const paymentsApi = {
  forSalesOrder:   (soId)        => api.get(`/payments/sales-order/${soId}`).then(r => r.data.data),
  customerList:    (params = {}) => api.get('/payments/customer', { params }).then(r => r.data.data),
  supplierList:    (params = {}) => api.get('/payments/supplier', { params }).then(r => r.data.data),
  supplierSummary: ()            => api.get('/payments/supplier-summary').then(r => r.data.data),
  forSupplier:     (id)          => api.get(`/payments/supplier/${id}`).then(r => r.data.data),
  createCustomer:  (payload)     => api.post('/payments/customer', payload).then(r => r.data.data),
  createSupplier:  (payload)     => api.post('/payments/supplier', payload).then(r => r.data.data)
};

export const expensesApi = {
  list:   (params = {}) => api.get('/expenses', { params }).then(r => r.data.data),
  create: (payload)     => api.post('/expenses', payload).then(r => r.data.data)
};

export const invoicesApi = {
  list:        (params = {}) => api.get('/invoices', { params }).then(r => r.data.data),
  get:         (id)          => api.get(`/invoices/${id}`).then(r => r.data.data),
  fromSO:      (soId, payload = {}) => api.post(`/invoices/from-so/${soId}`, payload).then(r => r.data.data),
  pdfBlob:     (id)          => api.get(`/invoices/${id}/pdf`, { responseType: 'blob' }).then(r => r.data)
};

export const financeApi = {
  dashboard: () => api.get('/finance/dashboard').then(r => r.data.data)
};
