import { Router } from 'express'
import { getTenantPool } from '../db/tenantDb.js'
import { requireAuth, requireCompanyUser } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permissions.js'
import { requestDeletion } from '../services/deletionRequests.js'

const router = Router()
router.use(requireAuth, requireCompanyUser)

const COLUMNS = `id, name, short_code AS "shortCode", contact, email, phone, products,
  payment_terms AS "paymentTerms", credit_limit AS "creditLimit", current_balance AS "currentBalance",
  last_delivery AS "lastDelivery", status, rating, total_purchases AS "totalPurchases",
  delivery_lead_time AS "deliveryLeadTime", created_at`

router.get('/', requirePermission('suppliers', 'read'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(`SELECT ${COLUMNS} FROM suppliers ORDER BY created_at DESC`)
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.post('/', requirePermission('suppliers', 'write'), async (req, res, next) => {
  try {
    const { name, shortCode, contact, email, phone, products, paymentTerms, creditLimit, status, deliveryLeadTime } = req.body
    if (!name) return res.status(400).json({ error: 'name is required' })

    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `INSERT INTO suppliers (name, short_code, contact, email, phone, products, payment_terms, credit_limit, status, delivery_lead_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${COLUMNS}`,
      [name, shortCode || null, contact || null, email || null, phone || null, products || [],
        paymentTerms || 'Net 30', creditLimit || 0, status || 'active', deliveryLeadTime || 3]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', requirePermission('suppliers', 'write'), async (req, res, next) => {
  try {
    const { name, shortCode, contact, email, phone, products, paymentTerms, creditLimit, status, deliveryLeadTime, currentBalance, lastDelivery } = req.body
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `UPDATE suppliers SET
        name = COALESCE($1, name),
        short_code = COALESCE($2, short_code),
        contact = COALESCE($3, contact),
        email = COALESCE($4, email),
        phone = COALESCE($5, phone),
        products = COALESCE($6, products),
        payment_terms = COALESCE($7, payment_terms),
        credit_limit = COALESCE($8, credit_limit),
        status = COALESCE($9, status),
        delivery_lead_time = COALESCE($10, delivery_lead_time),
        current_balance = COALESCE($11, current_balance),
        last_delivery = COALESCE($12, last_delivery)
       WHERE id = $13
       RETURNING ${COLUMNS}`,
      [name, shortCode, contact, email, phone, products, paymentTerms, creditLimit, status,
        deliveryLeadTime, currentBalance, lastDelivery, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Supplier not found' })
    res.json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requirePermission('suppliers', 'write'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(`SELECT name FROM suppliers WHERE id = $1`, [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Supplier not found' })

    const request = await requestDeletion(pool, {
      module: 'suppliers', recordId: req.params.id, recordLabel: rows[0].name,
      reason: req.body?.reason, requestedBy: req.auth.userId,
    })
    res.status(202).json(request)
  } catch (err) {
    next(err)
  }
})

export default router
