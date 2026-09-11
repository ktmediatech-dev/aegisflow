import bcrypt from 'bcryptjs';
import { DEFAULT_ROLES } from '../config/defaultRoles.js';
import { MODULE_KEYS } from '../config/modules.js';

// Very small in-memory DB used only for local dev when Postgres isn't
// available. It implements a tiny subset of queries used by the app so
// you can run the backend/UI without installing Postgres.

let nextId = 1;
const platform = {
  platform_admins: [],
  companies: [],
  directory: [],
};

const tenants = new Map();

function id() { return nextId++; }

export function initDevData() {
  // Ensure we have the bootstrap platform admin
  if (!platform.platform_admins.length) {
    const password_hash = bcrypt.hashSync('changeme123', 8);
    platform.platform_admins.push({ id: id(), name: 'Platform Admin', email: 'you@aegisflow.com', password_hash });
  }

  // Ensure KT-Petroleum and its IT admin exist in dev fallback for local testing.
  if (!platform.companies.some((c) => c.name === 'KT-Petroleum')) {
    const dbName = 'aegisflow_co_kt_petroleum_dev';
    const company = {
      id: id(),
      name: 'KT-Petroleum',
      slug: 'kt-petroleum',
      plan: 'trial',
      status: 'active',
      subscription_renews_at: null,
      created_at: new Date().toISOString(),
      db_name: dbName,
    };
    platform.companies.push(company);
    platform.directory.push({ id: id(), email: 'kasule@kt-petroleum.com', company_id: company.id });

    const tenant = makeTenant(dbName);
    const roleMap = new Map();
    for (const role of DEFAULT_ROLES) {
      const roleId = id();
      tenant.roles.push({ id: roleId, name: role.name, is_system: true, description: role.description });
      roleMap.set(role.name, roleId);
      for (const moduleKey of MODULE_KEYS) {
        const perm = role.permissions[moduleKey] || { read: false, write: false, approve: false };
        tenant.permissions.push({ id: id(), role_id: roleId, module: moduleKey, can_read: perm.read, can_write: perm.write, can_approve: perm.approve });
      }
    }

    const adminHash = bcrypt.hashSync('adminpass', 10);
    tenant.users.push({ id: id(), email: 'kasule@kt-petroleum.com', password_hash: adminHash, name: 'Kasule', role_id: roleMap.get('IT Admin'), status: 'active', created_at: new Date().toISOString() });
    const users = [
      { email: 'md@democo.local', name: 'Managing Director', role: 'Managing Director', pwd: 'mdpass' },
      { email: 'finance@democo.local', name: 'Finance Manager', role: 'Finance Manager', pwd: 'finpass' },
      { email: 'hr@democo.local', name: 'HR Manager', role: 'HR Manager', pwd: 'hrpass' },
      { email: 'fleet@democo.local', name: 'Fleet Manager', role: 'Fleet Manager', pwd: 'fleetpass' },
      { email: 'maint@democo.local', name: 'Maintenance Manager', role: 'Maintenance Manager', pwd: 'maintpass' },
      { email: 'procure@democo.local', name: 'Procurement Manager', role: 'Procurement Manager', pwd: 'procurepass' },
      { email: 'station@democo.local', name: 'Station Manager', role: 'Station Manager', pwd: 'stationpass' },
      { email: 'compliance@democo.local', name: 'Compliance Manager', role: 'Compliance & Fraud Manager', pwd: 'complpass' },
      { email: 'user@democo.local', name: 'Regular User', role: 'User', pwd: 'userpass' },
    ];

    for (const u of users) {
      const password_hash = bcrypt.hashSync(u.pwd, 10);
      tenant.users.push({ id: id(), email: u.email, password_hash, name: u.name, role_id: roleMap.get(u.role), status: 'active', created_at: new Date().toISOString() });
      platform.directory.push({ id: id(), email: u.email, company_id: company.id });
    }

    seedFleetOpsData(tenant);
  }
}

