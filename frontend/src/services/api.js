import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => apiClient.post('/auth/register', data),
  login: (data) => apiClient.post('/auth/login', data),
  googleLogin: (data) => apiClient.post('/auth/google', data),
  getMe: () => apiClient.get('/auth/me'),
  updateProfile: (data) => apiClient.put('/auth/me', data),
  updatePassword: (data) => apiClient.put('/auth/password', data),
  logout: () => apiClient.post('/auth/logout'),
};

// Companies API
export const companiesAPI = {
  create: (data) => apiClient.post('/companies/', data),
  list: () => apiClient.get('/companies/'),
  get: (id) => apiClient.get(`/companies/${id}/`),
  update: (id, data) => apiClient.put(`/companies/${id}/`, data),
  delete: (id) => apiClient.delete(`/companies/${id}/`),
  getDashboard: (id) => apiClient.get(`/companies/${id}/dashboard`),
};

// Customers API - Note: trailing slash required to avoid 307 redirect losing auth header
export const customersAPI = {
  create: (companyId, data) => apiClient.post(`/customers/?company_id=${companyId}`, data),
  list: (companyId, search = '') => apiClient.get(`/customers/?company_id=${companyId}${search ? `&search=${search}` : ''}`),
  get: (companyId, id) => apiClient.get(`/customers/${id}?company_id=${companyId}`),
  update: (companyId, id, data) => apiClient.put(`/customers/${id}?company_id=${companyId}`, data),
  delete: (companyId, id) => apiClient.delete(`/customers/${id}?company_id=${companyId}`),
  getStats: (companyId, id) => apiClient.get(`/customers/${id}/stats?company_id=${companyId}`),
};

// Suppliers API - Note: trailing slash required to avoid 307 redirect losing auth header
export const suppliersAPI = {
  create: (companyId, data) => apiClient.post(`/suppliers/?company_id=${companyId}`, data),
  list: (companyId, search = '') => apiClient.get(`/suppliers/?company_id=${companyId}${search ? `&search=${search}` : ''}`),
  get: (companyId, id) => apiClient.get(`/suppliers/${id}?company_id=${companyId}`),
  update: (companyId, id, data) => apiClient.put(`/suppliers/${id}?company_id=${companyId}`, data),
  delete: (companyId, id) => apiClient.delete(`/suppliers/${id}?company_id=${companyId}`),
};

