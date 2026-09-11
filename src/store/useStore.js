import { create } from 'zustand'
import api from '../services/api.js'
import { mockHrEmployees, mockFinanceInvoices, mockProcurementOrders, mockComplianceCases, mockUsers, mockRoles } from '../data/mockData.js'

const TOKEN_KEY = 'aegisflow_token'
const USER_KEY = 'aegisflow_user'

const EMPTY_CHART_DATA = {
  stationPerformance: [],
  tankVariance: [],
  transitLossHistory: [],
  maintenanceCosts: [],
}

export const useStore = create((set, get) => ({
  // Auth
  token: localStorage.getItem(TOKEN_KEY) || null,
  user: JSON.parse(localStorage.getItem(USER_KEY) || 'null') || { name: 'Admin User', role: 'Super Admin', company: 'PetroNet Corp', avatar: 'AU' },

  // Core data — all backed by the tenant DB now (see fetchCompanyData); start empty.
  stations: [],
  fleet: [],
  tankReadings: [],
  maintenanceJobs: [],
  transitLogs: [],
  contractors: [],
  suppliers: [],
  alerts: [],
  chartData: EMPTY_CHART_DATA,
  settings: null,
  deletionRequests: [],
  tanks: [],
  nozzles: [],
  nozzleReadings: [],
  nozzleReconciliation: [],

  hrEmployees: mockHrEmployees,
  financeInvoices: mockFinanceInvoices,
  procurementOrders: mockProcurementOrders,
  complianceCases: mockComplianceCases,
  companyUsers: mockUsers,
  companyRoles: mockRoles,

  // UI state
  sidebarOpen: true,
  activeModule: 'dashboard',

  // Currency
  currency: 'USD',
  setCurrency: (code) => set({ currency: code }),

  // Actions
  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  setModule: (mod) => set({ activeModule: mod }),

  // Authentication helpers
  setAuth: (token, user) => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
      api.setToken(token)
    } else {
      localStorage.removeItem(TOKEN_KEY)
      api.setToken(null)
    }
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(USER_KEY)
    }
    set({ token, user })
  },

  login: async (email, password) => {
    const res = await api.login(email, password)
    if (!res) throw new Error('Login failed')

    // Platform admin with 2FA enabled: no session yet, just a short-lived
    // pendingToken the caller must exchange via verify2FALogin() below.
    if (res.requires2FA) return res

    const { token, user } = res
    api.setToken(token)

    // Platform admins don't get company-module permissions at all — they
    // operate on a completely separate part of the app (Companies/
    // Platform), never a tenant's operational data. See ProtectedRoute
    // and Sidebar for how "platform_admin" is handled as its own case.
    const mergedUser = {
      ...user,
      permissions: user.type === 'platform_admin' ? [] : user?.permissions || [],
    }
    get().setAuth(token, mergedUser)
    return res
  },

  verify2FALogin: async (pendingToken, code) => {
    const res = await api.verifyLogin2FA(pendingToken, code)
    if (!res) throw new Error('Verification failed')
    const { token, user } = res
    api.setToken(token)
    const mergedUser = { ...user, permissions: [] } // always platform_admin at this point
    get().setAuth(token, mergedUser)
    return res
  },

  logout: () => {
    get().setAuth(null, null)
    set({ token: null, user: null })
  },

  acknowledgeAlert: async (id) => {
    const updated = await api.acknowledgeAlert(id)
    set((state) => ({ alerts: state.alerts.map((a) => (a.id === id ? updated : a)) }))
  },

  dismissAlert: async (id) => {
    const updated = await api.dismissAlert(id)
    set((state) => ({ alerts: state.alerts.map((a) => (a.id === id ? updated : a)) }))
  },

  // Fetch tenant-scoped data from backend; fall back to mock/empty data on error.
  fetchCompanyData: async () => {
    const user = get().user
    if (!user || user.type !== 'company_user') return

    const defaults = {
      companyUsers: mockUsers,
      companyRoles: mockRoles,
      hrEmployees: mockHrEmployees,
      financeInvoices: mockFinanceInvoices,
      procurementOrders: mockProcurementOrders,
      complianceCases: mockComplianceCases,
      stations: [],
      fleet: [],
      tankReadings: [],
      transitLogs: [],
      maintenanceJobs: [],
      contractors: [],
      suppliers: [],
      alerts: [],
      chartData: EMPTY_CHART_DATA,
      settings: null,
    }

    const canRead = (module) =>
      user.permissions?.some((perm) => perm.module === module && perm.can_read)

    const results = await Promise.allSettled([
      canRead('admin') ? api.getUsers() : Promise.resolve(null),
      canRead('admin') ? api.getRoles() : Promise.resolve(null),
      canRead('hr') ? api.getHrEmployees() : Promise.resolve(null),
      canRead('finance') ? api.getFinanceInvoices() : Promise.resolve(null),
      canRead('procurement') ? api.getProcurementOrders() : Promise.resolve(null),
      canRead('compliance') ? api.getComplianceCases() : Promise.resolve(null),
      canRead('stations') ? api.getStations() : Promise.resolve(null),
      canRead('fleet') ? api.getFleet() : Promise.resolve(null),
      canRead('stations') ? api.getTankReadings() : Promise.resolve(null),
      canRead('stations') ? api.getTransitLogs() : Promise.resolve(null),
      canRead('maintenance') ? api.getMaintenanceJobs() : Promise.resolve(null),
      canRead('maintenance') ? api.getContractors() : Promise.resolve(null),
      canRead('suppliers') ? api.getSuppliers() : Promise.resolve(null),
      canRead('dashboard') ? api.getAlerts() : Promise.resolve(null),
      canRead('analytics') ? api.getAnalyticsOverview() : Promise.resolve(null),
      api.getSettings(), // every company user can read branding/theme
    ])

    const val = (i, fallback) => (results[i].status === 'fulfilled' && results[i].value ? results[i].value : fallback)

    set({
      companyUsers: val(0, defaults.companyUsers),
      companyRoles: val(1, defaults.companyRoles),
      hrEmployees: val(2, defaults.hrEmployees),
      financeInvoices: val(3, defaults.financeInvoices),
      procurementOrders: val(4, defaults.procurementOrders),
      complianceCases: val(5, defaults.complianceCases),
      stations: val(6, defaults.stations),
      fleet: val(7, defaults.fleet),
      tankReadings: val(8, defaults.tankReadings),
      transitLogs: val(9, defaults.transitLogs),
      maintenanceJobs: val(10, defaults.maintenanceJobs),
      contractors: val(11, defaults.contractors),
      suppliers: val(12, defaults.suppliers),
      alerts: val(13, defaults.alerts),
      chartData: val(14, defaults.chartData),
      settings: val(15, defaults.settings),
    })
  },

  updateSettings: async (patch) => {
    const updated = await api.updateSettings(patch)
    set({ settings: updated })
    return updated
  },

  // Company admin actions
  provisionCompany: async (data) => {
    const res = await api.provisionCompany(data)
    return res
  },

  createUser: async (user) => {
    const res = await api.createUser(user)
    set((s) => ({ companyUsers: [res, ...s.companyUsers] }))
    return res
  },
  updateUser: async (id, patch) => {
    const updated = await api.updateUser(id, patch)
    set((s) => ({ companyUsers: s.companyUsers.map((x) => (x.id === id ? updated : x)) }))
    return updated
  },

  // Stations
  addStation: async (station) => {
    const created = await api.createStation(station)
    set((s) => ({ stations: [created, ...s.stations] }))
    return created
  },
  updateStation: async (id, patch) => {
    const updated = await api.updateStation(id, patch)
    set((s) => ({ stations: s.stations.map((x) => (x.id === id ? updated : x)) }))
    return updated
  },
  // Files a deletion request rather than deleting — see DeletionRequests page.
  deleteStation: async (id, reason) => api.deleteStation(id, reason),

  // Fleet
  addFleetVehicle: async (vehicle) => {
    const created = await api.createFleetVehicle(vehicle)
    set((s) => ({ fleet: [created, ...s.fleet] }))
    return created
  },
  updateFleetVehicle: async (id, patch) => {
    const updated = await api.updateFleetVehicle(id, patch)
    set((s) => ({ fleet: s.fleet.map((x) => (x.id === id ? updated : x)) }))
    return updated
  },
  deleteFleetVehicle: async (id, reason) => api.deleteFleetVehicle(id, reason),

  // Maintenance
  addMaintenanceJob: async (job) => {
    const created = await api.createMaintenanceJob(job)
    set((s) => ({ maintenanceJobs: [created, ...s.maintenanceJobs] }))
    return created
  },
  updateMaintenanceJob: async (id, patch) => {
    const updated = await api.updateMaintenanceJob(id, patch)
    set((s) => ({ maintenanceJobs: s.maintenanceJobs.map((x) => (x.id === id ? updated : x)) }))
    return updated
  },

  // Contractors
  addContractor: async (contractor) => {
    const created = await api.createContractor(contractor)
    set((s) => ({ contractors: [created, ...s.contractors] }))
    return created
  },
  updateContractor: async (id, patch) => {
    const updated = await api.updateContractor(id, patch)
    set((s) => ({ contractors: s.contractors.map((x) => (x.id === id ? updated : x)) }))
    return updated
  },
  deleteContractor: async (id, reason) => api.deleteContractor(id, reason),

  // Suppliers
  addSupplier: async (supplier) => {
    const created = await api.createSupplier(supplier)
    set((s) => ({ suppliers: [created, ...s.suppliers] }))
    return created
  },
  updateSupplier: async (id, patch) => {
    const updated = await api.updateSupplier(id, patch)
    set((s) => ({ suppliers: s.suppliers.map((x) => (x.id === id ? updated : x)) }))
    return updated
  },
  deleteSupplier: async (id, reason) => api.deleteSupplier(id, reason),

  // Deletion requests (maker-checker) — fetched on demand by the
  // DeletionRequests page, not bundled into fetchCompanyData since any
  // company user can view the queue regardless of module permissions.
  fetchDeletionRequests: async () => {
    const rows = await api.getDeletionRequests()
    set({ deletionRequests: rows })
    return rows
  },
  approveDeletionRequest: async (id) => {
    const updated = await api.approveDeletionRequest(id)
    set((s) => ({ deletionRequests: s.deletionRequests.map((r) => (r.id === id ? updated : r)) }))
    return updated
  },
  rejectDeletionRequest: async (id) => {
    const updated = await api.rejectDeletionRequest(id)
    set((s) => ({ deletionRequests: s.deletionRequests.map((r) => (r.id === id ? updated : r)) }))
    return updated
  },

  // Nozzles / tank throughput reconciliation
  fetchNozzleData: async () => {
    const [tanks, nozzles, readings, reconciliation] = await Promise.all([
      api.getTanks(), api.getNozzles(), api.getNozzleReadings(), api.getNozzleReconciliation(),
    ])
    set({ tanks, nozzles, nozzleReadings: readings, nozzleReconciliation: reconciliation })
  },
  addTank: async (tank) => {
    const created = await api.createTank(tank)
    set((s) => ({ tanks: [created, ...s.tanks.filter((t) => t.id !== created.id)] }))
    return created
  },
  addNozzle: async (nozzle) => {
    const created = await api.createNozzle(nozzle)
    set((s) => ({ nozzles: [created, ...s.nozzles] }))
    return created
  },
  addNozzleReading: async (reading) => {
    const created = await api.createNozzleReading(reading)
    set((s) => ({ nozzleReadings: [created, ...s.nozzleReadings] }))
    return created
  },

  // Fleet vehicle compartments
  fetchVehicleCompartments: async (vehicleId) => api.getVehicleCompartments(vehicleId),
  saveVehicleCompartments: async (vehicleId, compartments) => api.createVehicleCompartments(vehicleId, compartments),

  // Trips (depot-to-station delivery runs) and the offload workflow
  addTransitLog: async (trip) => {
    const created = await api.createTransitLog(trip)
    set((s) => ({ transitLogs: [created, ...s.transitLogs] }))
    return created
  },
  arriveTransitLog: async (id) => {
    const updated = await api.arriveTransitLog(id)
    set((s) => ({ transitLogs: s.transitLogs.map((t) => (t.id === id ? updated : t)) }))
    return updated
  },
  fetchCompartmentReadings: async (transitLogId) => api.getCompartmentReadings(transitLogId),
  saveCompartmentReadings: async (transitLogId, stage, readings) => {
    const result = await api.saveCompartmentReadings(transitLogId, stage, readings)
    set((s) => ({ transitLogs: s.transitLogs.map((t) => (t.id === transitLogId ? result.trip : t)) }))
    return result
  },
  saveTankOpeningDip: async (transitLogId, data) => api.saveTankOpeningDip(transitLogId, data),
  fetchTankOffloadSummary: async (transitLogId) => api.getTankOffloadSummary(transitLogId),
}))
