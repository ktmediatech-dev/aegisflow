import { MODULE_KEYS } from './modules.js';

// Every module set to false/false/false by default; we only specify
// the modules a role gets elevated access to. IT Admin gets everything.
function allModules({ read = false, write = false, approve = false } = {}) {
  return MODULE_KEYS.reduce((acc, key) => {
    acc[key] = { read, write, approve };
    return acc;
  }, {});
}

function withOverrides(base, overrides) {
  return { ...base, ...overrides };
}

// Every company is seeded with these roles + permission matrices when
// provisioned. IT Admin can edit/add/remove roles afterward via the
// admin UI — these are just sane defaults to start from.
export const DEFAULT_ROLES = [
  {
    name: 'IT Admin',
    description: 'Full access to all modules. Manages users and roles.',
    isSystem: true,
    permissions: allModules({ read: true, write: true, approve: true }),
  },
  {
    name: 'Managing Director',
    description: 'Read access across the business, approval rights on key modules.',
    isSystem: true,
    permissions: allModules({ read: true, write: false, approve: true }),
  },
  {
    name: 'Finance Manager',
    description: 'Full access to Finance, read access elsewhere.',
    isSystem: true,
    permissions: withOverrides(allModules({ read: true }), {
      finance: { read: true, write: true, approve: true },
      procurement: { read: true, write: false, approve: true },
    }),
  },
  {
    name: 'HR Manager',
    description: 'Full access to HR.',
    isSystem: true,
    permissions: withOverrides(allModules({ read: false }), {
      dashboard: { read: true, write: false, approve: false },
      hr: { read: true, write: true, approve: true },
    }),
  },
  {
    name: 'Fleet Manager',
    description: 'Full access to Fleet Management.',
    isSystem: true,
    permissions: withOverrides(allModules({ read: false }), {
      dashboard: { read: true, write: false, approve: false },
      fleet: { read: true, write: true, approve: true },
      maintenance: { read: true, write: false, approve: false },
    }),
  },
  {
    name: 'Maintenance Manager',
    description: 'Full access to Maintenance.',
    isSystem: true,
    permissions: withOverrides(allModules({ read: false }), {
      dashboard: { read: true, write: false, approve: false },
      maintenance: { read: true, write: true, approve: true },
      fleet: { read: true, write: false, approve: false },
    }),
  },
  {
    name: 'Procurement Manager',
    description: 'Full access to Procurement and Suppliers.',
    isSystem: true,
    permissions: withOverrides(allModules({ read: false }), {
      dashboard: { read: true, write: false, approve: false },
      procurement: { read: true, write: true, approve: true },
      suppliers: { read: true, write: true, approve: false },
    }),
  },
  {
    name: 'Station Manager',
    description: 'Manages assigned station(s): tanks, local fleet activity.',
    isSystem: true,
    permissions: withOverrides(allModules({ read: false }), {
      dashboard: { read: true, write: false, approve: false },
      stations: { read: true, write: true, approve: false },
    }),
  },
  {
    name: 'Compliance & Fraud Manager',
    description: 'Full access to Compliance & Fraud, read access to audit-relevant modules.',
    isSystem: true,
    permissions: withOverrides(allModules({ read: true }), {
      compliance: { read: true, write: true, approve: true },
    }),
  },
];
