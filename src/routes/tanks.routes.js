import { Router } from 'express'
import { getTenantPool } from '../db/tenantDb.js'
import { requireAuth, requireCompanyUser } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permissions.js'
import { stationScopeFilterById } from '../utils/stationScope.js'

const router = Router()
router.use(requireAuth, requireCompanyUser)

// Tanks live under the "stations" module permission — same as the Tanks
// page route gate in App.jsx (moduleKey="stations").

const TRANSIT_COLUMNS = `id, vehicle_id AS "vehicleId", plate, route, product, loaded_qty AS "loadedQty",
  delivered_qty AS "deliveredQty", transit_loss AS "transitLoss", loss_pct AS "lossPct",
  driver, dep_date AS "depDate", arr_date AS "arrDate", status, cause_note AS "causeNote", flagged`

const READING_COLUMNS = `id, compartment_id AS "compartmentId", transit_log_id AS "transitLogId", stage,
  dip_cm AS "dipCm", volume_liters AS "volumeLiters", is_empty AS "isEmpty",
  recorded_by AS "recordedBy", recorded_at AS "recordedAt"`

router.get('/readings', requirePermission('stations', 'read'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `SELECT id, station_id, station_name AS "stationName", tank_no AS "tankNo", product, capacity,
        current_level AS "currentLevel", opening_stock AS "openingStock", closing_stock AS "closingStock",
        received, sales_volume AS "salesVolume", variance, variance_pct AS "variancePct",
        reading_date AS date, status
       FROM tank_readings ORDER BY reading_date DESC, tank_no`
    )
    res.json(stationScopeFilterById(req, rows, 'station_id'))
  } catch (err) {
    next(err)
  }
})

// Transit logs are vehicle/route-based rather than tied to one station
// (a delivery run crosses stations by nature), so they aren't station-scoped.
router.get('/transit-logs', requirePermission('stations', 'read'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(`SELECT ${TRANSIT_COLUMNS} FROM transit_logs ORDER BY dep_date DESC`)
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

// POST /tanks/transit-logs - open a new trip. Starts in "loading" status;
// recording the loading-stage compartment dips (below) moves it to
// "in-transit", and the delivery-stage dips move it to "completed".
router.post('/transit-logs', requirePermission('stations', 'write'), async (req, res, next) => {
  try {
    const { vehicleId, route, product, driver, depDate } = req.body
    if (!vehicleId || !route || !product) {
      return res.status(400).json({ error: 'vehicleId, route and product are required' })
    }

    const pool = getTenantPool(req.auth.dbName)
    const { rows: vehicleRows } = await pool.query(`SELECT plate FROM fleet_vehicles WHERE id = $1`, [vehicleId])
    if (!vehicleRows.length) return res.status(400).json({ error: 'Invalid vehicleId' })

    const { rows } = await pool.query(
      `INSERT INTO transit_logs (vehicle_id, plate, route, product, driver, dep_date, status, loaded_qty, delivered_qty)
       VALUES ($1, $2, $3, $4, $5, $6, 'loading', 0, 0)
       RETURNING ${TRANSIT_COLUMNS}`,
      [vehicleId, vehicleRows[0].plate, route, product, driver || null, depDate || new Date().toISOString().slice(0, 10)]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

// GET /tanks/transit-logs/:id/compartment-readings - the full dip sheet
// for one trip (both loading and delivery stage rows), joined with each
// compartment's number for display.
router.get('/transit-logs/:id/compartment-readings', requirePermission('stations', 'read'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const [readingsRes, compartmentsRes] = await Promise.all([
      pool.query(`SELECT ${READING_COLUMNS} FROM compartment_readings WHERE transit_log_id = $1 ORDER BY recorded_at`, [req.params.id]),
      pool.query(`SELECT id, compartment_no AS "compartmentNo", capacity FROM fleet_vehicle_compartments`),
    ])
    const compartmentsById = new Map(compartmentsRes.rows.map((c) => [String(c.id), c]))
    const rows = readingsRes.rows.map((r) => ({
      ...r,
      compartmentNo: compartmentsById.get(String(r.compartmentId))?.compartmentNo ?? null,
    }))
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

// POST /tanks/transit-logs/:id/compartment-readings - record the dip
// sheet for one stage of a trip. body: { stage: 'loading'|'delivery',
// readings: [{ compartmentId, dipCm, volumeLiters, isEmpty }, ...] }.
// Every registered compartment on the vehicle should get a row, including
// ones going out empty — that's what "is_empty" is for, so the delivery
// note is a full account of the truck, not just the loaded compartments.
router.post('/transit-logs/:id/compartment-readings', requirePermission('stations', 'write'), async (req, res, next) => {
  try {
    const { stage, readings } = req.body
    if (!['loading', 'delivery'].includes(stage)) {
      return res.status(400).json({ error: "stage must be 'loading' or 'delivery'" });
    }
    if (!Array.isArray(readings) || !readings.length) {
      return res.status(400).json({ error: 'readings must be a non-empty array' });
    }

    const pool = getTenantPool(req.auth.dbName)
    const { rows: tripRows } = await pool.query(`SELECT ${TRANSIT_COLUMNS} FROM transit_logs WHERE id = $1`, [req.params.id])
    if (!tripRows.length) return res.status(404).json({ error: 'Trip not found' })

    const saved = []
    for (const r of readings) {
      if (!r.compartmentId) continue
      const { rows } = await pool.query(
        `INSERT INTO compartment_readings (compartment_id, transit_log_id, stage, dip_cm, volume_liters, is_empty, recorded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${READING_COLUMNS}`,
        [r.compartmentId, req.params.id, stage, r.isEmpty ? null : (r.dipCm ?? null), r.isEmpty ? 0 : (r.volumeLiters || 0),
          !!r.isEmpty, req.auth.email]
      )
      saved.push(rows[0])
    }

    // Recompute the trip's totals for this stage from every reading ever
    // recorded for it at this stage (not just this submission), so a
    // dip sheet entered in a few batches still ends up correct.
    const { rows: stageRows } = await pool.query(
      `SELECT volume_liters FROM compartment_readings WHERE transit_log_id = $1 AND stage = $2`,
      [req.params.id, stage]
    )
    const stageTotal = stageRows.reduce((sum, r) => sum + Number(r.volume_liters), 0)

    const trip = tripRows[0]
    let updateSql, updateParams;
    if (stage === 'loading') {
      updateSql = `UPDATE transit_logs SET loaded_qty = $1, status = 'in-transit' WHERE id = $2 RETURNING ${TRANSIT_COLUMNS}`;
      updateParams = [stageTotal, req.params.id];
    } else {
      const loadedQty = Number(trip.loadedQty) || 0;
      const transitLoss = loadedQty - stageTotal;
      const lossPct = loadedQty ? (transitLoss / loadedQty) * 100 : 0;
      updateSql = `UPDATE transit_logs SET delivered_qty = $1, transit_loss = $2, loss_pct = $3, status = 'completed',
                    arr_date = COALESCE(arr_date, current_date), flagged = $4
                   WHERE id = $5 RETURNING ${TRANSIT_COLUMNS}`;
      updateParams = [stageTotal, transitLoss, lossPct, lossPct > 1, req.params.id];
    }
    const { rows: updatedTrip } = await pool.query(updateSql, updateParams)

    res.status(201).json({ readings: saved, trip: updatedTrip[0] })
  } catch (err) {
    next(err)
  }
})

export default router
