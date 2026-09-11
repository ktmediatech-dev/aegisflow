import { Router } from 'express'
import { getTenantPool } from '../db/tenantDb.js'
import { requireAuth, requireCompanyUser } from '../middleware/auth.js'
import { isUsingFallback } from '../db/platformDb.js'
import {
  DELETABLE_MODULES, listDeletionRequests, getDeletionRequest,
  resolveDeletionRequest, canApproveModule,
} from '../services/deletionRequests.js'

const router = Router()
router.use(requireAuth, requireCompanyUser)

// GET /deletion-requests - review queue. Visible to any company user (it's
// just module + a human label + who asked), approval itself is gated below.
router.get('/', async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const rows = await listDeletionRequests(pool)
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.patch('/:id/approve', async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const request = await getDeletionRequest(pool, req.params.id)
    if (!request) return res.status(404).json({ error: 'Deletion request not found' })
    if (request.status !== 'pending') return res.status(400).json({ error: `Request already ${request.status}` })
    if (String(request.requestedBy) === String(req.auth.userId)) {
      return res.status(403).json({ error: 'You cannot approve your own deletion request' })
    }

    const target = DELETABLE_MODULES[request.module]
    if (!target) return res.status(400).json({ error: `Unknown module: ${request.module}` })

    if (!isUsingFallback()) {
      const allowed = await canApproveModule(pool, req.auth.roleId, target.permissionModule)
      if (!allowed) return res.status(403).json({ error: `Not permitted: ${target.permissionModule}.approve` })
    }

    await pool.query(`DELETE FROM ${target.table} WHERE id = $1`, [request.recordId])
    const updated = await resolveDeletionRequest(pool, req.params.id, { status: 'approved', resolvedBy: req.auth.userId })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

router.patch('/:id/reject', async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const request = await getDeletionRequest(pool, req.params.id)
    if (!request) return res.status(404).json({ error: 'Deletion request not found' })
    if (request.status !== 'pending') return res.status(400).json({ error: `Request already ${request.status}` })
    if (String(request.requestedBy) === String(req.auth.userId)) {
      return res.status(403).json({ error: 'You cannot resolve your own deletion request' })
    }

    const target = DELETABLE_MODULES[request.module]
    if (!target) return res.status(400).json({ error: `Unknown module: ${request.module}` })

    if (!isUsingFallback()) {
      const allowed = await canApproveModule(pool, req.auth.roleId, target.permissionModule)
      if (!allowed) return res.status(403).json({ error: `Not permitted: ${target.permissionModule}.approve` })
    }

    const updated = await resolveDeletionRequest(pool, req.params.id, { status: 'rejected', resolvedBy: req.auth.userId })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

export default router
