import { Router } from 'express';
import { getTenantPool } from '../db/tenantDb.js';
import { requireAuth, requireCompanyUser } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { MODULE_KEYS } from '../config/modules.js';

const router = Router();

router.use(requireAuth, requireCompanyUser);

// GET /roles - list roles + their permission matrix, for this company only
router.get('/', requirePermission('admin', 'read'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName);
    const { rows: roles } = await pool.query(`SELECT * FROM roles ORDER BY created_at`);
    const { rows: perms } = await pool.query(`SELECT * FROM permissions`);

    const result = roles.map((role) => ({
      ...role,
      permissions: perms.filter((p) => p.role_id === role.id),
    }));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /roles - IT Admin creates a custom role (e.g. "Regional Auditor")
router.post('/', requirePermission('admin', 'write'), async (req, res, next) => {
  try {
    const { name, description, permissions = {} } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const pool = getTenantPool(req.auth.dbName);
    const { rows } = await pool.query(
      `INSERT INTO roles (name, description, is_system) VALUES ($1, $2, false) RETURNING *`,
      [name, description || null]
    );
    const role = rows[0];

    for (const moduleKey of MODULE_KEYS) {
      const p = permissions[moduleKey] || {};
      await pool.query(
        `INSERT INTO permissions (role_id, module, can_read, can_write, can_approve)
         VALUES ($1, $2, $3, $4, $5)`,
        [role.id, moduleKey, !!p.read, !!p.write, !!p.approve]
      );
    }

    res.status(201).json(role);
  } catch (err) {
    next(err);
  }
});

// PATCH /roles/:id/permissions - update a role's permission matrix.
// System roles (IT Admin etc.) can have their matrix edited too, except
// IT Admin's own access can't be stripped below full, to avoid a company
// locking itself out of its own admin panel.
router.patch('/:id/permissions', requirePermission('admin', 'write'), async (req, res, next) => {
  try {
    const { permissions } = req.body; // { moduleKey: { read, write, approve } }
    const pool = getTenantPool(req.auth.dbName);

    const { rows: roleRows } = await pool.query(`SELECT * FROM roles WHERE id = $1`, [req.params.id]);
    if (!roleRows.length) return res.status(404).json({ error: 'Role not found' });
    const role = roleRows[0];

    if (role.name === 'IT Admin') {
      return res.status(400).json({ error: "IT Admin's full access cannot be reduced." });
    }

    for (const moduleKey of MODULE_KEYS) {
      if (!(moduleKey in permissions)) continue;
      const p = permissions[moduleKey];
      await pool.query(
        `UPDATE permissions SET can_read = $1, can_write = $2, can_approve = $3
         WHERE role_id = $4 AND module = $5`,
        [!!p.read, !!p.write, !!p.approve, req.params.id, moduleKey]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
