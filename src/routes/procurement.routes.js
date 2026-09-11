import { Router } from 'express'
import { getTenantPool } from '../db/tenantDb.js'
import { requireAuth, requireCompanyUser } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permissions.js'

const router = Router()
router.use(requireAuth, requireCompanyUser)

router.get('/orders', requirePermission('procurement', 'read'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `SELECT id, order_number, supplier, total_amount, status, expected_delivery, created_at FROM procurement_orders ORDER BY created_at DESC`
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.post('/orders', requirePermission('procurement', 'write'), async (req, res, next) => {
  try {
    const { order_number, supplier, total_amount, expected_delivery, status } = req.body
    if (!order_number || !supplier || !total_amount || !expected_delivery) {
      return res.status(400).json({ error: 'order_number, supplier, total_amount and expected_delivery are required' })
    }

    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `INSERT INTO procurement_orders (order_number, supplier, total_amount, expected_delivery, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, order_number, supplier, total_amount, status, expected_delivery, created_at`,
      [order_number, supplier, total_amount, expected_delivery, status || 'ordered']
    )

    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

export default router
