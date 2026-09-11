// Stations, fleet, tank readings, maintenance jobs, transit logs,
// contractors, suppliers, alerts and analytics chart data now all come
// from the backend (see routes/ and useStore.fetchCompanyData) — no mock
// data for them here anymore.

export const mockUsers = [
  { id: 'USR-001', name: 'Jane IT', email: 'jane.it@petronet.com', role: 'IT Admin', status: 'active' },
  { id: 'USR-002', name: 'Peter Finance', email: 'peter.finance@petronet.com', role: 'Finance Manager', status: 'active' },
  { id: 'USR-003', name: 'Mary HR', email: 'mary.hr@petronet.com', role: 'HR Manager', status: 'active' },
  { id: 'USR-004', name: 'Samuel Fleet', email: 'samuel.fleet@petronet.com', role: 'Fleet Manager', status: 'active' },
  { id: 'USR-005', name: 'Esther Compliance', email: 'esther.compliance@petronet.com', role: 'Compliance & Fraud Manager', status: 'active' },
]

export const mockRoles = [
  { id: 'ROL-001', name: 'IT Admin', description: 'Full access to all modules. Manages users and roles.', isSystem: true },
  { id: 'ROL-002', name: 'Managing Director', description: 'Read access across the business, approval rights on key modules.', isSystem: true },
  { id: 'ROL-003', name: 'Finance Manager', description: 'Full access to Finance, read access elsewhere.', isSystem: true },
  { id: 'ROL-004', name: 'HR Manager', description: 'Full access to HR.', isSystem: true },
  { id: 'ROL-005', name: 'Fleet Manager', description: 'Full access to Fleet Management.', isSystem: true },
  { id: 'ROL-006', name: 'Procurement Manager', description: 'Full access to Procurement and Suppliers.', isSystem: true },
  { id: 'ROL-007', name: 'Compliance & Fraud Manager', description: 'Full access to Compliance & Fraud.', isSystem: true },
]

export const mockHrEmployees = [
  { id: 'EMP-001', name: 'James Mwangi', email: 'james.mwangi@petronet.com', role: 'Station Manager', department: 'Operations', status: 'active' },
  { id: 'EMP-002', name: 'Amina Hassan', email: 'amina.hassan@petronet.com', role: 'Compliance Officer', department: 'Compliance', status: 'active' },
  { id: 'EMP-003', name: 'Peter Ochieng', email: 'peter.ochieng@petronet.com', role: 'Fleet Coordinator', department: 'Fleet', status: 'active' },
]

export const mockFinanceInvoices = [
  { id: 'INV-001', invoice_number: 'INV-2025-001', vendor: 'Kenya Petroleum Refineries', amount: 4500000, status: 'pending', due_date: '2025-06-15' },
  { id: 'INV-002', invoice_number: 'INV-2025-002', vendor: 'AutoMech Solutions Ltd', amount: 85000, status: 'paid', due_date: '2025-05-20' },
]

export const mockProcurementOrders = [
  { id: 'PO-001', order_number: 'PO-2025-001', supplier: 'Vivo Energy Supply Chain', total_amount: 9200000, status: 'delivered', expected_delivery: '2025-05-08' },
  { id: 'PO-002', order_number: 'PO-2025-002', supplier: 'FireShield Systems', total_amount: 120000, status: 'ordered', expected_delivery: '2025-06-10' },
]

export const mockComplianceCases = [
  { id: 'CMP-001', title: 'Garissa Tank Variance Investigation', category: 'Fraud', assigned_to: 'Esther Compliance', priority: 'high', status: 'open' },
  { id: 'CMP-002', title: 'Fire Suppression Service Overdue', category: 'Safety', assigned_to: 'Grace Wanjiku', priority: 'critical', status: 'in-progress' },
]
