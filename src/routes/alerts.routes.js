import { Router } from 'express'
import { getTenantPool } from '../db/tenantDb.js'
import { requireAuth, requireCompanyUser } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permissions.js'

const router = Router()
router.use(requireAuth, requireCompanyUser)

// Alerts are a cross-module dashboard feature — gated on "dashboard"
// read/write, same as the Alerts page route in App.jsx.

const COLUMNS = `id, type, severity, title, message, station_id, station_name AS station,
  status, assigned_to AS "assignedTo", created_at AS date`

router.get('/', requirePermission('dashboard', 'read'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(`SELECT ${COLUMNS} FROM alerts ORDER BY created_at DESC`)
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.post('/', requirePermission('dashboard', 'write'), async (req, res, next) => {
  try {
    const { type, severity, title, message, stationId, station, assignedTo } = req.body
    if (!type || !title) return res.status(400).json({ error: 'type and title are required' })

    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `INSERT INTO alerts (type, severity, title, message, station_id, station_name, assigned_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${COLUMNS}`,
      [type, severity || 'info', title, message || null, stationId || null, station || null, assignedTo || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.patch('/:id/acknowledge', requirePermission('dashboard', 'read'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `UPDATE alerts SET status = 'acknowledged' WHERE id = $1 AND status = 'active' RETURNING ${COLUMNS}`,
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Alert not found or not active' })
    res.json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.patch('/:id/dismiss', requirePermission('dashboard', 'read'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `UPDATE alerts SET status = 'dismissed' WHERE id = $1 AND status = 'active' RETURNING ${COLUMNS}`,
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Alert not found or not active' })
    res.json(rows[0])
  } catch (err) {
    next(err)
  }
})

export default router
