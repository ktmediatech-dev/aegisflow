import { Router } from 'express'
import { getTenantPool } from '../db/tenantDb.js'
import { requireAuth, requireCompanyUser } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permissions.js'

const router = Router()
router.use(requireAuth, requireCompanyUser)

router.get('/invoices', requirePermission('finance', 'read'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `SELECT id, invoice_number, vendor, amount, status, due_date, created_at FROM finance_invoices ORDER BY created_at DESC`
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.post('/invoices', requirePermission('finance', 'write'), async (req, res, next) => {
  try {
    const { invoice_number, vendor, amount, due_date, status } = req.body
    if (!invoice_number || !vendor || !amount || !due_date) {
      return res.status(400).json({ error: 'invoice_number, vendor, amount and due_date are required' })
    }

    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `INSERT INTO finance_invoices (invoice_number, vendor, amount, due_date, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, invoice_number, vendor, amount, status, due_date, created_at`,
      [invoice_number, vendor, amount, due_date, status || 'pending']
    )

    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

export default router
