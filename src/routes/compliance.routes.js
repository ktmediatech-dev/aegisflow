import { Router } from 'express'
import { getTenantPool } from '../db/tenantDb.js'
import { requireAuth, requireCompanyUser } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permissions.js'

const router = Router()
router.use(requireAuth, requireCompanyUser)

router.get('/cases', requirePermission('compliance', 'read'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `SELECT id, title, category, assigned_to, status, priority, opened_at, closed_at FROM compliance_cases ORDER BY opened_at DESC`
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.post('/cases', requirePermission('compliance', 'write'), async (req, res, next) => {
  try {
    const { title, category, assigned_to, priority, status } = req.body
    if (!title || !category) {
      return res.status(400).json({ error: 'title and category are required' })
    }

    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `INSERT INTO compliance_cases (title, category, assigned_to, priority, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, category, assigned_to, priority, status, opened_at`,
      [title, category, assigned_to || null, priority || 'medium', status || 'open']
    )

    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.patch('/cases/:id/approve', requirePermission('compliance', 'approve'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `UPDATE compliance_cases SET status = 'approved', closed_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Case not found' })
    res.json(rows[0])
  } catch (err) {
    next(err)
  }
})

export default router
