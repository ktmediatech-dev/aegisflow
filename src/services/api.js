const API_BASE = '' // assume same origin; backend runs on PORT 4000

let token = null

// initialize from localStorage if present
try {
  const stored = localStorage.getItem('aegisflow_token')
  if (stored) token = stored
} catch (e) {
  // localStorage may be unavailable in some environments
}

function setToken(t) {
  token = t
}

async function request(path, options = {}) {
  const headers = options.headers || {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  headers['Content-Type'] = headers['Content-Type'] || 'application/json'

  const res = await fetch(`/api${path}`, { ...options, headers })
  if (!res.ok) {
    // The backend sends a specific reason in the JSON body (e.g. "This
    // company account is not active", "Your account has been disabled",
    // "Invalid credentials") — read it out here rather than falling back
    // to a generic HTTP status text like "Unauthorized" for everything.
    let message = res.statusText
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch (e) {
      // response wasn't JSON (e.g. a raw 502 from the host) — keep statusText
    }
    throw new Error(message)
  }
  return res.json()
}

export default {
  setToken,
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  getCurrentUser: () => request('/users/me'),
  getUsers: () => request('/users'),
  createUser: (u) => request('/users', { method: 'POST', body: JSON.stringify(u) }),
  updateUser: (id, u) => request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(u) }),
  getRoles: () => request('/roles'),
  getHrEmployees: () => request('/hr/employees'),
  getFinanceInvoices: () => request('/finance/invoices'),
  getProcurementOrders: () => request('/procurement/orders'),
  getComplianceCases: () => request('/compliance/cases'),

  getStations: () => request('/stations'),
  createStation: (s) => request('/stations', { method: 'POST', body: JSON.stringify(s) }),
  updateStation: (id, s) => request(`/stations/${id}`, { method: 'PATCH', body: JSON.stringify(s) }),
  deleteStation: (id, reason) => request(`/stations/${id}`, { method: 'DELETE', body: JSON.stringify({ reason }) }),

  getFleet: () => request('/fleet'),
  createFleetVehicle: (v) => request('/fleet', { method: 'POST', body: JSON.stringify(v) }),
  updateFleetVehicle: (id, v) => request(`/fleet/${id}`, { method: 'PATCH', body: JSON.stringify(v) }),
  deleteFleetVehicle: (id, reason) => request(`/fleet/${id}`, { method: 'DELETE', body: JSON.stringify({ reason }) }),
  getVehicleCompartments: (vehicleId) => request(`/fleet/${vehicleId}/compartments`),
  createVehicleCompartments: (vehicleId, compartments) =>
    request(`/fleet/${vehicleId}/compartments`, { method: 'POST', body: JSON.stringify({ compartments }) }),

  getTankReadings: () => request('/tanks/readings'),
  getTransitLogs: () => request('/tanks/transit-logs'),
  createTransitLog: (t) => request('/tanks/transit-logs', { method: 'POST', body: JSON.stringify(t) }),
  arriveTransitLog: (id) => request(`/tanks/transit-logs/${id}/arrive`, { method: 'PATCH' }),
  getCompartmentReadings: (transitLogId) => request(`/tanks/transit-logs/${transitLogId}/compartment-readings`),
  saveCompartmentReadings: (transitLogId, stage, readings) =>
    request(`/tanks/transit-logs/${transitLogId}/compartment-readings`, { method: 'POST', body: JSON.stringify({ stage, readings }) }),
  saveTankOpeningDip: (transitLogId, data) =>
    request(`/tanks/transit-logs/${transitLogId}/tank-opening-dip`, { method: 'POST', body: JSON.stringify(data) }),
  getTankOffloadSummary: (transitLogId) => request(`/tanks/transit-logs/${transitLogId}/tank-offload-summary`),

  getMaintenanceJobs: () => request('/maintenance'),
  createMaintenanceJob: (j) => request('/maintenance', { method: 'POST', body: JSON.stringify(j) }),
  updateMaintenanceJob: (id, j) => request(`/maintenance/${id}`, { method: 'PATCH', body: JSON.stringify(j) }),

  getContractors: () => request('/contractors'),
  createContractor: (c) => request('/contractors', { method: 'POST', body: JSON.stringify(c) }),
  updateContractor: (id, c) => request(`/contractors/${id}`, { method: 'PATCH', body: JSON.stringify(c) }),
  deleteContractor: (id, reason) => request(`/contractors/${id}`, { method: 'DELETE', body: JSON.stringify({ reason }) }),

  getSuppliers: () => request('/suppliers'),
  createSupplier: (s) => request('/suppliers', { method: 'POST', body: JSON.stringify(s) }),
  updateSupplier: (id, s) => request(`/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(s) }),
  deleteSupplier: (id, reason) => request(`/suppliers/${id}`, { method: 'DELETE', body: JSON.stringify({ reason }) }),

  getAlerts: () => request('/alerts'),
  acknowledgeAlert: (id) => request(`/alerts/${id}/acknowledge`, { method: 'PATCH' }),
  dismissAlert: (id) => request(`/alerts/${id}/dismiss`, { method: 'PATCH' }),

  getAnalyticsOverview: () => request('/analytics/overview'),

  getSettings: () => request('/settings'),
  updateSettings: (s) => request('/settings', { method: 'PATCH', body: JSON.stringify(s) }),

  getDeletionRequests: () => request('/deletion-requests'),
  approveDeletionRequest: (id) => request(`/deletion-requests/${id}/approve`, { method: 'PATCH' }),
  rejectDeletionRequest: (id) => request(`/deletion-requests/${id}/reject`, { method: 'PATCH' }),

  getTanks: () => request('/nozzles/tanks'),
  createTank: (t) => request('/nozzles/tanks', { method: 'POST', body: JSON.stringify(t) }),
  getNozzles: () => request('/nozzles'),
  createNozzle: (n) => request('/nozzles', { method: 'POST', body: JSON.stringify(n) }),
  getNozzleReadings: () => request('/nozzles/readings'),
  createNozzleReading: (r) => request('/nozzles/readings', { method: 'POST', body: JSON.stringify(r) }),
  getNozzleReconciliation: () => request('/nozzles/reconciliation'),

  provisionCompany: (data) => request('/companies', { method: 'POST', body: JSON.stringify(data) }),
  createCompany: (data) => request('/companies', { method: 'POST', body: JSON.stringify(data) }),
  getCompanies: () => request('/companies'),
  getCompanyRoles: (companyId) => request(`/companies/${companyId}/roles`),
  createCompanyUser: (companyId, data) => request(`/companies/${companyId}/users`, { method: 'POST', body: JSON.stringify(data) }),
  updateCompanyStatus: (companyId, status) => request(`/companies/${companyId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updateCompanyPlan: (companyId, plan) => request(`/companies/${companyId}/plan`, { method: 'PATCH', body: JSON.stringify({ plan }) }),
  getCompanyUsers: (companyId) => request(`/companies/${companyId}/users`),
  resetCompanyUserPassword: (companyId, userId, newPassword) =>
    request(`/companies/${companyId}/users/${userId}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),
  getCompanyAuditLog: (companyId) => request(`/companies/${companyId}/audit-log`),
  getPlatformAuditLog: () => request('/companies/platform-audit-log'),
}
