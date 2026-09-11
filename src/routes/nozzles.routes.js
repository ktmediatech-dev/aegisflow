import { Router } from 'express'
import { getTenantPool } from '../db/tenantDb.js'
import { requireAuth, requireCompanyUser } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permissions.js'
import { stationScopeFilterByName } from '../utils/stationScope.js'

const router = Router()
router.use(requireAuth, requireCompanyUser)

// Nozzles/tanks/meter-readings live under the "stations" module permission,
// same as tank readings and transit logs (see tanks.routes.js).

const TANK_COLUMNS = `id, station_id AS "stationId", tank_no AS "tankNo", product, capacity, created_at`
const NOZZLE_COLUMNS = `id, station_id AS "stationId", tank_id AS "tankId", label, product, status, created_at`
const READING_COLUMNS = `id, nozzle_id AS "nozzleId", reading_date AS "readingDate",
  opening_meter AS "openingMeter", closing_meter AS "closingMeter",
  recorded_by AS "recordedBy", recorded_at AS "recordedAt"`

async function loadStationsById(pool) {
  const { rows } = await pool.query(`SELECT id, name FROM stations`)
  return new Map(rows.map((s) => [String(s.id), s.name]))
}

// --- master tanks (persistent tank entities, distinct from the periodic
// tank_readings snapshots) ---

router.get('/tanks', requirePermission('stations', 'read'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const [tanksRes, stationsById] = await Promise.all([
      pool.query(`SELECT ${TANK_COLUMNS} FROM tanks ORDER BY created_at DESC`),
      loadStationsById(pool),
    ])
    let tanks = tanksRes.rows.map((t) => ({ ...t, station: stationsById.get(String(t.stationId)) || null }))
    tanks = stationScopeFilterByName(req, tanks, 'station')
    res.json(tanks)
  } catch (err) {
    next(err)
  }
})

