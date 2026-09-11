/**
 * One-off bulk importer for a company's demo/seed data from an xlsx
 * workbook shaped like PetroNet_Corp_Dummy_Data.xlsx: one sheet per
 * module, an annotation row, a header row, then data rows. Inserts
 * directly into the target company's Postgres schema — bypasses the
 * app's HTTP API entirely (no login/session needed), which is fine for
 * seeding historical/demo rows but skips any request-time validation
 * the routes normally do, so only point this at trusted data.
 *
 * Usage: node scripts/import_xlsx_data.js <path-to-xlsx> <schema_name>
 */
import XLSX from 'xlsx'
import pg from 'pg'
import 'dotenv/config'

const { Client } = pg

const [, , xlsxPath, schemaName] = process.argv
if (!xlsxPath || !schemaName) {
  console.error('Usage: node scripts/import_xlsx_data.js <path-to-xlsx> <schema_name>')
  process.exit(1)
}

function rowsFromSheet(wb, sheetName) {
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null })
  // The 1-2 rows above the real header are annotations: a single long
  // sentence in column A, nothing else. The real header row has multiple
  // short (<40 char) tokens across several columns — find the first row
  // matching that shape and treat everything after it as data.
  const headerIdx = raw.findIndex(
    (r) => r.filter((c) => c != null).length > 1 && r.every((c) => c == null || String(c).length < 40)
  )
  if (headerIdx === -1) throw new Error(`Could not find a header row in sheet "${sheetName}"`)
  const headers = raw[headerIdx]
  return raw.slice(headerIdx + 1).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? null])))
}

function toDate(v) {
  if (!v) return null
  if (typeof v === 'number') {
    // Excel serial date
    return new Date(Math.round((v - 25569) * 86400 * 1000)).toISOString().slice(0, 10)
  }
  return String(v).slice(0, 10)
}

