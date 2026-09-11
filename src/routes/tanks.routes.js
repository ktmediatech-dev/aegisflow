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
  driver, dep_date AS "depDate", dep_at AS "depAt", arr_date AS "arrDate", arr_at AS "arrAt",
  status, cause_note AS "causeNote", flagged`

const READING_COLUMNS = `id, compartment_id AS "compartmentId", transit_log_id AS "transitLogId", stage,
  dip_cm AS "dipCm", volume_liters AS "volumeLiters", is_empty AS "isEmpty", product, tank_id AS "tankId",
  recorded_by AS "recordedBy", recorded_at AS "recordedAt"`

const OFFLOAD_COLUMNS = `id, transit_log_id AS "transitLogId", tank_id AS "tankId",
  opening_dip_cm AS "openingDipCm", opening_volume_liters AS "openingVolumeLiters",
  delivered_volume_liters AS "deliveredVolumeLiters", sales_during_offload_liters AS "salesDuringOffloadLiters",
  expected_closing_volume_liters AS "expectedClosingVolumeLiters", recorded_by AS "recordedBy", recorded_at AS "recordedAt"`

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

// POST /tanks/transit-logs - open a new trip at the depot. Starts in
// "loading" status; recording the loading-stage compartment dips (below)
// captures departure time and moves it to "in-transit". Trip lifecycle:
// loading -> in-transit -> arrived -> completed.
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

// PATCH /tanks/transit-logs/:id/arrive - station manager marks the truck
// as physically arrived. Must happen before any delivery-stage dipping —
// mirrors departure being captured at the depot before loading dips.
router.patch('/transit-logs/:id/arrive', requirePermission('stations', 'write'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `UPDATE transit_logs SET arr_at = COALESCE($1, now()), arr_date = COALESCE(arr_date, current_date), status = 'arrived'
       WHERE id = $2 AND status = 'in-transit'
       RETURNING ${TRANSIT_COLUMNS}`,
      [req.body?.arrivedAt || null, req.params.id]
    )
    if (!rows.length) return res.status(400).json({ error: 'Trip not found or not currently in-transit' })
    res.json(rows[0])
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

// POST /tanks/transit-logs/:id/tank-opening-dip - station manager captures
// a receiving tank's dip/volume BEFORE offloading starts. Required before
// that tank can appear as a target for delivery-stage compartment readings.
router.post('/transit-logs/:id/tank-opening-dip', requirePermission('stations', 'write'), async (req, res, next) => {
  try {
    const { tankId, openingDipCm, openingVolumeLiters } = req.body
    if (!tankId || openingVolumeLiters == null) {
      return res.status(400).json({ error: 'tankId and openingVolumeLiters are required' })
    }

    const pool = getTenantPool(req.auth.dbName)
    const { rows: tripRows } = await pool.query(`SELECT ${TRANSIT_COLUMNS} FROM transit_logs WHERE id = $1`, [req.params.id])
    if (!tripRows.length) return res.status(404).json({ error: 'Trip not found' })
    if (!['arrived', 'completed'].includes(tripRows[0].status)) {
      return res.status(400).json({ error: 'Record arrival before capturing a tank opening dip' })
    }

    const { rows } = await pool.query(
      `INSERT INTO tank_offload_readings (transit_log_id, tank_id, opening_dip_cm, opening_volume_liters, recorded_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (transit_log_id, tank_id) DO UPDATE SET
         opening_dip_cm = EXCLUDED.opening_dip_cm, opening_volume_liters = EXCLUDED.opening_volume_liters
       RETURNING ${OFFLOAD_COLUMNS}`,
      [req.params.id, tankId, openingDipCm ?? null, openingVolumeLiters, req.auth.email]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

// GET /tanks/transit-logs/:id/tank-offload-summary - per-tank opening dip,
// delivered volume, concurrent sales, and expected closing volume for
// this trip's offload. Compare "expectedClosingVolumeLiters" against that
// tank's next physical tank_readings entry to catch loss at the tank.
router.get('/transit-logs/:id/tank-offload-summary', requirePermission('stations', 'read'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const [offloadRes, tanksRes] = await Promise.all([
      pool.query(`SELECT ${OFFLOAD_COLUMNS} FROM tank_offload_readings WHERE transit_log_id = $1`, [req.params.id]),
      pool.query(`SELECT id, tank_no AS "tankNo", product FROM tanks`),
    ])
    const tanksById = new Map(tanksRes.rows.map((t) => [String(t.id), t]))
    const rows = offloadRes.rows.map((o) => ({ ...o, tank: tanksById.get(String(o.tankId)) || null }))
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

// POST /tanks/transit-logs/:id/compartment-readings - record the dip
// sheet for one stage of a trip.
//   loading:  { stage: 'loading', readings: [{ compartmentId, dipCm, volumeLiters, isEmpty, product }] }
//   delivery: { stage: 'delivery', readings: [{ compartmentId, dipCm, volumeLiters, isEmpty, tankId }] }
// Every registered compartment on the vehicle should get a row, including
// ones going out empty — that's what "is_empty" is for, so the delivery
// note is a full account of the truck, not just the loaded compartments.
// A compartment always goes entirely into one tank (never split), and its
// product must match that tank's product — PMS only into a PMS tank, AGO
// only into AGO, BIK only into BIK. No mixing, enforced here.
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
    const trip = tripRows[0]

    if (stage === 'delivery' && trip.status !== 'arrived' && trip.status !== 'completed') {
      return res.status(400).json({ error: 'Record arrival before entering delivery dips' })
    }

    // Product-match validation for delivery: look up what each compartment
    // was loaded with, and what product the target tank actually holds.
    let loadedProductByCompartment = new Map()
    let tanksById = new Map()
    if (stage === 'delivery') {
      const [loadingRes, tanksRes] = await Promise.all([
        pool.query(`SELECT compartment_id, product FROM compartment_readings WHERE transit_log_id = $1 AND stage = 'loading'`, [req.params.id]),
        pool.query(`SELECT id, tank_no, product FROM tanks`),
      ])
      loadedProductByCompartment = new Map(loadingRes.rows.map((r) => [String(r.compartment_id), r.product]))
      tanksById = new Map(tanksRes.rows.map((t) => [String(t.id), t]))

      for (const r of readings) {
        if (r.isEmpty || !r.compartmentId) continue
        if (!r.tankId) return res.status(400).json({ error: `A target tank is required for compartment ${r.compartmentId}` })
        const tank = tanksById.get(String(r.tankId))
        if (!tank) return res.status(400).json({ error: `Invalid tankId: ${r.tankId}` })
        const loadedProduct = loadedProductByCompartment.get(String(r.compartmentId))
        if (loadedProduct && loadedProduct !== tank.product) {
          return res.status(400).json({
            error: `Product mismatch: compartment loaded with ${loadedProduct} cannot be offloaded into ${tank.tank_no} (${tank.product})`,
          })
        }
      }
    }

    const saved = []
    for (const r of readings) {
      if (!r.compartmentId) continue
      const { rows } = await pool.query(
        `INSERT INTO compartment_readings (compartment_id, transit_log_id, stage, dip_cm, volume_liters, is_empty, product, tank_id, recorded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING ${READING_COLUMNS}`,
        [r.compartmentId, req.params.id, stage, r.isEmpty ? null : (r.dipCm ?? null), r.isEmpty ? 0 : (r.volumeLiters || 0),
          !!r.isEmpty, stage === 'loading' ? (r.product || trip.product) : null, stage === 'delivery' ? (r.tankId || null) : null,
          req.auth.email]
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

    let updateSql, updateParams;
    if (stage === 'loading') {
      updateSql = `UPDATE transit_logs SET loaded_qty = $1, dep_at = COALESCE(dep_at, now()), status = 'in-transit' WHERE id = $2 RETURNING ${TRANSIT_COLUMNS}`;
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

    // Delivery stage: recompute expected closing volume for every tank
    // touched by this submission — opening + what the truck put in, minus
    // anything the pumps sold from that tank on the same day (the only
    // way this codebase can tell "sales during offload" from any other
    // day's sales, since nozzle_readings isn't itself trip-scoped).
    if (stage === 'delivery') {
      const touchedTankIds = [...new Set(saved.filter((r) => r.tankId).map((r) => r.tankId))]
      for (const tankId of touchedTankIds) {
        const { rows: deliveredRows } = await pool.query(
          `SELECT volume_liters FROM compartment_readings WHERE transit_log_id = $1 AND stage = 'delivery' AND tank_id = $2`,
          [req.params.id, tankId]
        )
        const deliveredVolume = deliveredRows.reduce((sum, r) => sum + Number(r.volume_liters), 0)

        const { rows: offloadRows } = await pool.query(
          `SELECT ${OFFLOAD_COLUMNS} FROM tank_offload_readings WHERE transit_log_id = $1 AND tank_id = $2`,
          [req.params.id, tankId]
        )
        const openingVolume = offloadRows[0] ? Number(offloadRows[0].openingVolumeLiters) : 0

        const deliveryDate = updatedTrip[0].arrDate
        const [nozzlesRes, readingsRes] = await Promise.all([
          pool.query(`SELECT id FROM nozzles WHERE tank_id = $1`, [tankId]),
          pool.query(`SELECT nozzle_id, opening_meter, closing_meter FROM nozzle_readings WHERE reading_date = $1`, [deliveryDate]),
        ])
        const nozzleIds = new Set(nozzlesRes.rows.map((n) => String(n.id)))
        const salesDuringOffload = readingsRes.rows
          .filter((r) => nozzleIds.has(String(r.nozzle_id)))
          .reduce((sum, r) => sum + (Number(r.closing_meter) - Number(r.opening_meter)), 0)

        const expectedClosing = openingVolume + deliveredVolume - salesDuringOffload

        await pool.query(
          `INSERT INTO tank_offload_readings (transit_log_id, tank_id, opening_volume_liters, delivered_volume_liters, sales_during_offload_liters, expected_closing_volume_liters, recorded_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (transit_log_id, tank_id) DO UPDATE SET
             delivered_volume_liters = EXCLUDED.delivered_volume_liters,
             sales_during_offload_liters = EXCLUDED.sales_during_offload_liters,
             expected_closing_volume_liters = EXCLUDED.expected_closing_volume_liters`,
          [req.params.id, tankId, openingVolume, deliveredVolume, salesDuringOffload, expectedClosing, req.auth.email]
        )
      }
    }

    res.status(201).json({ readings: saved, trip: updatedTrip[0] })
  } catch (err) {
    next(err)
  }
})

export default router
