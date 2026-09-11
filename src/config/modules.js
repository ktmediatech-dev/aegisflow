// Single source of truth for every module in the ERP. Used to:
//  - validate permission rows
//  - render the IT Admin's role/permission editor on the frontend
//  - gate API routes
//
// Add a new module here first, then build its routes/pages — everything
// else (permission checks, role editor UI) picks it up automatically.
export const MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'admin', label: 'Admin & User Management' },
  { key: 'hr', label: 'HR' },
  { key: 'finance', label: 'Finance' },
  { key: 'fleet', label: 'Fleet Management' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'procurement', label: 'Procurement' },
  { key: 'stations', label: 'Stations' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'compliance', label: 'Compliance & Fraud' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'reports', label: 'Reports' },
];

export const MODULE_KEYS = MODULES.map((m) => m.key);
