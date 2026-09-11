import { Router } from 'express'
import { getTenantPool } from '../db/tenantDb.js'
import { requireAuth, requireCompanyUser } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permissions.js'
import { stationScopeFilterById } from '../utils/stationScope.js'
import { requestDeletion } from '../services/deletionRequests.js'

const router = Router()
router.use(requireAuth, requireCompanyUser)

// Risk score is computed live from operational signals rather than stored
// as a manually-entered figure: worst current tank variance (0-35pts),
// recent transit loss/flagged trips attributed to the station via its
// offload readings (0-30pts), overdue maintenance jobs (0-15pts), and
// open alerts by severity (0-20pts) — capped at 100 total.
const COLUMNS_WITH_RISK = `
  s.id, s.name, s.region, s.manager, s.address, s.phone, s.fuel_types AS "fuelTypes", s.tanks, s.pumps,
  s.status, s.daily_sales AS "dailySales", s.monthly_sales AS "monthlySales", s.sales_target AS "salesTarget",
  s.last_audit AS "lastAudit", s.established, s.lat, s.lng, s.created_at,
  LEAST(100, GREATEST(0,
    COALESCE(tank_pts.pts, 0) + COALESCE(transit_pts.pts, 0) + COALESCE(maint_pts.pts, 0) + COALESCE(alert_pts.pts, 0)
  ))::int AS "riskScore"
FROM stations s
LEFT JOIN (
  SELECT station_id, MAX(pts) AS pts FROM (
    SELECT DISTINCT ON (station_id, tank_no) station_id,
      CASE status WHEN 'anomaly' THEN 35 WHEN 'critical' THEN 25 WHEN 'warning' THEN 12 ELSE 0 END AS pts
    FROM tank_readings WHERE station_id IS NOT NULL
    ORDER BY station_id, tank_no, created_at DESC
  ) latest GROUP BY station_id
) tank_pts ON tank_pts.station_id = s.id
LEFT JOIN (
  SELECT tk.station_id,
    LEAST(30, COALESCE(AVG(tl.loss_pct), 0) / 6 * 20 + COUNT(*) FILTER (WHERE tl.flagged) * 3) AS pts
  FROM transit_logs tl
  JOIN tank_offload_readings t_off ON t_off.transit_log_id = tl.id
  JOIN tanks tk ON tk.id = t_off.tank_id
  WHERE tl.arr_date >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY tk.station_id
) transit_pts ON transit_pts.station_id = s.id
LEFT JOIN (
  SELECT s2.id AS station_id, LEAST(15, COUNT(*) * 5) AS pts
  FROM stations s2
  JOIN maintenance_jobs mj ON mj.station = s2.name
  WHERE mj.scheduled_date < CURRENT_DATE AND mj.status NOT IN ('completed', 'cancelled')
  GROUP BY s2.id
) maint_pts ON maint_pts.station_id = s.id
LEFT JOIN (
  SELECT station_id, LEAST(20,
    COUNT(*) FILTER (WHERE severity = 'critical') * 7 +
    COUNT(*) FILTER (WHERE severity = 'high') * 5 +
    COUNT(*) FILTER (WHERE severity = 'warning') * 2 +
    COUNT(*) FILTER (WHERE severity = 'info') * 1
  ) AS pts
  FROM alerts WHERE status = 'active' AND station_id IS NOT NULL
  GROUP BY station_id
) alert_pts ON alert_pts.station_id = s.id`

router.get('/', requirePermission('stations', 'read'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(`SELECT ${COLUMNS_WITH_RISK} ORDER BY s.created_at DESC`)
    res.json(stationScopeFilterById(req, rows, 'id'))
  } catch (err) {
    next(err)
  }
})

router.post('/', requirePermission('stations', 'write'), async (req, res, next) => {
  try {
    const { name, region, manager, address, phone, fuelTypes, tanks, pumps, status, salesTarget } = req.body
    if (!name) return res.status(400).json({ error: 'name is required' })

    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `INSERT INTO stations (name, region, manager, address, phone, fuel_types, tanks, pumps, status, sales_target)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [name, region || null, manager || null, address || null, phone || null,
        fuelTypes || [], tanks || 0, pumps || 0, status || 'operational', salesTarget || null]
    )
    const { rows: withRisk } = await pool.query(`SELECT ${COLUMNS_WITH_RISK} WHERE s.id = $1`, [rows[0].id])
    res.status(201).json(withRisk[0])
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', requirePermission('stations', 'write'), async (req, res, next) => {
  try {
    const { name, region, manager, address, phone, fuelTypes, tanks, pumps, status, salesTarget } = req.body
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `UPDATE stations SET
        name = COALESCE($1, name),
        region = COALESCE($2, region),
        manager = COALESCE($3, manager),
        address = COALESCE($4, address),
        phone = COALESCE($5, phone),
        fuel_types = COALESCE($6, fuel_types),
        tanks = COALESCE($7, tanks),
        pumps = COALESCE($8, pumps),
        status = COALESCE($9, status),
        sales_target = COALESCE($10, sales_target)
       WHERE id = $11
       RETURNING id`,
      [name, region, manager, address, phone, fuelTypes, tanks, pumps, status, salesTarget, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Station not found' })
    const { rows: withRisk } = await pool.query(`SELECT ${COLUMNS_WITH_RISK} WHERE s.id = $1`, [req.params.id])
    res.json(withRisk[0])
  } catch (err) {
    next(err)
  }
})

// Deleting a station doesn't remove it immediately — it files a request
// that a second user (someone with can_approve on "stations", who isn't
// the requester) must approve. See /deletion-requests.
router.delete('/:id', requirePermission('stations', 'write'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(`SELECT name FROM stations WHERE id = $1`, [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Station not found' })

    const request = await requestDeletion(pool, {
      module: 'stations', recordId: req.params.id, recordLabel: rows[0].name,
      reason: req.body?.reason, requestedBy: req.auth.userId,
    })
    res.status(202).json(request)
  } catch (err) {
    next(err)
  }
})

export default router