// Upsert by (stationId, tankNo) — lets creating a nozzle for a not-yet-
// registered tank register the tank in the same step.
router.post('/tanks', requirePermission('stations', 'write'), async (req, res, next) => {
  try {
    const { stationId, tankNo, product, capacity } = req.body
    if (!stationId || !tankNo || !product) {
      return res.status(400).json({ error: 'stationId, tankNo and product are required' })
    }
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `INSERT INTO tanks (station_id, tank_no, product, capacity)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (station_id, tank_no) DO UPDATE SET product = EXCLUDED.product, capacity = EXCLUDED.capacity
       RETURNING ${TANK_COLUMNS}`,
      [stationId, tankNo, product, capacity || 0]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

// --- nozzles ---

router.get('/', requirePermission('stations', 'read'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const [nozzlesRes, tanksRes, stationsById] = await Promise.all([
      pool.query(`SELECT ${NOZZLE_COLUMNS} FROM nozzles ORDER BY created_at DESC`),
      pool.query(`SELECT ${TANK_COLUMNS} FROM tanks`),
      loadStationsById(pool),
    ])
    const tanksById = new Map(tanksRes.rows.map((t) => [String(t.id), t]))
    let nozzles = nozzlesRes.rows.map((n) => {
      const tank = tanksById.get(String(n.tankId))
      const stationName = stationsById.get(String(n.stationId)) || null
      return { ...n, station: stationName, tankNo: tank?.tankNo || null }
    })
    nozzles = stationScopeFilterByName(req, nozzles, 'station')
    res.json(nozzles)
  } catch (err) {
    next(err)
  }
})

router.post('/', requirePermission('stations', 'write'), async (req, res, next) => {
  try {
    const { stationId, tankId, tankNo, product, capacity, label } = req.body
    if (!stationId || !label || !product) {
      return res.status(400).json({ error: 'stationId, label and product are required' })
    }
    if (!tankId && !tankNo) {
      return res.status(400).json({ error: 'Either tankId or tankNo is required' })
    }

    const pool = getTenantPool(req.auth.dbName)

    let resolvedTankId = tankId
    if (!resolvedTankId) {
      const { rows } = await pool.query(
        `INSERT INTO tanks (station_id, tank_no, product, capacity)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (station_id, tank_no) DO UPDATE SET product = EXCLUDED.product
         RETURNING id`,
        [stationId, tankNo, product, capacity || 0]
      )
      resolvedTankId = rows[0].id
    }

    const { rows } = await pool.query(
      `INSERT INTO nozzles (station_id, tank_id, label, product)
       VALUES ($1, $2, $3, $4)
       RETURNING ${NOZZLE_COLUMNS}`,
      [stationId, resolvedTankId, label, product]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

// --- meter readings ---

router.get('/readings', requirePermission('stations', 'read'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const [readingsRes, nozzlesRes, tanksRes, stationsById] = await Promise.all([
      pool.query(`SELECT ${READING_COLUMNS} FROM nozzle_readings ORDER BY reading_date DESC`),
      pool.query(`SELECT ${NOZZLE_COLUMNS} FROM nozzles`),
      pool.query(`SELECT ${TANK_COLUMNS} FROM tanks`),
      loadStationsById(pool),
    ])
    const nozzlesById = new Map(nozzlesRes.rows.map((n) => [String(n.id), n]))
    const tanksById = new Map(tanksRes.rows.map((t) => [String(t.id), t]))

    let readings = readingsRes.rows.map((r) => {
      const nozzle = nozzlesById.get(String(r.nozzleId))
      const tank = nozzle ? tanksById.get(String(nozzle.tankId)) : null
      const station = nozzle ? stationsById.get(String(nozzle.stationId)) : null
      return {
        ...r,
        throughput: Number(r.closingMeter) - Number(r.openingMeter),
        nozzleLabel: nozzle?.label || null,
        station: station || null,
        tankNo: tank?.tankNo || null,
        product: nozzle?.product || null,
      }
    })
    readings = stationScopeFilterByName(req, readings, 'station')
    res.json(readings)
  } catch (err) {
    next(err)
  }
})

router.post('/readings', requirePermission('stations', 'write'), async (req, res, next) => {
  try {
    const { nozzleId, readingDate, openingMeter, closingMeter } = req.body
    if (!nozzleId || openingMeter == null || closingMeter == null) {
      return res.status(400).json({ error: 'nozzleId, openingMeter and closingMeter are required' })
    }
    if (Number(closingMeter) < Number(openingMeter)) {
      return res.status(400).json({ error: 'closingMeter cannot be less than openingMeter' })
    }

    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `INSERT INTO nozzle_readings (nozzle_id, reading_date, opening_meter, closing_meter, recorded_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${READING_COLUMNS}`,
      [nozzleId, readingDate || new Date().toISOString().slice(0, 10), openingMeter, closingMeter, req.auth.email]
    )
    res.status(201).json({ ...rows[0], throughput: Number(closingMeter) - Number(openingMeter) })
  } catch (err) {
    next(err)
  }
})

// --- reconciliation: does what the nozzles metered match what the tank
// says it sold? A gap here is exactly the kind of signal Fraud Detection
// cares about (leakage/pilferage between the tank and the pump). ---

router.get('/reconciliation', requirePermission('stations', 'read'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const [readingsRes, nozzlesRes, tanksRes, tankReadingsRes, stationsById] = await Promise.all([
      pool.query(`SELECT ${READING_COLUMNS} FROM nozzle_readings`),
      pool.query(`SELECT ${NOZZLE_COLUMNS} FROM nozzles`),
      pool.query(`SELECT ${TANK_COLUMNS} FROM tanks`),
      // Alias reading_date as "date", not "readingDate" — that's what the
      // dev fallback's tank_readings serializer always names it (it mirrors
      // tanks.routes.js's original projection regardless of the alias a
      // query asks for), so this keeps real Postgres and the fallback consistent.
      pool.query(`SELECT station_name AS "stationName", tank_no AS "tankNo", sales_volume AS "salesVolume", reading_date AS "date" FROM tank_readings`),
      loadStationsById(pool),
    ])
    const nozzlesById = new Map(nozzlesRes.rows.map((n) => [String(n.id), n]))
    const tanksById = new Map(tanksRes.rows.map((t) => [String(t.id), t]))

    // Sum nozzle throughput per (station, tankNo, date).
    const throughputByKey = new Map()
    for (const r of readingsRes.rows) {
      const nozzle = nozzlesById.get(String(r.nozzleId))
      if (!nozzle) continue
      const tank = tanksById.get(String(nozzle.tankId))
      if (!tank) continue
      const station = stationsById.get(String(nozzle.stationId))
      const key = `${station}|${tank.tankNo}|${r.readingDate}`
      const throughput = Number(r.closingMeter) - Number(r.openingMeter)
      throughputByKey.set(key, (throughputByKey.get(key) || 0) + throughput)
    }

    const rows = tankReadingsRes.rows
      .map((t) => {
        const key = `${t.stationName}|${t.tankNo}|${t.date}`
        const nozzleThroughput = throughputByKey.get(key)
        if (nozzleThroughput == null) return null
        const salesVolume = Number(t.salesVolume) || 0
        const variance = salesVolume - nozzleThroughput
        const variancePct = salesVolume ? Math.abs(variance) / salesVolume * 100 : 0
        return {
          station: t.stationName, tankNo: t.tankNo, date: t.date,
          salesVolume, nozzleThroughput, variance, variancePct,
          flagged: variancePct > 2,
        }
      })
      .filter(Boolean)

    res.json(stationScopeFilterByName(req, rows, 'station'))
  } catch (err) {
    next(err)
  }
})

export default router