// Small seed dataset for the fleet/fuel-ops modules (stations, fleet,
// tanks, maintenance, transit) so local dev has something to look at
// without a real Postgres connection.
function seedFleetOpsData(tenant) {
  const now = new Date().toISOString();

  const stationDefs = [
    { name: 'Nairobi Central', region: 'Nairobi', manager: 'James Mwangi', address: 'Kenyatta Ave, Nairobi', phone: '+254 20 123 4567', fuel_types: ['PMS', 'AGO', 'DPK'], tanks: 3, pumps: 8, status: 'operational', daily_sales: 45000, monthly_sales: 1350000, sales_target: 1400000, risk_score: 12 },
    { name: 'Mombasa Port', region: 'Coast', manager: 'Amina Hassan', address: 'Moi Ave, Mombasa', phone: '+254 41 234 5678', fuel_types: ['PMS', 'AGO'], tanks: 2, pumps: 6, status: 'operational', daily_sales: 38000, monthly_sales: 1140000, sales_target: 1200000, risk_score: 8 },
    { name: 'Kisumu Lakeside', region: 'Nyanza', manager: 'Peter Ochieng', address: 'Oginga Odinga St, Kisumu', phone: '+254 57 345 6789', fuel_types: ['PMS', 'AGO', 'LPG'], tanks: 3, pumps: 4, status: 'maintenance', daily_sales: 22000, monthly_sales: 660000, sales_target: 900000, risk_score: 35 },
    { name: 'Nakuru Highway', region: 'Rift Valley', manager: 'Grace Wanjiku', address: 'A104, Nakuru', phone: '+254 51 456 7890', fuel_types: ['PMS', 'AGO'], tanks: 4, pumps: 10, status: 'operational', daily_sales: 55000, monthly_sales: 1650000, sales_target: 1500000, risk_score: 5 },
  ];
  const stations = stationDefs.map((s) => ({
    id: id(), created_at: now, established: null, last_audit: '2025-04-15', lat: null, lng: null,
    ...s,
  }));
  tenant.stations.push(...stations);
  const stationByName = (name) => stations.find((s) => s.name === name);

  const fleetDefs = [
    { plate: 'KBZ 001A', type: 'Tanker', capacity: 33000, fuel: 'AGO', driver: 'Moses Kariuki', station: 'Nairobi Central', status: 'in-transit', mileage: 128540, next_service: '2025-07-01', speed: 65, fuel_level: 72 },
    { plate: 'KBZ 002B', type: 'Tanker', capacity: 28000, fuel: 'PMS', driver: 'Paul Njoroge', station: 'Mombasa Port', status: 'loading', mileage: 95300, next_service: '2025-06-15', speed: 0, fuel_level: 100 },
    { plate: 'KBZ 003C', type: 'Tanker', capacity: 33000, fuel: 'AGO', driver: 'Francis Omondi', station: 'Nakuru Highway', status: 'delivered', mileage: 210050, next_service: '2025-05-20', speed: 0, fuel_level: 8 },
    { plate: 'KBZ 004D', type: 'Service Van', capacity: 0, fuel: 'PMS', driver: 'Ruth Achieng', station: 'Kisumu Lakeside', status: 'maintenance', mileage: 67800, next_service: '2025-03-10', speed: 0, fuel_level: 45 },
  ];
  const fleet = fleetDefs.map((v) => ({
    id: id(), created_at: now, last_service: '2025-04-01', gps_lat: null, gps_lng: null, insurance_expiry: '2025-12-31',
    ownership: 'owned', owner_name: null,
    ...v,
  }));
  tenant.fleet_vehicles.push(...fleet);

  const tankDefs = [
    { station: 'Nairobi Central', tank_no: 'T1', product: 'PMS', capacity: 30000, current_level: 18450, opening_stock: 22000, closing_stock: 18450, received: 0, sales_volume: 3550, variance: -12, variance_pct: 0.34, status: 'normal' },
    { station: 'Nairobi Central', tank_no: 'T2', product: 'AGO', capacity: 30000, current_level: 5200, opening_stock: 8500, closing_stock: 5200, received: 0, sales_volume: 3240, variance: -60, variance_pct: 1.85, status: 'critical' },
    { station: 'Mombasa Port', tank_no: 'T1', product: 'PMS', capacity: 25000, current_level: 9800, opening_stock: 15000, closing_stock: 9800, received: 0, sales_volume: 5100, variance: 100, variance_pct: 1.96, status: 'warning' },
    { station: 'Nakuru Highway', tank_no: 'T1', product: 'AGO', capacity: 35000, current_level: 28000, opening_stock: 33000, closing_stock: 28000, received: 0, sales_volume: 4980, variance: 20, variance_pct: 0.4, status: 'normal' },
  ]
  for (const t of tankDefs) {
    const station = stationByName(t.station);
    tenant.tank_readings.push({
      id: id(), created_at: now, reading_date: '2025-05-12',
      station_id: station?.id || null, station_name: t.station,
      ...t,
    });
  }

  const maintenanceDefs = [
    { station: 'Kisumu Lakeside', vehicle_id: null, type: 'Pump Repair', description: 'Pump 2 not dispensing correctly. Flow meter calibration required.', priority: 'high', status: 'in-progress', assigned_tech: 'Joseph Otieno', scheduled_date: '2025-05-08', estimated_completion: '2025-05-15', cost: 85000, invoice_no: 'INV-20253421', notes: 'Parts ordered, awaiting delivery' },
    { station: 'Nairobi Central', vehicle_id: null, type: 'Engine Overhaul', description: 'Full engine overhaul. Tanker due for 200,000km service.', priority: 'medium', status: 'scheduled', assigned_tech: 'Mike Waweru', scheduled_date: '2025-05-20', estimated_completion: '2025-06-05', cost: 350000, invoice_no: null, notes: '' },
    { station: 'Nakuru Highway', vehicle_id: null, type: 'Canopy Lighting', description: 'LED canopy light replacement. 6 units failed.', priority: 'low', status: 'completed', assigned_tech: 'Dan Maina', scheduled_date: '2025-04-22', estimated_completion: '2025-04-23', actual_completion: '2025-04-23', cost: 28000, invoice_no: 'INV-20253105', notes: '' },
    { station: 'Mombasa Port', vehicle_id: null, type: 'Fire Suppression', description: 'Annual fire suppression system service and certification.', priority: 'high', status: 'overdue', assigned_tech: null, scheduled_date: '2025-04-15', estimated_completion: '2025-04-16', cost: 120000, invoice_no: null, notes: 'REMINDER: Regulatory requirement. License at risk.' },
  ]
  for (const m of maintenanceDefs) {
    tenant.maintenance_jobs.push({
      id: id(), created_at: now, contractor_id: null, actual_completion: null,
      ...m,
    });
  }

  const transitDefs = [
    { vehicle: 'KBZ 001A', route: 'Nairobi Depot → Mombasa Port', product: 'AGO', loaded_qty: 33000, delivered_qty: 32780, transit_loss: 220, loss_pct: 0.67, driver: 'Moses Kariuki', dep_date: '2025-05-10', arr_date: '2025-05-11', status: 'completed', cause_note: 'Within acceptable range', flagged: false },
    { vehicle: 'KBZ 002B', route: 'Nairobi Depot → Mombasa Port', product: 'PMS', loaded_qty: 45000, delivered_qty: 44320, transit_loss: 680, loss_pct: 1.51, driver: 'Paul Njoroge', dep_date: '2025-05-09', arr_date: '2025-05-10', status: 'completed', cause_note: 'Excess loss. Under investigation.', flagged: true },
  ]
  for (const tr of transitDefs) {
    const vehicle = fleet.find((v) => v.plate === tr.vehicle);
    tenant.transit_logs.push({
      id: id(), created_at: now,
      vehicle_id: vehicle?.id || null, plate: tr.vehicle,
      route: tr.route, product: tr.product, loaded_qty: tr.loaded_qty, delivered_qty: tr.delivered_qty,
      transit_loss: tr.transit_loss, loss_pct: tr.loss_pct, driver: tr.driver, dep_date: tr.dep_date,
      arr_date: tr.arr_date, status: tr.status, cause_note: tr.cause_note, flagged: tr.flagged,
    });
  }

  // A couple of registered compartments on one tanker, to demo the
  // dip-reading workflow without needing to register a truck from scratch.
  const demoVehicle = fleet.find((v) => v.plate === 'KBZ 001A');
  if (demoVehicle) {
    demoVehicle.ownership = 'owned';
    demoVehicle.owner_name = null;
    for (const [no, cap] of [[1, 11000], [2, 11000], [3, 11000]]) {
      tenant.fleet_vehicle_compartments.push({ id: id(), created_at: now, vehicle_id: demoVehicle.id, compartment_no: no, capacity: cap });
    }
  }

  const contractorDefs = [
    { name: 'AutoMech Solutions Ltd', contact: 'Richard Mwangi', email: 'richard@automech.co.ke', phone: '+254 722 111 222', speciality: 'Vehicle Maintenance', region: 'Nairobi', rating: 4.8, active_jobs: 1, completed_jobs: 45, contract_start: '2025-01-01', contract_expiry: '2025-12-31', status: 'active', total_paid: 2850000, certifications: ['ISO 9001', 'KEBS Certified'] },
    { name: 'PetroTech Engineers', contact: 'Jane Kiprotich', email: 'jane@petrotech.co.ke', phone: '+254 733 222 333', speciality: 'Pump & Equipment', region: 'Nationwide', rating: 4.5, active_jobs: 1, completed_jobs: 28, contract_start: '2025-01-01', contract_expiry: '2025-12-31', status: 'active', total_paid: 1450000, certifications: ['EPRA Licensed'] },
    { name: 'FireShield Systems', contact: 'Martin Oloo', email: 'martin@fireshield.co.ke', phone: '+254 755 555 666', speciality: 'Fire Safety', region: 'Coast, Nairobi', rating: 3.8, active_jobs: 0, completed_jobs: 9, contract_start: '2024-01-01', contract_expiry: '2025-06-30', status: 'expiring', total_paid: 680000, certifications: ['KFS Certified'] },
  ]
  for (const c of contractorDefs) {
    tenant.contractors.push({ id: id(), created_at: now, ...c });
  }

  const supplierDefs = [
    { name: 'Kenya Petroleum Refineries', short_code: 'KPR', contact: 'George Kamau', email: 'supply@kpr.co.ke', phone: '+254 20 600 1000', products: ['PMS', 'AGO', 'DPK'], payment_terms: 'Net 30', credit_limit: 50000000, current_balance: 18500000, last_delivery: '2025-05-10', status: 'active', rating: 4.7, total_purchases: 245000000, delivery_lead_time: 2 },
    { name: 'TotalEnergies Kenya', short_code: 'TEK', contact: 'Priya Sharma', email: 'priya.sharma@totalenergies.co.ke', phone: '+254 20 420 0000', products: ['PMS', 'AGO', 'LPG'], payment_terms: 'Net 15', credit_limit: 30000000, current_balance: 9200000, last_delivery: '2025-05-08', status: 'active', rating: 4.9, total_purchases: 112000000, delivery_lead_time: 1 },
  ]
  for (const s of supplierDefs) {
    tenant.suppliers.push({ id: id(), created_at: now, ...s });
  }

  const alertDefs = [
    { type: 'fraud', severity: 'critical', title: 'Unusual variance — Nairobi Central AGO', message: 'Tank T2 (AGO) at Nairobi Central shows 1.85% unaccounted variance over 24 hours. Possible siphoning.', station: 'Nairobi Central', status: 'active', assigned_to: null },
    { type: 'maintenance', severity: 'critical', title: 'Fire suppression system overdue', message: 'Mombasa Port fire suppression annual service is overdue. License compliance at risk.', station: 'Mombasa Port', status: 'active', assigned_to: 'Martin Oloo' },
    { type: 'fleet', severity: 'warning', title: 'Vehicle KBZ 003C service overdue', message: 'Tanker scheduled service window has passed. Vehicle at 210,050km.', station: null, status: 'active', assigned_to: 'Mike Waweru' },
  ]
  for (const a of alertDefs) {
    const station = a.station ? stationByName(a.station) : null
    tenant.alerts.push({
      id: id(), created_at: now,
      type: a.type, severity: a.severity, title: a.title, message: a.message,
      station_id: station?.id || null, station_name: a.station, status: a.status, assigned_to: a.assigned_to,
    });
  }
}