// Products API - Note: trailing slash required to avoid 307 redirect losing auth header
export const productsAPI = {
  create: (companyId, data) => apiClient.post(`/products/?company_id=${companyId}`, data),
  list: (companyId, params = {}) => {
    const queryParams = new URLSearchParams({ company_id: companyId, ...params }).toString();
    return apiClient.get(`/products/?${queryParams}`);
  },
  get: (companyId, id) => apiClient.get(`/products/${id}?company_id=${companyId}`),
  update: (companyId, id, data) => apiClient.put(`/products/${id}?company_id=${companyId}`, data),
  delete: (companyId, id) => apiClient.delete(`/products/${id}?company_id=${companyId}`),
  // Import/Export
  downloadTemplate: (companyId) => `${API}/products/export/template?company_id=${companyId}`,
  importProducts: (companyId, formData) => apiClient.post(`/products/import?company_id=${companyId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  exportStock: (companyId) => `${API}/products/export/stock?company_id=${companyId}`,
  exportPrices: (companyId) => `${API}/products/export/prices?company_id=${companyId}`,
  bulkDelete: (companyId, productIds) => apiClient.delete(`/products/bulk/delete?company_id=${companyId}`, { data: { product_ids: productIds } }),
  deleteAll: (companyId) => apiClient.delete(`/products/bulk/delete-all?company_id=${companyId}`),
};

// Warehouses API
export const warehousesAPI = {
  create: (companyId, data) => apiClient.post(`/warehouses/?company_id=${companyId}`, data),
  list: (companyId) => apiClient.get(`/warehouses/?company_id=${companyId}`),
  get: (companyId, id) => apiClient.get(`/warehouses/${id}?company_id=${companyId}`),
  update: (companyId, id, data) => apiClient.put(`/warehouses/${id}?company_id=${companyId}`, data),
  delete: (companyId, id) => apiClient.delete(`/warehouses/${id}?company_id=${companyId}`),
};

// Quotes API - Note: trailing slash required to avoid 307 redirect losing auth header
export const quotesAPI = {
  create: (companyId, data) => apiClient.post(`/quotes/?company_id=${companyId}`, data),
  list: (companyId, params = {}) => {
    const queryParams = new URLSearchParams({ company_id: companyId, ...params }).toString();
    return apiClient.get(`/quotes/?${queryParams}`);
  },
  get: (companyId, id) => apiClient.get(`/quotes/${id}?company_id=${companyId}`),
  update: (companyId, id, data) => apiClient.put(`/quotes/${id}?company_id=${companyId}`, data),
  delete: (companyId, id) => apiClient.delete(`/quotes/${id}?company_id=${companyId}`),
  convertToInvoice: (companyId, id) => apiClient.post(`/quotes/${id}/convert?company_id=${companyId}`),
};

// Invoices API - Note: trailing slash required to avoid 307 redirect losing auth header
export const invoicesAPI = {
  create: (companyId, data) => apiClient.post(`/invoices/?company_id=${companyId}`, data),
  list: (companyId, params = {}) => {
    const queryParams = new URLSearchParams({ company_id: companyId, ...params }).toString();
    return apiClient.get(`/invoices/?${queryParams}`);
  },
  get: (companyId, id) => apiClient.get(`/invoices/${id}?company_id=${companyId}`),
  update: (companyId, id, data) => apiClient.put(`/invoices/${id}?company_id=${companyId}`, data),
  delete: (companyId, id) => apiClient.delete(`/invoices/${id}?company_id=${companyId}`),
};

// Payments API - Note: trailing slash required to avoid 307 redirect losing auth header
export const paymentsAPI = {
  create: (companyId, data) => apiClient.post(`/payments/?company_id=${companyId}`, data),
  list: (companyId, type = null) => {
    const params = type ? `?company_id=${companyId}&type=${type}` : `?company_id=${companyId}`;
    return apiClient.get(`/payments/${params}`);
  },
  get: (companyId, id) => apiClient.get(`/payments/${id}?company_id=${companyId}`),
  delete: (companyId, id) => apiClient.delete(`/payments/${id}?company_id=${companyId}`),
};

// Projects API - Note: trailing slash required to avoid 307 redirect losing auth header
export const projectsAPI = {
  create: (companyId, data) => apiClient.post(`/projects/?company_id=${companyId}`, data),
  list: (companyId, status = null) => {
    const params = status ? `?company_id=${companyId}&status=${status}` : `?company_id=${companyId}`;
    return apiClient.get(`/projects/${params}`);
  },
  get: (companyId, id) => apiClient.get(`/projects/${id}?company_id=${companyId}`),
  update: (companyId, id, data) => apiClient.put(`/projects/${id}?company_id=${companyId}`, data),
  delete: (companyId, id) => apiClient.delete(`/projects/${id}?company_id=${companyId}`),
  createTimesheet: (companyId, projectId, data) => 
    apiClient.post(`/projects/${projectId}/timesheets?company_id=${companyId}`, data),
  listTimesheets: (companyId, projectId) => 
    apiClient.get(`/projects/${projectId}/timesheets?company_id=${companyId}`),
};

// Accounting API
export const accountingAPI = {
  // Chart of Accounts
  listAccounts: (companyId, params = {}) => {
    const queryParams = new URLSearchParams({ company_id: companyId, ...params }).toString();
    return apiClient.get(`/accounting/accounts?${queryParams}`);
  },
  getAccount: (companyId, id) => apiClient.get(`/accounting/accounts/${id}?company_id=${companyId}`),
  createAccount: (companyId, data) => apiClient.post(`/accounting/accounts?company_id=${companyId}`, data),
  updateAccount: (companyId, id, data) => apiClient.put(`/accounting/accounts/${id}?company_id=${companyId}`, data),
  deleteAccount: (companyId, id) => apiClient.delete(`/accounting/accounts/${id}?company_id=${companyId}`),
  getAccountTypes: () => apiClient.get('/accounting/account-types'),
  seedChartOfAccounts: (companyId) => apiClient.post(`/accounting/seed-chart-of-accounts?company_id=${companyId}`),
  // Dashboard
  getDashboard: (companyId) => apiClient.get(`/accounting/dashboard?company_id=${companyId}`),
  // General Ledger
  getGeneralLedger: (companyId, params = {}) => {
    const queryParams = new URLSearchParams({ company_id: companyId, ...params }).toString();
    return apiClient.get(`/accounting/general-ledger?${queryParams}`);
  },
  // Trial Balance
  getTrialBalance: (companyId, params = {}) => {
    const queryParams = new URLSearchParams({ company_id: companyId, ...params }).toString();
    return apiClient.get(`/accounting/trial-balance?${queryParams}`);
  },
};

// Journal Entries API
export const journalEntriesAPI = {
  list: (companyId, params = {}) => {
    const queryParams = new URLSearchParams({ company_id: companyId, ...params }).toString();
    return apiClient.get(`/journal-entries/?${queryParams}`);
  },
  get: (companyId, id) => apiClient.get(`/journal-entries/${id}?company_id=${companyId}`),
  create: (companyId, data) => apiClient.post(`/journal-entries/?company_id=${companyId}`, data),
  update: (companyId, id, data) => apiClient.put(`/journal-entries/${id}?company_id=${companyId}`, data),
  delete: (companyId, id) => apiClient.delete(`/journal-entries/${id}?company_id=${companyId}`),
  post: (companyId, id) => apiClient.post(`/journal-entries/${id}/post?company_id=${companyId}`),
  cancel: (companyId, id) => apiClient.post(`/journal-entries/${id}/cancel?company_id=${companyId}`),
  getStats: (companyId) => apiClient.get(`/journal-entries/stats?company_id=${companyId}`),
};

// PDF API
export const pdfAPI = {
  getInvoicePdfUrl: (companyId, invoiceId) => 
    `${API_BASE_URL}/pdf/invoice/${invoiceId}?company_id=${companyId}`,
  getQuotePdfUrl: (companyId, quoteId) => 
    `${API_BASE_URL}/pdf/quote/${quoteId}?company_id=${companyId}`,
  getDeliveryNotePdfUrl: (companyId, deliveryId) => 
    `${API_BASE_URL}/pdf/delivery-note/${deliveryId}?company_id=${companyId}`,
  downloadInvoice: (companyId, invoiceId) => 
    apiClient.get(`/pdf/invoice/${invoiceId}?company_id=${companyId}`, { responseType: 'blob' }),
  downloadQuote: (companyId, quoteId) => 
    apiClient.get(`/pdf/quote/${quoteId}?company_id=${companyId}`, { responseType: 'blob' }),
  downloadDeliveryNote: (companyId, deliveryId) => 
    apiClient.get(`/pdf/delivery-note/${deliveryId}?company_id=${companyId}`, { responseType: 'blob' }),
};

export default apiClient;
