import { Router } from 'express'
import { getTenantPool } from '../db/tenantDb.js'
import { requireAuth, requireCompanyUser } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permissions.js'
import { requestDeletion } from '../services/deletionRequests.js'

const router = Router()
router.use(requireAuth, requireCompanyUser)

// Contractors are hired for maintenance work, so they sit under the
// "maintenance" module permission (there's no dedicated MODULE_KEYS entry
// for them, same convention as tanks living under "stations").

const COLUMNS = `id, name, contact, email, phone, speciality, region, rating,
  active_jobs AS "activeJobs", completed_jobs AS "completedJobs",
  contract_start AS contract, contract_expiry AS expiry, status,
  total_paid AS "totalPaid", certifications, created_at`

router.get('/', requirePermission('maintenance', 'read'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(`SELECT ${COLUMNS} FROM contractors ORDER BY created_at DESC`)
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.post('/', requirePermission('maintenance', 'write'), async (req, res, next) => {
  try {
    const { name, contact, email, phone, speciality, region, contract, expiry, status, certifications } = req.body
    if (!name) return res.status(400).json({ error: 'name is required' })

    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `INSERT INTO contractors (name, contact, email, phone, speciality, region, contract_start, contract_expiry, status, certifications)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${COLUMNS}`,
      [name, contact || null, email || null, phone || null, speciality || null, region || null,
        contract || null, expiry || null, status || 'active', certifications || []]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', requirePermission('maintenance', 'write'), async (req, res, next) => {
  try {
    const { name, contact, email, phone, speciality, region, contract, expiry, status } = req.body
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `UPDATE contractors SET
        name = COALESCE($1, name),
        contact = COALESCE($2, contact),
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        speciality = COALESCE($5, speciality),
        region = COALESCE($6, region),
        contract_start = COALESCE($7, contract_start),
        contract_expiry = COALESCE($8, contract_expiry),
        status = COALESCE($9, status)
       WHERE id = $10
       RETURNING ${COLUMNS}`,
      [name, contact, email, phone, speciality, region, contract, expiry, status, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Contractor not found' })
    res.json(rows[0])
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requirePermission('maintenance', 'write'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(`SELECT name FROM contractors WHERE id = $1`, [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Contractor not found' })

    const request = await requestDeletion(pool, {
      module: 'contractors', recordId: req.params.id, recordLabel: rows[0].name,
      reason: req.body?.reason, requestedBy: req.auth.userId,
    })
    res.status(202).json(request)
  } catch (err) {
    next(err)
  }
})

export default router