function makeTenant(dbName) {
  if (tenants.has(dbName)) return tenants.get(dbName);
  const t = {
    roles: [ { id: 1, name: 'IT Admin', is_system: true }, { id: 2, name: 'User', is_system: false } ],
    users: [],
    permissions: [],
    hr_employees: [],
    finance_invoices: [],
    procurement_orders: [],
    compliance_cases: [],
    stations: [],
    fleet_vehicles: [],
    tank_readings: [],
    maintenance_jobs: [],
    transit_logs: [],
    contractors: [],
    suppliers: [],
    alerts: [],
    tanks: [],
    nozzles: [],
    nozzle_readings: [],
    deletion_requests: [],
    audit_log: [],
    fleet_vehicle_compartments: [],
    compartment_readings: [],
    tank_offload_readings: [],
    company_settings: null,
  };
  tenants.set(dbName, t);
  return t;
}

export async function platformQuery(text, params=[]) {
  const q = (text||'').trim().toLowerCase();

  // platform admin lookup
  if (q.startsWith('select * from platform_admins where email')) {
    const email = params[0];
    const rows = platform.platform_admins.filter(a => a.email === email);
    return { rows };
  }

  // --- 2FA (platform_admins.totp_*) ---
  if (q.startsWith('select * from platform_admins where id')) {
    const admin = platform.platform_admins.find(a => String(a.id) === String(params[0]));
    return { rows: admin ? [admin] : [] };
  }
  if (q.startsWith('select totp_secret, totp_enabled from platform_admins')) {
    const admin = platform.platform_admins.find(a => String(a.id) === String(params[0]));
    return { rows: admin ? [{ totp_secret: admin.totp_secret || null, totp_enabled: !!admin.totp_enabled }] : [] };
  }
  if (q.startsWith('select totp_secret from platform_admins')) {
    const admin = platform.platform_admins.find(a => String(a.id) === String(params[0]));
    return { rows: admin ? [{ totp_secret: admin.totp_secret || null }] : [] };
  }
  if (q.startsWith('select totp_enabled from platform_admins')) {
    const admin = platform.platform_admins.find(a => String(a.id) === String(params[0]));
    return { rows: admin ? [{ totp_enabled: !!admin.totp_enabled }] : [] };
  }
  if (q.startsWith('update platform_admins set totp_secret')) {
    const [secret, idParam] = params;
    const admin = platform.platform_admins.find(a => String(a.id) === String(idParam));
    if (admin) { admin.totp_secret = secret; admin.totp_enabled = false; }
    return { rows: [] };
  }
  if (q.startsWith('update platform_admins set totp_enabled = true')) {
    const [backupCodes, idParam] = params;
    const admin = platform.platform_admins.find(a => String(a.id) === String(idParam));
    if (admin) { admin.totp_enabled = true; admin.totp_backup_codes = JSON.parse(backupCodes); }
    return { rows: [] };
  }
  if (q.startsWith('update platform_admins set totp_enabled = false')) {
    const admin = platform.platform_admins.find(a => String(a.id) === String(params[0]));
    if (admin) { admin.totp_enabled = false; admin.totp_secret = null; admin.totp_backup_codes = []; }
    return { rows: [] };
  }
  if (q.startsWith('update platform_admins set totp_backup_codes')) {
    const [backupCodes, idParam] = params;
    const admin = platform.platform_admins.find(a => String(a.id) === String(idParam));
    if (admin) admin.totp_backup_codes = JSON.parse(backupCodes);
    return { rows: [] };
  }

  // directory lookup used by login
  if (q.includes('from directory') && q.includes('join companies')) {
    const email = params[0];
    const entry = platform.directory.find(d => d.email === email);
    if (!entry) return { rows: [] };
    const company = platform.companies.find(c => c.id === entry.company_id);
    if (!company) return { rows: [] };
    return { rows: [ { company_id: company.id, db_name: company.db_name, status: company.status || 'active', company_name: company.name } ] };
  }

  // list companies
  if (q.startsWith('select id, name, slug')) {
    return { rows: platform.companies.slice().reverse() };
  }

  // single company lookup by id (used before delegating to that
  // company's tenant pool — roles, users, reset-password, audit-log)
  if (q.startsWith('select schema_name from companies where id')) {
    const comp = platform.companies.find(c => String(c.id) === String(params[0]));
    return { rows: comp ? [{ schema_name: comp.db_name }] : [] };
  }

  // insert company (simplified) - handle different param orders used
  if (q.startsWith('insert into companies')) {
    // Known callsites use either (name, plan) or (name, slug, db_name, plan)
    let name = params[0] || `Company ${id()}`;
    let plan = 'free';
    let dbName = `tenant_${nextId}`;
    if (params.length === 1 || params.length === 2) {
      plan = params[1] || 'free';
    } else if (params.length >= 4) {
      // params: [name, slug, db_name, plan]
      name = params[0];
      dbName = params[2];
      plan = params[3] || 'free';
    }
    const comp = { id: id(), name, slug: name.toLowerCase().replace(/\s+/g,'-'), plan, status: 'active', subscription_renews_at: null, created_at: new Date().toISOString(), db_name: dbName };
    platform.companies.push(comp);
    // provision a tenant dataset
    makeTenant(comp.db_name);
    return { rows: [comp] };
  }

  // update companies status
  if (q.startsWith('update companies set status')) {
    const status = params[0];
    const idParam = params[1];
    const comp = platform.companies.find(c => String(c.id) === String(idParam));
    if (!comp) return { rows: [] };
    comp.status = status;
    return { rows: [comp] };
  }

  // update companies plan
  if (q.startsWith('update companies set plan')) {
    const plan = params[0];
    const comp = platform.companies.find(c => String(c.id) === String(params[1]));
    if (!comp) return { rows: [] };
    comp.plan = plan;
    return { rows: [comp] };
  }

  // insert into directory
  if (q.startsWith('insert into directory')) {
    const email = params[0];
    const companyId = params[1];
    platform.directory.push({ id: id(), email, company_id: companyId });
    return { rows: [] };
  }

  // fallback: return empty
  return { rows: [] };
}

