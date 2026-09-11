import { Router } from 'express'
import { getTenantPool } from '../db/tenantDb.js'
import { requireAuth, requireCompanyUser } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permissions.js'

const router = Router()
router.use(requireAuth, requireCompanyUser)

router.get('/employees', requirePermission('hr', 'read'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `SELECT id, name, email, role, department, status, hired_at FROM hr_employees ORDER BY hired_at DESC`
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.post('/employees', requirePermission('hr', 'write'), async (req, res, next) => {
  try {
    const { name, email, role, department, status } = req.body
    if (!name || !email || !role || !department) {
      return res.status(400).json({ error: 'name, email, role and department are required' })
    }

    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `INSERT INTO hr_employees (name, email, role, department, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, department, status, hired_at`,
      [name, email, role, department, status || 'active']
    )

    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

export default router
