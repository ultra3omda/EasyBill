import axios from 'axios';

// REACT_APP_USE_PROXY=true : requêtes via proxy (same-origin, pas de CORS)
const USE_PROXY = process.env.REACT_APP_USE_PROXY === 'true';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = USE_PROXY ? '/api' : `${BACKEND_URL}/api`;

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
      // Ne pas rediriger si c'est une requête de login (login, google, facebook, register)
      const isAuthRequest = error.config?.url && /^\/auth\/(login|google|facebook|register)/.test(error.config.url);
      if (!isAuthRequest) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => apiClient.post('/auth/register', data),
  login: (data) => apiClient.post('/auth/login', data),
  googleLogin: (data) => apiClient.post('/auth/google', data, { timeout: 20000 }),
  facebookLogin: (data) => apiClient.post('/auth/facebook', data),
  forgotPassword: (data) => apiClient.post('/auth/forgot-password', data),
  resetPassword: (data) => apiClient.post('/auth/reset-password', data),
  verifyEmail: (token) => apiClient.post(`/auth/verify-email/${token}`),
  resendVerification: (data) => apiClient.post('/auth/resend-verification', data),
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

// Import/Export API
export const importExportAPI = {
  importCustomers: (companyId, formData) => apiClient.post(`/import-export/customers/import?company_id=${companyId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  importOdooInvoices: (companyId, formData, params = {}) => {
    const q = new URLSearchParams({ company_id: companyId, ...params }).toString();
    return apiClient.post(`/import-export/odoo-invoices/import?${q}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  getOdooInvoicesTemplate: () => apiClient.get('/import-export/odoo-invoices/template', { responseType: 'blob' }),
};

// Seed API - Generate test data
export const seedAPI = {
  generateTestData: (companyId) => apiClient.post(`/seed/test-data?company_id=${companyId}`),
};

// Dashboard API - Real statistics
export const dashboardAPI = {
  getStats: (companyId) => apiClient.get(`/dashboard/stats?company_id=${companyId}`),
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
  getPendingInvoices: (companyId, customerId = null) => {
    const params = customerId
      ? `?company_id=${companyId}&customer_id=${customerId}`
      : `?company_id=${companyId}`;
    return apiClient.get(`/payments/pending-invoices${params}`);
  },
  get: (companyId, id) => apiClient.get(`/payments/${id}?company_id=${companyId}`),
  delete: (companyId, id) => apiClient.delete(`/payments/${id}?company_id=${companyId}`),
};

// Delivery Notes API
export const deliveryNotesAPI = {
  create: (companyId, data) => apiClient.post(`/delivery-notes/?company_id=${companyId}`, data),
  list: (companyId) => apiClient.get(`/delivery-notes/?company_id=${companyId}`),
  get: (companyId, id) => apiClient.get(`/delivery-notes/${id}?company_id=${companyId}`),
  update: (companyId, id, data) => apiClient.put(`/delivery-notes/${id}?company_id=${companyId}`, data),
  delete: (companyId, id) => apiClient.delete(`/delivery-notes/${id}?company_id=${companyId}`),
  deliver: (companyId, id) => apiClient.post(`/delivery-notes/${id}/deliver?company_id=${companyId}`),
};

// Projects API - Note: trailing slash required to avoid 307 redirect losing auth header
export const projectsAPI = {
  // Projects
  create: (companyId, data) => apiClient.post(`/projects/?company_id=${companyId}`, data),
  list: (companyId, status = null) => {
    const params = status ? `?company_id=${companyId}&status=${status}` : `?company_id=${companyId}`;
    return apiClient.get(`/projects/${params}`);
  },
  get: (companyId, id) => apiClient.get(`/projects/${id}?company_id=${companyId}`),
  update: (companyId, id, data) => apiClient.put(`/projects/${id}?company_id=${companyId}`, data),
  delete: (companyId, id) => apiClient.delete(`/projects/${id}?company_id=${companyId}`),
  getStats: (companyId) => apiClient.get(`/projects/stats?company_id=${companyId}`),
  
  // Tasks
  listTasks: (companyId, projectId) => 
    apiClient.get(`/projects/${projectId}/tasks?company_id=${companyId}`),
  createTask: (companyId, projectId, data) => 
    apiClient.post(`/projects/${projectId}/tasks?company_id=${companyId}`, data),
  updateTask: (companyId, projectId, taskId, data) => 
    apiClient.put(`/projects/${projectId}/tasks/${taskId}?company_id=${companyId}`, data),
  deleteTask: (companyId, projectId, taskId) => 
    apiClient.delete(`/projects/${projectId}/tasks/${taskId}?company_id=${companyId}`),
  
  // Timesheets
  listTimesheets: (companyId, projectId) => 
    apiClient.get(`/projects/${projectId}/timesheets?company_id=${companyId}`),
  createTimesheet: (companyId, projectId, data) => 
    apiClient.post(`/projects/${projectId}/timesheets?company_id=${companyId}`, data),
  deleteTimesheet: (companyId, projectId, timesheetId) => 
    apiClient.delete(`/projects/${projectId}/timesheets/${timesheetId}?company_id=${companyId}`),
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

// Taxes API
export const taxesAPI = {
  list: (companyId) => apiClient.get(`/settings/taxes/${companyId}`),
  create: (companyId, data) => apiClient.post(`/settings/taxes/${companyId}`, data),
  update: (companyId, id, data) => apiClient.put(`/settings/taxes/${id}`, data),
  delete: (companyId, id) => apiClient.delete(`/settings/taxes/${id}`),
};

// PDF API
export const pdfAPI = {
  getInvoicePdfUrl: (companyId, invoiceId) => 
    `${BACKEND_URL}/pdf/invoice/${invoiceId}?company_id=${companyId}`,
  getQuotePdfUrl: (companyId, quoteId) => 
    `${BACKEND_URL}/pdf/quote/${quoteId}?company_id=${companyId}`,
  getDeliveryNotePdfUrl: (companyId, deliveryId) => 
    `${BACKEND_URL}/pdf/delivery-note/${deliveryId}?company_id=${companyId}`,
  downloadInvoice: (companyId, invoiceId) => 
    apiClient.get(`/pdf/invoice/${invoiceId}?company_id=${companyId}`, { responseType: 'blob' }),
  downloadQuote: (companyId, quoteId) => 
    apiClient.get(`/pdf/quote/${quoteId}?company_id=${companyId}`, { responseType: 'blob' }),
  downloadDeliveryNote: (companyId, deliveryId) => 
    apiClient.get(`/pdf/delivery-note/${deliveryId}?company_id=${companyId}`, { responseType: 'blob' }),
};

// ── Nouveaux modules ────────────────────────────────────────────────────

// A - Cash Accounts API
export const cashAPI = {
  listAccounts: (companyId, accountType) => apiClient.get(`/cash/accounts?company_id=${companyId}${accountType ? `&account_type=${accountType}` : ''}`),
  getAccount: (companyId, id) => apiClient.get(`/cash/accounts/${id}?company_id=${companyId}`),
  createAccount: (companyId, data) => apiClient.post(`/cash/accounts?company_id=${companyId}`, data),
  updateAccount: (companyId, id, data) => apiClient.put(`/cash/accounts/${id}?company_id=${companyId}`, data),
  deleteAccount: (companyId, id) => apiClient.delete(`/cash/accounts/${id}?company_id=${companyId}`),
  recordTransaction: (companyId, data) => apiClient.post(`/cash/transactions?company_id=${companyId}`, data),
  recordExpense: (companyId, data) => apiClient.post(`/cash/expenses?company_id=${companyId}`, data),
  listTransactions: (companyId, params = {}) => {
    const q = new URLSearchParams({ company_id: companyId, ...params }).toString();
    return apiClient.get(`/cash/transactions?${q}`);
  },
  getCustomerBalances: (companyId, params = {}) => {
    const q = new URLSearchParams({ company_id: companyId, ...params }).toString();
    return apiClient.get(`/cash/customer-balances?${q}`);
  },
  getUnpaidInvoices: (companyId, params = {}) => {
    const q = new URLSearchParams({ company_id: companyId, ...params }).toString();
    return apiClient.get(`/cash/unpaid-invoices?${q}`);
  },
  getDailyReport: (companyId, date) => {
    const q = new URLSearchParams({ company_id: companyId, ...(date ? { report_date: date } : {}) }).toString();
    return apiClient.get(`/cash/daily-report?${q}`);
  },
};

// B - Chatbot API
export const chatbotAPI = {
  sendMessage: (companyId, data) => apiClient.post(`/chatbot/message?company_id=${companyId}`, data),
  getLogs: (companyId, limit = 50) => apiClient.get(`/chatbot/logs?company_id=${companyId}&limit=${limit}`),
  getHistory: (companyId, limit = 20) => apiClient.get(`/chatbot/history?company_id=${companyId}&limit=${limit}`),
  getIntents: () => apiClient.get('/chatbot/intents'),
};

// C - Country Config API
export const countryConfigAPI = {
  listCountries: () => apiClient.get('/country-config/countries'),
  getCountry: (code) => apiClient.get(`/country-config/countries/${code}`),
  getCompanySettings: (companyId) => apiClient.get(`/country-config/company-settings?company_id=${companyId}`),
  updateCompanySettings: (companyId, data) => apiClient.put(`/country-config/company-settings?company_id=${companyId}`, data),
  listTaxRates: (companyId, params = {}) => {
    const q = new URLSearchParams({ company_id: companyId, ...params }).toString();
    return apiClient.get(`/country-config/tax-rates?${q}`);
  },
  createTaxRate: (companyId, data) => apiClient.post(`/country-config/tax-rates?company_id=${companyId}`, data),
  initializeCountry: (companyId, countryCode) => apiClient.post(`/country-config/initialize/${countryCode}?company_id=${companyId}`),
};

// D - Reminder Engine API
export const reminderEngineAPI = {
  initialize: (companyId) => apiClient.post(`/reminder-engine/initialize?company_id=${companyId}`),
  listRules: (companyId) => apiClient.get(`/reminder-engine/rules?company_id=${companyId}`),
  createRule: (companyId, data) => apiClient.post(`/reminder-engine/rules?company_id=${companyId}`, data),
  listTemplates: (companyId) => apiClient.get(`/reminder-engine/templates?company_id=${companyId}`),
  createTemplate: (companyId, data) => apiClient.post(`/reminder-engine/templates?company_id=${companyId}`, data),
  detect: (companyId) => apiClient.get(`/reminder-engine/detect?company_id=${companyId}`),
  generatePayload: (companyId, invoiceId, level) =>
    apiClient.post(`/reminder-engine/generate-payload/${invoiceId}?company_id=${companyId}&level=${level}`),
  process: (companyId, dryRun = false) =>
    apiClient.post(`/reminder-engine/process?company_id=${companyId}&dry_run=${dryRun}`),
  getLogs: (companyId, invoiceId) => {
    const q = new URLSearchParams({ company_id: companyId, ...(invoiceId ? { invoice_id: invoiceId } : {}) }).toString();
    return apiClient.get(`/reminder-engine/logs?${q}`);
  },
};

// Collaborators API
export const collaboratorsAPI = {
  list: (companyId, params = {}) => {
    const q = new URLSearchParams({ company_id: companyId, ...params }).toString();
    return apiClient.get(`/collaborators/?${q}`);
  },
  get: (companyId, id) => apiClient.get(`/collaborators/${id}?company_id=${companyId}`),
  getRoles: () => apiClient.get('/collaborators/roles'),
  invite: (companyId, data) => apiClient.post(`/collaborators/invite?company_id=${companyId}`, data),
  update: (companyId, id, data) => apiClient.put(`/collaborators/${id}?company_id=${companyId}`, data),
  suspend: (companyId, id) => apiClient.post(`/collaborators/${id}/suspend?company_id=${companyId}`),
  reactivate: (companyId, id) => apiClient.post(`/collaborators/${id}/reactivate?company_id=${companyId}`),
  revoke: (companyId, id) => apiClient.post(`/collaborators/${id}/revoke?company_id=${companyId}`),
  resendInvitation: (companyId, id) => apiClient.post(`/collaborators/${id}/resend-invitation?company_id=${companyId}`),
  delete: (companyId, id) => apiClient.delete(`/collaborators/${id}?company_id=${companyId}`),
  getMyPermissions: (companyId) => apiClient.get(`/collaborators/me/permissions?company_id=${companyId}`),
};

// E - AI Assistant API
export const aiAPI = {
  status: () => apiClient.get('/ai/status'),
  parseInvoice: (companyId, text) => apiClient.post(`/ai/parse-invoice?company_id=${companyId}`, { text }),
  suggestReminder: (companyId, data) => apiClient.post(`/ai/suggest-reminder?company_id=${companyId}`, data),
  customerFollowup: (companyId, customerId) =>
    apiClient.post(`/ai/customer-followup?company_id=${companyId}`, { customer_id: customerId }),
  categorizeExpense: (companyId, data) => apiClient.post(`/ai/categorize-expense?company_id=${companyId}`, data),
};

export const bankStatementImportAPI = {
  listImports: (companyId) => apiClient.get(`/bank-statement-import/imports?company_id=${companyId}`),
  getImport: (companyId, importId) => apiClient.get(`/bank-statement-import/imports/${importId}?company_id=${companyId}`),
  listTransactions: (companyId, params = {}) => {
    const q = new URLSearchParams({ company_id: companyId, ...params }).toString();
    return apiClient.get(`/bank-statement-import/transactions?${q}`);
  },
  listSuggestions: (companyId, params = {}) => {
    const q = new URLSearchParams({ company_id: companyId, ...params }).toString();
    return apiClient.get(`/bank-statement-import/reconciliation-suggestions?${q}`);
  },
  approveSuggestion: (companyId, data) => apiClient.post(`/bank-statement-import/reconciliation/approve?company_id=${companyId}`, data),
  rejectSuggestion: (companyId, suggestionId) => apiClient.post(`/bank-statement-import/reconciliation/reject?suggestion_id=${suggestionId}&company_id=${companyId}`),
  ignoreTransaction: (companyId, transactionId) => apiClient.post(`/bank-statement-import/reconciliation/ignore?transaction_id=${transactionId}&company_id=${companyId}`),
  createManualEntry: (companyId, data) => apiClient.post(`/bank-statement-import/reconciliation/manual-entry?company_id=${companyId}`, data),
  retryImport: (companyId, importId) => apiClient.post(`/bank-statement-import/retry/${importId}?company_id=${companyId}`),
};

export const accountingMappingsAPI = {
  listSupplierMappings: (companyId, params = {}) => {
    const q = new URLSearchParams({ company_id: companyId, ...params }).toString();
    return apiClient.get(`/accounting/supplier-mappings?${q}`);
  },
  createSupplierMapping: (companyId, data) => apiClient.post(`/accounting/supplier-mappings?company_id=${companyId}`, data),
  updateSupplierMapping: (companyId, mappingId, data) => apiClient.put(`/accounting/supplier-mappings/${mappingId}?company_id=${companyId}`, data),
  listLearningPatterns: (companyId, params = {}) => {
    const q = new URLSearchParams({ company_id: companyId, ...params }).toString();
    return apiClient.get(`/accounting/learning-patterns?${q}`);
  },
  getChartMetadata: (companyId) => apiClient.get(`/accounting/chart?company_id=${companyId}`),
  initializeChart: (companyId, force = false) => apiClient.post(`/accounting/chart/initialize?company_id=${companyId}&force=${force}`),
};

export default apiClient;