async function main() {
  const wb = XLSX.readFile(xlsxPath)
  const client = new Client({
    host: process.env.PG_APP_HOST,
    port: process.env.PG_APP_PORT,
    user: process.env.PG_APP_USER,
    password: process.env.PG_APP_PASSWORD,
    database: process.env.PG_DB_NAME,
  })
  await client.connect()
  await client.query(`SET search_path TO "${schemaName}", public`)

  const counts = {}

  // --- Stations ---
  const stations = rowsFromSheet(wb, 'Stations')
  const stationIdByName = new Map()
  for (const s of stations) {
    const { rows } = await client.query(
      `INSERT INTO stations (name, region, manager, status, monthly_sales, risk_score)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name`,
      [s.name, s.region, s.manager, s.status || 'operational', s.monthlySales || 0, s.riskScore || 0]
    )
    stationIdByName.set(rows[0].name, rows[0].id)
  }
  counts.stations = stations.length

  // --- Fleet Vehicles ---
  const fleet = rowsFromSheet(wb, 'Fleet Vehicles')
  const vehicleIdByPlate = new Map()
  for (const v of fleet) {
    const { rows } = await client.query(
      `INSERT INTO fleet_vehicles (plate, type, driver, status, mileage)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, plate`,
      [v.plate, v.type || 'Tanker', v.driver, v.status || 'idle', v.mileage || 0]
    )
    vehicleIdByPlate.set(rows[0].plate, rows[0].id)
  }
  counts.fleet = fleet.length

  // --- Tank Readings --- (a starting snapshot: opening/closing/sales
  // aren't in this import format, so they're set equal to currentLevel /
  // zero rather than invented — see README for the honest-data policy.)
  const tankReadings = rowsFromSheet(wb, 'Tank Readings')
  for (const t of tankReadings) {
    const stationId = stationIdByName.get(t.stationName)
    const variancePct = Number(t.variancePct) || 0
    const status = Math.abs(variancePct) > 3 ? 'anomaly' : Math.abs(variancePct) > 1.5 ? 'critical' : Math.abs(variancePct) > 0.5 ? 'warning' : 'normal'
    // Capacity isn't in this import format either — estimated assuming
    // the current level represents roughly 60% fill, rounded up to the
    // nearest 1000L. Flagged here, not hidden, so it's easy to correct.
    const capacity = Math.ceil((Number(t.currentLevel) || 0) / 0.6 / 1000) * 1000
    await client.query(
      `INSERT INTO tank_readings (station_id, station_name, tank_no, product, capacity, current_level, opening_stock, closing_stock, received, sales_volume, variance, variance_pct, status)
       VALUES ($1,$2,$3,$4,$5,$6,$6,$6,0,0,0,$7,$8)`,
      [stationId || null, t.stationName, t.tankNo, t.product, capacity, t.currentLevel, variancePct, status]
    )
  }
  counts.tankReadings = tankReadings.length

  // --- Maintenance Jobs ---
  const maintenance = rowsFromSheet(wb, 'Maintenance Jobs')
  for (const m of maintenance) {
    const vehicleId = m.vehicle_plate ? vehicleIdByPlate.get(m.vehicle_plate) : null
    await client.query(
      `INSERT INTO maintenance_jobs (station, vehicle_id, type, description, priority, status, assigned_tech, scheduled_date, cost)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [m.station || null, vehicleId || null, m.type, m.description, m.priority || 'medium', m.status || 'scheduled', m.assigned_tech, toDate(m.scheduled_date), m.cost || 0]
    )
  }
  counts.maintenance = maintenance.length

  // --- Transit Logs ---
  const transitLogs = rowsFromSheet(wb, 'Transit Logs')
  for (const t of transitLogs) {
    const vehicleId = vehicleIdByPlate.get(t.plate)
    const loaded = Number(t.loaded_qty) || 0
    const delivered = Number(t.delivered_qty) || 0
    const transitLoss = loaded - delivered
    const lossPct = loaded ? (transitLoss / loaded) * 100 : 0
    await client.query(
      `INSERT INTO transit_logs (vehicle_id, plate, route, product, loaded_qty, delivered_qty, transit_loss, loss_pct, driver, dep_date, arr_date, status, flagged)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [vehicleId || null, t.plate, t.route, t.product, loaded, delivered, transitLoss, lossPct, t.driver, toDate(t.dep_date), toDate(t.arr_date), t.status || 'completed', !!t.flagged]
    )
  }
  counts.transitLogs = transitLogs.length

  // --- Contractors ---
  const contractors = rowsFromSheet(wb, 'Contractors')
  for (const c of contractors) {
    await client.query(
      `INSERT INTO contractors (name, contact, email, phone, speciality, region, rating, contract_start, contract_expiry, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [c.name, c.contact, c.email, c.phone, c.speciality, c.region, c.rating || 4.0, toDate(c.contract_start), toDate(c.contract_expiry), c.status || 'active']
    )
  }
  counts.contractors = contractors.length

  // --- Suppliers ---
  const suppliers = rowsFromSheet(wb, 'Suppliers')
  for (const s of suppliers) {
    const products = String(s.products || '').split(',').map((p) => p.trim()).filter(Boolean)
    await client.query(
      `INSERT INTO suppliers (name, short_code, contact, email, phone, products, payment_terms, credit_limit, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [s.name, s.short_code, s.contact, s.email, s.phone, products, s.payment_terms, s.credit_limit || 0, s.status || 'active']
    )
  }
  counts.suppliers = suppliers.length

  // --- Alerts ---
  const alerts = rowsFromSheet(wb, 'Alerts')
  for (const a of alerts) {
    const stationId = a.station_name ? stationIdByName.get(a.station_name) : null
    await client.query(
      `INSERT INTO alerts (type, severity, title, message, station_id, station_name, status, assigned_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [a.type, a.severity || 'info', a.title, a.message, stationId || null, a.station_name || null, a.status || 'active', a.assigned_to || null]
    )
  }
  counts.alerts = alerts.length

  // --- HR Employees ---
  const hr = rowsFromSheet(wb, 'HR Employees')
  for (const h of hr) {
    await client.query(
      `INSERT INTO hr_employees (name, email, role, department, status, hired_at) VALUES ($1,$2,$3,$4,$5,$6)`,
      [h.name, h.email, h.role, h.department, h.status || 'active', toDate(h.hired_at)]
    )
  }
  counts.hr = hr.length

  // --- Finance Invoices ---
  const invoices = rowsFromSheet(wb, 'Finance Invoices')
  for (const i of invoices) {
    await client.query(
      `INSERT INTO finance_invoices (invoice_number, vendor, amount, status, due_date) VALUES ($1,$2,$3,$4,$5)`,
      [i.invoice_number, i.vendor, i.amount, i.status || 'pending', toDate(i.due_date)]
    )
  }
  counts.invoices = invoices.length

  // --- Procurement Orders ---
  const orders = rowsFromSheet(wb, 'Procurement Orders')
  for (const o of orders) {
    await client.query(
      `INSERT INTO procurement_orders (order_number, supplier, total_amount, status, expected_delivery) VALUES ($1,$2,$3,$4,$5)`,
      [o.order_number, o.supplier, o.total_amount, o.status || 'ordered', toDate(o.expected_delivery)]
    )
  }
  counts.procurement = orders.length

  // --- Compliance Cases ---
  const cases = rowsFromSheet(wb, 'Compliance Cases')
  for (const c of cases) {
    await client.query(
      `INSERT INTO compliance_cases (title, category, assigned_to, priority, status, opened_at) VALUES ($1,$2,$3,$4,$5,$6)`,
      [c.title, c.category, c.assigned_to, c.priority || 'medium', c.status || 'open', toDate(c.opened_at)]
    )
  }
  counts.compliance = cases.length

  await client.end()
  console.log('Imported:', counts)
}

main().catch((err) => {
  console.error('Import failed:', err)
  process.exit(1)
})