function serializeStation(s) {
  return {
    id: s.id, name: s.name, region: s.region, manager: s.manager, address: s.address, phone: s.phone,
    fuelTypes: s.fuel_types || [], tanks: s.tanks, pumps: s.pumps, status: s.status,
    dailySales: s.daily_sales, monthlySales: s.monthly_sales, salesTarget: s.sales_target ?? null,
    lastAudit: s.last_audit, riskScore: s.risk_score, established: s.established, lat: s.lat, lng: s.lng,
    created_at: s.created_at,
  };
}

function serializeContractor(c) {
  return {
    id: c.id, name: c.name, contact: c.contact, email: c.email, phone: c.phone, speciality: c.speciality,
    region: c.region, rating: c.rating, activeJobs: c.active_jobs, completedJobs: c.completed_jobs,
    contract: c.contract_start, expiry: c.contract_expiry, status: c.status, totalPaid: c.total_paid,
    certifications: c.certifications || [], created_at: c.created_at,
  };
}

function serializeSupplier(s) {
  return {
    id: s.id, name: s.name, shortCode: s.short_code, contact: s.contact, email: s.email, phone: s.phone,
    products: s.products || [], paymentTerms: s.payment_terms, creditLimit: s.credit_limit,
    currentBalance: s.current_balance, lastDelivery: s.last_delivery, status: s.status, rating: s.rating,
    totalPurchases: s.total_purchases, deliveryLeadTime: s.delivery_lead_time, created_at: s.created_at,
  };
}

function serializeTankMaster(t) {
  return { id: t.id, stationId: t.station_id, tankNo: t.tank_no, product: t.product, capacity: t.capacity, created_at: t.created_at };
}

function serializeNozzle(n) {
  return { id: n.id, stationId: n.station_id, tankId: n.tank_id, label: n.label, product: n.product, status: n.status, created_at: n.created_at };
}

function serializeNozzleReading(r) {
  return {
    id: r.id, nozzleId: r.nozzle_id, readingDate: r.reading_date, openingMeter: r.opening_meter,
    closingMeter: r.closing_meter, recordedBy: r.recorded_by, recordedAt: r.recorded_at,
  };
}

function serializeDeletionRequest(d) {
  return {
    id: d.id, module: d.module, recordId: d.record_id, recordLabel: d.record_label, reason: d.reason,
    status: d.status, requestedBy: d.requested_by, resolvedBy: d.resolved_by, resolvedAt: d.resolved_at,
    createdAt: d.created_at,
  };
}

function serializeAlert(a) {
  return {
    id: a.id, type: a.type, severity: a.severity, title: a.title, message: a.message,
    station_id: a.station_id, station: a.station_name, status: a.status, assignedTo: a.assigned_to,
    date: a.created_at,
  };
}

function serializeVehicle(v) {
  return {
    id: v.id, plate: v.plate, type: v.type, capacity: v.capacity, fuel: v.fuel, driver: v.driver,
    station: v.station, status: v.status, mileage: v.mileage, lastService: v.last_service,
    nextService: v.next_service, gpsLat: v.gps_lat, gpsLng: v.gps_lng, speed: v.speed,
    insurance: v.insurance_expiry, fuelLevel: v.fuel_level, ownership: v.ownership || 'owned',
    ownerName: v.owner_name ?? null, created_at: v.created_at,
  };
}

function serializeCompartment(c) {
  return { id: c.id, vehicleId: c.vehicle_id, compartmentNo: c.compartment_no, capacity: c.capacity, created_at: c.created_at };
}

function serializeCompartmentReading(r) {
  return {
    id: r.id, compartmentId: r.compartment_id, transitLogId: r.transit_log_id, stage: r.stage,
    dipCm: r.dip_cm, volumeLiters: r.volume_liters, isEmpty: r.is_empty,
    recordedBy: r.recorded_by, recordedAt: r.recorded_at,
  };
}

function serializeTankReading(tr) {
  return {
    id: tr.id, station_id: tr.station_id, stationName: tr.station_name, tankNo: tr.tank_no,
    product: tr.product, capacity: tr.capacity, currentLevel: tr.current_level,
    openingStock: tr.opening_stock, closingStock: tr.closing_stock, received: tr.received,
    salesVolume: tr.sales_volume, variance: tr.variance, variancePct: tr.variance_pct,
    date: tr.reading_date, status: tr.status,
  };
}

function serializeTransitLog(tl) {
  return {
    id: tl.id, vehicleId: tl.vehicle_id, plate: tl.plate, route: tl.route, product: tl.product,
    loadedQty: tl.loaded_qty, deliveredQty: tl.delivered_qty, transitLoss: tl.transit_loss,
    lossPct: tl.loss_pct, driver: tl.driver, depDate: tl.dep_date, arrDate: tl.arr_date,
    status: tl.status, causeNote: tl.cause_note, flagged: tl.flagged,
  };
}

function serializeMaintenanceJob(m) {
  return {
    id: m.id, station: m.station, vehicleId: m.vehicle_id, type: m.type, description: m.description,
    priority: m.priority, status: m.status, contractorId: m.contractor_id, assignedTech: m.assigned_tech,
    scheduledDate: m.scheduled_date, estimatedCompletion: m.estimated_completion,
    actualCompletion: m.actual_completion, cost: m.cost, invoiceNo: m.invoice_no, notes: m.notes,
    createdAt: m.created_at,
  };
}

