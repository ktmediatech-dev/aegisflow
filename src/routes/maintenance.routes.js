import { Router } from 'express'
import { getTenantPool } from '../db/tenantDb.js'
import { requireAuth, requireCompanyUser } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permissions.js'
import { stationScopeFilterByName } from '../utils/stationScope.js'

const router = Router()
router.use(requireAuth, requireCompanyUser)

const SELECT_COLUMNS = `id, station, vehicle_id AS "vehicleId", type, description, priority, status,
  contractor_id AS "contractorId", assigned_tech AS "assignedTech", scheduled_date AS "scheduledDate",
  estimated_completion AS "estimatedCompletion", actual_completion AS "actualCompletion",
  cost, invoice_no AS "invoiceNo", notes, created_at AS "createdAt"`

router.get('/', requirePermission('maintenance', 'read'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(`SELECT ${SELECT_COLUMNS} FROM maintenance_jobs ORDER BY created_at DESC`)
    res.json(stationScopeFilterByName(req, rows, 'station'))
  } catch (err) {
    next(err)
  }
})

router.post('/', requirePermission('maintenance', 'write'), async (req, res, next) => {
  try {
    const { station, vehicleId, type, description, priority, status, assignedTech, scheduledDate, estimatedCompletion, cost, notes } = req.body
    if (!type) return res.status(400).json({ error: 'type is required' })

    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `INSERT INTO maintenance_jobs (station, vehicle_id, type, description, priority, status, assigned_tech, scheduled_date, estimated_completion, cost, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING ${SELECT_COLUMNS}`,
      [station || null, vehicleId || null, type, description || null, priority || 'medium',
        status || 'scheduled', assignedTech || null, scheduledDate || null, estimatedCompletion || null,
        cost || 0, notes || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', requirePermission('maintenance', 'write'), async (req, res, next) => {
  try {
    const { station, type, description, priority, status, assignedTech, scheduledDate, estimatedCompletion, actualCompletion, cost, invoiceNo, notes } = req.body
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `UPDATE maintenance_jobs SET
        station = COALESCE($1, station),
        type = COALESCE($2, type),
        description = COALESCE($3, description),
        priority = COALESCE($4, priority),
        status = COALESCE($5, status),
        assigned_tech = COALESCE($6, assigned_tech),
        scheduled_date = COALESCE($7, scheduled_date),
        estimated_completion = COALESCE($8, estimated_completion),
        actual_completion = COALESCE($9, actual_completion),
        cost = COALESCE($10, cost),
        invoice_no = COALESCE($11, invoice_no),
        notes = COALESCE($12, notes)
       WHERE id = $13
       RETURNING ${SELECT_COLUMNS}`,
      [station, type, description, priority, status, assignedTech, scheduledDate, estimatedCompletion,
        actualCompletion, cost, invoiceNo, notes, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Job not found' })
    res.json(rows[0])
  } catch (err) {
    next(err)
  }
})

export default router
