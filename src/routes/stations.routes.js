import { Router } from 'express'
import { getTenantPool } from '../db/tenantDb.js'
import { requireAuth, requireCompanyUser } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permissions.js'
import { stationScopeFilterById } from '../utils/stationScope.js'
import { requestDeletion } from '../services/deletionRequests.js'

const router = Router()
router.use(requireAuth, requireCompanyUser)

const COLUMNS = `id, name, region, manager, address, phone, fuel_types AS "fuelTypes", tanks, pumps,
  status, daily_sales AS "dailySales", monthly_sales AS "monthlySales", sales_target AS "salesTarget",
  last_audit AS "lastAudit", risk_score AS "riskScore", established, lat, lng, created_at`

router.get('/', requirePermission('stations', 'read'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(`SELECT ${COLUMNS} FROM stations ORDER BY created_at DESC`)
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
       RETURNING ${COLUMNS}`,
      [name, region || null, manager || null, address || null, phone || null,
        fuelTypes || [], tanks || 0, pumps || 0, status || 'operational', salesTarget || null]
    )
    res.status(201).json(rows[0])
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
       RETURNING ${COLUMNS}`,
      [name, region, manager, address, phone, fuelTypes, tanks, pumps, status, salesTarget, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Station not found' })
    res.json(rows[0])
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