// Handles the fleet/fuel-ops tables (stations, fleet_vehicles, tank_readings,
// maintenance_jobs, transit_logs). Returns undefined (not { rows }) when the
// query isn't one of these tables, so the caller falls through to the rest
// of the dispatcher.
function handleFleetOpsQuery(t, q, params) {
  // --- stations ---
  if (q.startsWith('select') && q.includes('from stations')) {
    let matches = t.stations;
    if (q.includes('where id')) {
      matches = matches.filter((s) => String(s.id) === String(params[0]));
    }
    return { rows: matches.slice().reverse().map(serializeStation) };
  }
  if (q.startsWith('insert into stations')) {
    const [name, region, manager, address, phone, fuelTypes, tanks, pumps, status, salesTarget] = params;
    const s = {
      id: id(), created_at: new Date().toISOString(), established: null, last_audit: null, lat: null, lng: null,
      daily_sales: 0, monthly_sales: 0, risk_score: 0,
      name, region, manager, address, phone, fuel_types: fuelTypes || [], tanks: tanks || 0, pumps: pumps || 0,
      status: status || 'operational', sales_target: salesTarget ?? null,
    };
    t.stations.push(s);
    return { rows: [serializeStation(s)] };
  }
  if (q.startsWith('update stations set')) {
    const [name, region, manager, address, phone, fuelTypes, tanks, pumps, status, salesTarget, idParam] = params;
    const s = t.stations.find((x) => String(x.id) === String(idParam));
    if (!s) return { rows: [] };
    if (name != null) s.name = name;
    if (region != null) s.region = region;
    if (manager != null) s.manager = manager;
    if (address != null) s.address = address;
    if (phone != null) s.phone = phone;
    if (fuelTypes != null) s.fuel_types = fuelTypes;
    if (tanks != null) s.tanks = tanks;
    if (pumps != null) s.pumps = pumps;
    if (status != null) s.status = status;
    if (salesTarget != null) s.sales_target = salesTarget;
    return { rows: [serializeStation(s)] };
  }
  if (q.startsWith('delete from stations')) {
    const idParam = params[0];
    const idx = t.stations.findIndex((x) => String(x.id) === String(idParam));
    if (idx === -1) return { rows: [], rowCount: 0 };
    t.stations.splice(idx, 1);
    return { rows: [], rowCount: 1 };
  }

  // --- fleet_vehicles ---
  if (q.startsWith('select') && q.includes('from fleet_vehicles')) {
    let matches = t.fleet_vehicles;
    if (q.includes('where id')) {
      matches = matches.filter((v) => String(v.id) === String(params[0]));
    }
    return { rows: matches.slice().reverse().map(serializeVehicle) };
  }
  if (q.startsWith('delete from fleet_vehicles')) {
    const idParam = params[0];
    const idx = t.fleet_vehicles.findIndex((x) => String(x.id) === String(idParam));
    if (idx === -1) return { rows: [], rowCount: 0 };
    t.fleet_vehicles.splice(idx, 1);
    return { rows: [], rowCount: 1 };
  }
  if (q.startsWith('insert into fleet_vehicles')) {
    const [plate, type, capacity, fuel, driver, station, status, insurance, ownership, ownerName] = params;
    const v = {
      id: id(), created_at: new Date().toISOString(), mileage: 0, last_service: null, next_service: null,
      gps_lat: null, gps_lng: null, speed: 0, fuel_level: 0,
      plate, type: type || 'Tanker', capacity: capacity || 0, fuel, driver, station,
      status: status || 'idle', insurance_expiry: insurance || null,
      ownership: ownership || 'owned', owner_name: ownerName || null,
    };
    t.fleet_vehicles.push(v);
    return { rows: [serializeVehicle(v)] };
  }
  if (q.startsWith('update fleet_vehicles set')) {
    const [plate, type, capacity, fuel, driver, station, status, mileage, nextService, insurance, fuelLevel, ownership, ownerName, idParam] = params;
    const v = t.fleet_vehicles.find((x) => String(x.id) === String(idParam));
    if (!v) return { rows: [] };
    if (plate != null) v.plate = plate;
    if (type != null) v.type = type;
    if (capacity != null) v.capacity = capacity;
    if (fuel != null) v.fuel = fuel;
    if (driver != null) v.driver = driver;
    if (station != null) v.station = station;
    if (status != null) v.status = status;
    if (mileage != null) v.mileage = mileage;
    if (nextService != null) v.next_service = nextService;
    if (insurance != null) v.insurance_expiry = insurance;
    if (fuelLevel != null) v.fuel_level = fuelLevel;
    if (ownership != null) v.ownership = ownership;
    if (ownerName != null) v.owner_name = ownerName;
    return { rows: [serializeVehicle(v)] };
  }

  // --- tank_readings (read-only from the API today) ---
  if (q.startsWith('select') && q.includes('from tank_readings')) {
    return { rows: t.tank_readings.map(serializeTankReading) };
  }

  // --- transit_logs ---
  if (q.startsWith('select') && q.includes('from transit_logs')) {
    let matches = t.transit_logs;
    if (q.includes('where id')) {
      matches = matches.filter((tl) => String(tl.id) === String(params[0]));
    }
    return { rows: matches.map(serializeTransitLog) };
  }
  if (q.startsWith('insert into transit_logs')) {
    const [vehicleId, plate, route, product, driver, depDate] = params;
    const tl = {
      id: id(), created_at: new Date().toISOString(), transit_loss: 0, loss_pct: 0, arr_date: null,
      cause_note: null, flagged: false,
      vehicle_id: vehicleId, plate, route, product, driver, dep_date: depDate,
      status: 'loading', loaded_qty: 0, delivered_qty: 0,
    };
    t.transit_logs.push(tl);
    return { rows: [serializeTransitLog(tl)] };
  }
  if (q.startsWith('update transit_logs set loaded_qty')) {
    const [loadedQty, idParam] = params;
    const tl = t.transit_logs.find((x) => String(x.id) === String(idParam));
    if (!tl) return { rows: [] };
    tl.loaded_qty = loadedQty;
    tl.status = 'in-transit';
    return { rows: [serializeTransitLog(tl)] };
  }
  if (q.startsWith('update transit_logs set delivered_qty')) {
    const [deliveredQty, transitLoss, lossPct, flagged, idParam] = params;
    const tl = t.transit_logs.find((x) => String(x.id) === String(idParam));
    if (!tl) return { rows: [] };
    tl.delivered_qty = deliveredQty;
    tl.transit_loss = transitLoss;
    tl.loss_pct = lossPct;
    tl.status = 'completed';
    if (!tl.arr_date) tl.arr_date = new Date().toISOString().slice(0, 10);
    tl.flagged = flagged;
    return { rows: [serializeTransitLog(tl)] };
  }

  // --- fleet_vehicle_compartments ---
  if (q.startsWith('select') && q.includes('from fleet_vehicle_compartments')) {
    let matches = t.fleet_vehicle_compartments;
    if (q.includes('where vehicle_id')) {
      matches = matches.filter((c) => String(c.vehicle_id) === String(params[0]));
    }
    return { rows: matches.map(serializeCompartment) };
  }
  if (q.startsWith('insert into fleet_vehicle_compartments')) {
    const [vehicleId, compartmentNo, capacity] = params;
    let c = t.fleet_vehicle_compartments.find(
      (x) => String(x.vehicle_id) === String(vehicleId) && x.compartment_no === compartmentNo
    );
    if (c) {
      c.capacity = capacity;
    } else {
      c = { id: id(), created_at: new Date().toISOString(), vehicle_id: vehicleId, compartment_no: compartmentNo, capacity };
      t.fleet_vehicle_compartments.push(c);
    }
    return { rows: [serializeCompartment(c)] };
  }

  // --- compartment_readings ---
  if (q.startsWith('select') && q.includes('from compartment_readings')) {
    let matches = t.compartment_readings;
    if (q.includes('where transit_log_id') && q.includes('and stage')) {
      matches = matches.filter((r) => String(r.transit_log_id) === String(params[0]) && r.stage === params[1]);
    } else if (q.includes('where transit_log_id')) {
      matches = matches.filter((r) => String(r.transit_log_id) === String(params[0]));
    }
    return { rows: matches.map(serializeCompartmentReading) };
  }
  if (q.startsWith('insert into compartment_readings')) {
    const [compartmentId, transitLogId, stage, dipCm, volumeLiters, isEmpty, recordedBy] = params;
    const r = {
      id: id(), recorded_at: new Date().toISOString(),
      compartment_id: compartmentId, transit_log_id: transitLogId, stage,
      dip_cm: dipCm, volume_liters: volumeLiters, is_empty: isEmpty, recorded_by: recordedBy,
    };
    t.compartment_readings.push(r);
    return { rows: [serializeCompartmentReading(r)] };
  }

  // --- maintenance_jobs ---
  if (q.startsWith('select') && q.includes('from maintenance_jobs')) {
    return { rows: t.maintenance_jobs.slice().reverse().map(serializeMaintenanceJob) };
  }
  if (q.startsWith('insert into maintenance_jobs')) {
    const [station, vehicleId, type, description, priority, status, assignedTech, scheduledDate, estimatedCompletion, cost, notes] = params;
    const m = {
      id: id(), created_at: new Date().toISOString(), contractor_id: null, actual_completion: null, invoice_no: null,
      station, vehicle_id: vehicleId, type, description, priority: priority || 'medium', status: status || 'scheduled',
      assigned_tech: assignedTech, scheduled_date: scheduledDate, estimated_completion: estimatedCompletion,
      cost: cost || 0, notes,
    };
    t.maintenance_jobs.push(m);
    return { rows: [serializeMaintenanceJob(m)] };
  }
  if (q.startsWith('update maintenance_jobs set')) {
    const [station, type, description, priority, status, assignedTech, scheduledDate, estimatedCompletion, actualCompletion, cost, invoiceNo, notes, idParam] = params;
    const m = t.maintenance_jobs.find((x) => String(x.id) === String(idParam));
    if (!m) return { rows: [] };
    if (station != null) m.station = station;
    if (type != null) m.type = type;
    if (description != null) m.description = description;
    if (priority != null) m.priority = priority;
    if (status != null) m.status = status;
    if (assignedTech != null) m.assigned_tech = assignedTech;
    if (scheduledDate != null) m.scheduled_date = scheduledDate;
    if (estimatedCompletion != null) m.estimated_completion = estimatedCompletion;
    if (actualCompletion != null) m.actual_completion = actualCompletion;
    if (cost != null) m.cost = cost;
    if (invoiceNo != null) m.invoice_no = invoiceNo;
    if (notes != null) m.notes = notes;
    return { rows: [serializeMaintenanceJob(m)] };
  }

  // --- contractors ---
  if (q.startsWith('select') && q.includes('from contractors')) {
    let matches = t.contractors;
    if (q.includes('where id')) {
      matches = matches.filter((c) => String(c.id) === String(params[0]));
    }
    return { rows: matches.slice().reverse().map(serializeContractor) };
  }
  if (q.startsWith('delete from contractors')) {
    const idParam = params[0];
    const idx = t.contractors.findIndex((x) => String(x.id) === String(idParam));
    if (idx === -1) return { rows: [], rowCount: 0 };
    t.contractors.splice(idx, 1);
    return { rows: [], rowCount: 1 };
  }
  if (q.startsWith('insert into contractors')) {
    const [name, contact, email, phone, speciality, region, contractStart, contractExpiry, status, certifications] = params;
    const c = {
      id: id(), created_at: new Date().toISOString(), rating: 4.0, active_jobs: 0, completed_jobs: 0, total_paid: 0,
      name, contact, email, phone, speciality, region, contract_start: contractStart, contract_expiry: contractExpiry,
      status: status || 'active', certifications: certifications || [],
    };
    t.contractors.push(c);
    return { rows: [serializeContractor(c)] };
  }
  if (q.startsWith('update contractors set')) {
    const [name, contact, email, phone, speciality, region, contractStart, contractExpiry, status, idParam] = params;
    const c = t.contractors.find((x) => String(x.id) === String(idParam));
    if (!c) return { rows: [] };
    if (name != null) c.name = name;
    if (contact != null) c.contact = contact;
    if (email != null) c.email = email;
    if (phone != null) c.phone = phone;
    if (speciality != null) c.speciality = speciality;
    if (region != null) c.region = region;
    if (contractStart != null) c.contract_start = contractStart;
    if (contractExpiry != null) c.contract_expiry = contractExpiry;
    if (status != null) c.status = status;
    return { rows: [serializeContractor(c)] };
  }

  // --- suppliers ---
  if (q.startsWith('select') && q.includes('from suppliers')) {
    let matches = t.suppliers;
    if (q.includes('where id')) {
      matches = matches.filter((s) => String(s.id) === String(params[0]));
    }
    return { rows: matches.slice().reverse().map(serializeSupplier) };
  }
  if (q.startsWith('delete from suppliers')) {
    const idParam = params[0];
    const idx = t.suppliers.findIndex((x) => String(x.id) === String(idParam));
    if (idx === -1) return { rows: [], rowCount: 0 };
    t.suppliers.splice(idx, 1);
    return { rows: [], rowCount: 1 };
  }
  if (q.startsWith('insert into suppliers')) {
    const [name, shortCode, contact, email, phone, products, paymentTerms, creditLimit, status, deliveryLeadTime] = params;
    const s = {
      id: id(), created_at: new Date().toISOString(), current_balance: 0, rating: 4.0, total_purchases: 0, last_delivery: null,
      name, short_code: shortCode, contact, email, phone, products: products || [], payment_terms: paymentTerms || 'Net 30',
      credit_limit: creditLimit || 0, status: status || 'active', delivery_lead_time: deliveryLeadTime || 3,
    };
    t.suppliers.push(s);
    return { rows: [serializeSupplier(s)] };
  }
  if (q.startsWith('update suppliers set')) {
    const [name, shortCode, contact, email, phone, products, paymentTerms, creditLimit, status, deliveryLeadTime, currentBalance, lastDelivery, idParam] = params;
    const s = t.suppliers.find((x) => String(x.id) === String(idParam));
    if (!s) return { rows: [] };
    if (name != null) s.name = name;
    if (shortCode != null) s.short_code = shortCode;
    if (contact != null) s.contact = contact;
    if (email != null) s.email = email;
    if (phone != null) s.phone = phone;
    if (products != null) s.products = products;
    if (paymentTerms != null) s.payment_terms = paymentTerms;
    if (creditLimit != null) s.credit_limit = creditLimit;
    if (status != null) s.status = status;
    if (deliveryLeadTime != null) s.delivery_lead_time = deliveryLeadTime;
    if (currentBalance != null) s.current_balance = currentBalance;
    if (lastDelivery != null) s.last_delivery = lastDelivery;
    return { rows: [serializeSupplier(s)] };
  }

  // --- alerts ---
  if (q.startsWith('select') && q.includes('from alerts')) {
    return { rows: t.alerts.slice().reverse().map(serializeAlert) };
  }
  if (q.startsWith('insert into alerts')) {
    const [type, severity, title, message, stationId, station, assignedTo] = params;
    const a = {
      id: id(), created_at: new Date().toISOString(), status: 'active',
      type, severity: severity || 'info', title, message, station_id: stationId, station_name: station, assigned_to: assignedTo,
    };
    t.alerts.push(a);
    return { rows: [serializeAlert(a)] };
  }
  if (q.startsWith("update alerts set status = 'acknowledged'")) {
    const idParam = params[0];
    const a = t.alerts.find((x) => String(x.id) === String(idParam) && x.status === 'active');
    if (!a) return { rows: [] };
    a.status = 'acknowledged';
    return { rows: [serializeAlert(a)] };
  }
  if (q.startsWith("update alerts set status = 'dismissed'")) {
    const idParam = params[0];
    const a = t.alerts.find((x) => String(x.id) === String(idParam) && x.status === 'active');
    if (!a) return { rows: [] };
    a.status = 'dismissed';
    return { rows: [serializeAlert(a)] };
  }

  // --- tanks (master entity, separate from tank_readings snapshots) ---
  if (q.startsWith('select') && q.includes('from tanks')) {
    return { rows: t.tanks.map(serializeTankMaster) };
  }
  if (q.startsWith('insert into tanks')) {
    const [stationId, tankNo, product, capacity] = params;
    let tank = t.tanks.find((x) => String(x.station_id) === String(stationId) && x.tank_no === tankNo);
    if (tank) {
      tank.product = product;
      if (capacity != null) tank.capacity = capacity;
    } else {
      tank = { id: id(), created_at: new Date().toISOString(), station_id: stationId, tank_no: tankNo, product, capacity: capacity || 0 };
      t.tanks.push(tank);
    }
    return { rows: [serializeTankMaster(tank)] };
  }

  // --- nozzles ---
  if (q.startsWith('select') && q.includes('from nozzles')) {
    return { rows: t.nozzles.map(serializeNozzle) };
  }
  if (q.startsWith('insert into nozzles')) {
    const [stationId, tankId, label, product] = params;
    const n = { id: id(), created_at: new Date().toISOString(), status: 'active', station_id: stationId, tank_id: tankId, label, product };
    t.nozzles.push(n);
    return { rows: [serializeNozzle(n)] };
  }

  // --- nozzle_readings ---
  if (q.startsWith('select') && q.includes('from nozzle_readings')) {
    return { rows: t.nozzle_readings.slice().reverse().map(serializeNozzleReading) };
  }
  if (q.startsWith('insert into nozzle_readings')) {
    const [nozzleId, readingDate, openingMeter, closingMeter, recordedBy] = params;
    const r = {
      id: id(), recorded_at: new Date().toISOString(),
      nozzle_id: nozzleId, reading_date: readingDate, opening_meter: openingMeter,
      closing_meter: closingMeter, recorded_by: recordedBy,
    };
    t.nozzle_readings.push(r);
    return { rows: [serializeNozzleReading(r)] };
  }

  // --- deletion_requests ---
  if (q.startsWith('insert into deletion_requests')) {
    const [module, recordId, recordLabel, reason, requestedBy] = params;
    const d = {
      id: id(), created_at: new Date().toISOString(), status: 'pending', resolved_by: null, resolved_at: null,
      module, record_id: recordId, record_label: recordLabel, reason, requested_by: requestedBy,
    };
    t.deletion_requests.push(d);
    return { rows: [serializeDeletionRequest(d)] };
  }
  if (q.startsWith('select') && q.includes('from deletion_requests')) {
    let matches = t.deletion_requests;
    if (q.includes('where id')) {
      matches = matches.filter((d) => String(d.id) === String(params[0]));
    }
    return { rows: matches.slice().reverse().map(serializeDeletionRequest) };
  }
  if (q.startsWith('update deletion_requests set status')) {
    const [status, resolvedBy, idParam] = params;
    const d = t.deletion_requests.find((x) => String(x.id) === String(idParam) && x.status === 'pending');
    if (!d) return { rows: [] };
    d.status = status;
    d.resolved_by = resolvedBy;
    d.resolved_at = new Date().toISOString();
    return { rows: [serializeDeletionRequest(d)] };
  }

  // --- company_settings (singleton) ---
  if (q.startsWith('select') && q.includes('from company_settings')) {
    if (!t.company_settings) return { rows: [] };
    const s = t.company_settings;
    return { rows: [{ companyName: s.company_name, logoDataUri: s.logo_data_uri, contactEmail: s.contact_email, theme: s.theme, updatedAt: s.updated_at }] };
  }
  if (q.startsWith('insert into company_settings')) {
    const [, companyName, logoDataUri, contactEmail, theme] = params; // params[0] is the fixed singleton id
    const existing = t.company_settings || {};
    t.company_settings = {
      company_name: companyName ?? existing.company_name ?? null,
      logo_data_uri: logoDataUri ?? existing.logo_data_uri ?? null,
      contact_email: contactEmail ?? existing.contact_email ?? null,
      theme: theme ?? existing.theme ?? 'dark',
      updated_at: new Date().toISOString(),
    };
    const s = t.company_settings;
    return { rows: [{ companyName: s.company_name, logoDataUri: s.logo_data_uri, contactEmail: s.contact_email, theme: s.theme, updatedAt: s.updated_at }] };
  }

  return undefined;
}

