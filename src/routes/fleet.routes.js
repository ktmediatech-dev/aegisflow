import { Router } from 'express'
import { getTenantPool } from '../db/tenantDb.js'
import { requireAuth, requireCompanyUser } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permissions.js'
import { stationScopeFilterByName } from '../utils/stationScope.js'
import { requestDeletion } from '../services/deletionRequests.js'

const router = Router()
router.use(requireAuth, requireCompanyUser)

const COLUMNS = `id, plate, type, capacity, fuel, driver, station, status, mileage,
  last_service AS "lastService", next_service AS "nextService", gps_lat AS "gpsLat",
  gps_lng AS "gpsLng", speed, insurance_expiry AS insurance, fuel_level AS "fuelLevel",
  ownership, owner_name AS "ownerName", created_at`

const COMPARTMENT_COLUMNS = `id, vehicle_id AS "vehicleId", compartment_no AS "compartmentNo", capacity, created_at`

router.get('/', requirePermission('fleet', 'read'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(`SELECT ${COLUMNS} FROM fleet_vehicles ORDER BY created_at DESC`)
    res.json(stationScopeFilterByName(req, rows, 'station'))
  } catch (err) {
    next(err)
  }
})

router.post('/', requirePermission('fleet', 'write'), async (req, res, next) => {
  try {
    const { plate, type, capacity, fuel, driver, station, status, insurance, ownership, ownerName } = req.body
    if (!plate) return res.status(400).json({ error: 'plate is required' })
    if (ownership === 'hired' && !ownerName) {
      return res.status(400).json({ error: 'ownerName is required for a hired vehicle' })
    }

    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `INSERT INTO fleet_vehicles (plate, type, capacity, fuel, driver, station, status, insurance_expiry, ownership, owner_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${COLUMNS}`,
      [plate, type || 'Tanker', capacity || 0, fuel || null, driver || null, station || null,
        status || 'idle', insurance || null, ownership || 'owned', ownerName || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', requirePermission('fleet', 'write'), async (req, res, next) => {
  try {
    const { plate, type, capacity, fuel, driver, station, status, mileage, nextService, insurance, fuelLevel, ownership, ownerName } = req.body
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `UPDATE fleet_vehicles SET
        plate = COALESCE($1, plate),
        type = COALESCE($2, type),
        capacity = COALESCE($3, capacity),
        fuel = COALESCE($4, fuel),
        driver = COALESCE($5, driver),
        station = COALESCE($6, station),
        status = COALESCE($7, status),
        mileage = COALESCE($8, mileage),
        next_service = COALESCE($9, next_service),
        insurance_expiry = COALESCE($10, insurance_expiry),
        fuel_level = COALESCE($11, fuel_level),
        ownership = COALESCE($12, ownership),
        owner_name = COALESCE($13, owner_name)
       WHERE id = $14
       RETURNING ${COLUMNS}`,
      [plate, type, capacity, fuel, driver, station, status, mileage, nextService, insurance, fuelLevel, ownership, ownerName, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Vehicle not found' })
    res.json(rows[0])
  } catch (err) {
    next(err)
  }
})

// Same maker-checker pattern as Stations: files a request instead of
// deleting outright. See /deletion-requests.
router.delete('/:id', requirePermission('fleet', 'write'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(`SELECT plate FROM fleet_vehicles WHERE id = $1`, [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Vehicle not found' })

    const request = await requestDeletion(pool, {
      module: 'fleet', recordId: req.params.id, recordLabel: rows[0].plate,
      reason: req.body?.reason, requestedBy: req.auth.userId,
    })
    res.status(202).json(request)
  } catch (err) {
    next(err)
  }
})

// --- compartments ---
// Tankers carry fuel in individually-numbered compartments (count and
// capacity vary per truck). Registered once per vehicle, then referenced
// by compartment_readings (see tanks.routes.js) at each loading/delivery.

router.get('/:id/compartments', requirePermission('fleet', 'read'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `SELECT ${COMPARTMENT_COLUMNS} FROM fleet_vehicle_compartments WHERE vehicle_id = $1 ORDER BY compartment_no`,
      [req.params.id]
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

// Registers one compartment, or the whole set at once (body: { compartments: [{compartmentNo, capacity}, ...] }).
router.post('/:id/compartments', requirePermission('fleet', 'write'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const list = Array.isArray(req.body.compartments) ? req.body.compartments : [req.body]

    const created = []
    for (const c of list) {
      if (!c.compartmentNo) continue
      const { rows } = await pool.query(
        `INSERT INTO fleet_vehicle_compartments (vehicle_id, compartment_no, capacity)
         VALUES ($1, $2, $3)
         ON CONFLICT (vehicle_id, compartment_no) DO UPDATE SET capacity = EXCLUDED.capacity
         RETURNING ${COMPARTMENT_COLUMNS}`,
        [req.params.id, c.compartmentNo, c.capacity || 0]
      )
      created.push(rows[0])
    }
    if (!created.length) return res.status(400).json({ error: 'At least one compartment with compartmentNo is required' })
    res.status(201).json(created)
  } catch (err) {
    next(err)
  }
})

export default router