export function getTenantPool(dbName) {
  const t = makeTenant(dbName);
  return {
    async query(text, params=[]) {
      const q = (text||'').trim().toLowerCase();

      const fleetOpsResult = handleFleetOpsQuery(t, q, params);
      if (fleetOpsResult) return fleetOpsResult;

      // find role id
      if (q.startsWith("select id from roles where name")) {
        const name = params[0];
        const role = t.roles.find(r => r.name === name && r.is_system === true);
        return { rows: role ? [ { id: role.id } ] : [] };
      }
      if (q.startsWith('select id from roles where id') || (q.includes('from roles') && q.includes('where id ='))) {
        const idParam = params[0];
        const role = t.roles.find(r => String(r.id) === String(idParam));
        return { rows: role ? [ { id: role.id } ] : [] };
      }

      if (q.startsWith('insert into users')) {
        const email = params[0];
        const password_hash = params[1];
        const name = params[2];
        const role_id = params[3];
        const station_id = params[4] || null;
        const user = { id: id(), email, password_hash, name, role_id, station_id, status: 'active', created_at: new Date().toISOString() };
        t.users.push(user);
        // RETURNING never includes password_hash — mirror that here rather
        // than leaking the internal record straight back to the client.
        return { rows: [{ id: user.id, email: user.email, name: user.name, role_id: user.role_id, station_id: user.station_id, status: user.status, created_at: user.created_at }] };
      }

      // Checked before the generic "update users set" block below — both
      // start with the same prefix, but this one's params are
      // [passwordHash, userId], not [name, roleId, status, stationId, id].
      if (q.startsWith('update users set password_hash')) {
        const [passwordHash, idParam] = params;
        const u = t.users.find(x => String(x.id) === String(idParam));
        if (!u) return { rows: [] };
        u.password_hash = passwordHash;
        return { rows: [{ id: u.id, email: u.email, name: u.name }] };
      }

      if (q.startsWith('update users set')) {
        const idParam = params[params.length - 1];
        const u = t.users.find(x => String(x.id) === String(idParam));
        if (!u) return { rows: [] };
        const [name, roleId, status, stationId] = params;
        if (name != null) u.name = name;
        if (roleId != null) u.role_id = roleId;
        if (status != null) u.status = status;
        if (stationId != null) u.station_id = stationId;
        return { rows: [{ id: u.id, email: u.email, name: u.name, role_id: u.role_id, station_id: u.station_id, status: u.status }] };
      }

      if (q.startsWith('insert into audit_log')) {
        const [userId, action, module, details] = params;
        t.audit_log.push({ id: id(), created_at: new Date().toISOString(), user_id: userId, action, module, details });
        return { rows: [] };
      }
      if (q.startsWith('select a.id, a.action')) {
        const rows = t.audit_log.slice().reverse().slice(0, 200).map((a) => ({
          id: a.id, action: a.action, module: a.module, details: a.details, created_at: a.created_at,
          user_email: (t.users.find((u) => String(u.id) === String(a.user_id)) || {}).email || null,
        }));
        return { rows };
      }

      if (q.startsWith('insert into roles')) {
        // INSERT INTO roles (name, description, is_system) VALUES ($1,$2,$3) RETURNING id
        const name = params[0];
        const description = params[1];
        const is_system = params[2];
        const role = { id: id(), name, description, is_system };
        t.roles.push(role);
        return { rows: [ { id: role.id } ] };
      }

      if (q.startsWith('select * from roles')) {
        // return roles with some default columns
        const rows = t.roles.map(r => ({ id: r.id, name: r.name, description: r.description || null, is_system: !!r.is_system, created_at: new Date().toISOString() }));
        return { rows };
      }

      if (q.startsWith('insert into permissions')) {
        // INSERT INTO permissions (role_id, module, can_read, can_write, can_approve)
        const role_id = params[0];
        const module = params[1];
        const can_read = params[2];
        const can_write = params[3];
        const can_approve = params[4];
        t.permissions.push({ id: id(), role_id, module, can_read, can_write, can_approve });
        return { rows: [] };
      }

      if (q.startsWith('select * from permissions') || q.startsWith('select module, can_read, can_write, can_approve from permissions')) {
        const rows = t.permissions.map(p => ({ id: p.id, role_id: p.role_id, module: p.module, can_read: p.can_read, can_write: p.can_write, can_approve: p.can_approve }));
        return { rows };
      }

      if (q.includes('from users') && q.includes('where u.email')) {
        const email = params[0];
        const user = t.users.find(u => u.email === email);
        if (!user) return { rows: [] };
        const role = t.roles.find(r => r.id === user.role_id) || {};
        const station = user.station_id ? t.stations.find(s => String(s.id) === String(user.station_id)) : null;
        return { rows: [ { ...user, role_name: role.name, station_name: station?.name || null } ] };
      }

      if (q.startsWith('select u.id, u.email') || q.startsWith('select u.id, u.email, u.name')) {
        const rows = t.users.map(u => ({
          id: u.id, email: u.email, name: u.name, status: u.status, created_at: u.created_at,
          role_id: u.role_id, role_name: (t.roles.find(r=>r.id===u.role_id)||{}).name,
          station_id: u.station_id || null, station_name: (t.stations.find(s=>String(s.id)===String(u.station_id))||{}).name || null,
        }));
        return { rows };
      }

      if (q.startsWith('select u.id, u.email, u.name, r.id as role_id')) {
        const rows = t.users.map(u => ({
          id: u.id, email: u.email, name: u.name, status: u.status, created_at: u.created_at,
          role_id: u.role_id, role_name: (t.roles.find(r=>r.id===u.role_id)||{}).name,
          station_id: u.station_id || null, station_name: (t.stations.find(s=>String(s.id)===String(u.station_id))||{}).name || null,
        }));
        return { rows };
      }

      if (q.startsWith('select u.id, u.email, u.name, r.id as role_id, r.name as role_name')) {
        const rows = t.users.map(u => ({
          id: u.id, email: u.email, name: u.name, status: u.status, created_at: u.created_at,
          role_id: u.role_id, role_name: (t.roles.find(r=>r.id===u.role_id)||{}).name,
          station_id: u.station_id || null, station_name: (t.stations.find(s=>String(s.id)===String(u.station_id))||{}).name || null,
        }));
        return { rows };
      }

      if (q.startsWith("select u.id, u.email, u.name, r.id as role_id, r.name as role_name from users u left join roles r")) {
        const rows = t.users.map(u => ({
          id: u.id, email: u.email, name: u.name, status: u.status, created_at: u.created_at,
          role_id: u.role_id, role_name: (t.roles.find(r=>r.id===u.role_id)||{}).name,
          station_id: u.station_id || null, station_name: (t.stations.find(s=>String(s.id)===String(u.station_id))||{}).name || null,
        }));
        return { rows };
      }

      if (q.startsWith('select u.id, u.email, u.name, r.id as role_id, r.name as role_name where u.id')) {
        const idParam = params[0];
        const u = t.users.find(x => String(x.id) === String(idParam));
        if (!u) return { rows: [] };
        const perms = t.permissions.filter(p => p.role_id === u.role_id);
        return { rows: [u], permRows: perms };
      }

      // permissions
      if (q.startsWith('select module, can_read, can_write, can_approve from permissions')) {
        const role_id = params[0];
        const rows = t.permissions.filter(p => p.role_id === role_id).map(p => ({ module: p.module, can_read: p.can_read, can_write: p.can_write, can_approve: p.can_approve }));
        return { rows };
      }

      // fallback
      return { rows: [] };
    }
  };
}

export default { platformQuery, getTenantPool, initDevData };

export function debugState() {
  return { platform: { ...platform }, tenants: Array.from(tenants.entries()).map(([k,v])=>({ dbName: k, roles: v.roles.length, users: v.users.length })) };
}
