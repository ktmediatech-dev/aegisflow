import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getTenantPool } from '../db/tenantDb.js';
import { platformQuery } from '../db/platformDb.js';
import { requireAuth, requireCompanyUser } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';

const router = Router();

router.use(requireAuth, requireCompanyUser);

// GET /users - list all users in MY company only.
// req.auth.dbName comes from the JWT issued at login, so this route
// can never read another company's users even if someone forged an id.
router.get('/', requirePermission('admin', 'read'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName);
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.name, u.status, u.created_at, r.id as role_id, r.name as role_name,
        u.station_id, s.name as station_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN stations s ON s.id = u.station_id
       ORDER BY u.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /users - IT Admin creates a new user within their own company.
// stationId is optional: set it to scope the user (e.g. a Station
// Manager) to just that one station's data; leave it out for
// company-wide access.
router.post('/', requirePermission('admin', 'write'), async (req, res, next) => {
  try {
    const { email, name, password, roleId, stationId } = req.body;
    if (!email || !name || !password || !roleId) {
      return res.status(400).json({ error: 'email, name, password and roleId are required' });
    }

    const pool = getTenantPool(req.auth.dbName);

    // Confirm the role actually belongs to this company's db (it will,
    // since roleId is looked up from this same tenant database — there's
    // no way to pass in a role id from a different company).
    const roleCheck = await pool.query(`SELECT id FROM roles WHERE id = $1`, [roleId]);
    if (!roleCheck.rows.length) {
      return res.status(400).json({ error: 'Invalid roleId' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, name, role_id, station_id, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING id, email, name, role_id, station_id, status, created_at`,
      [email, passwordHash, name, roleId, stationId || null]
    );

    // Register in the platform directory so this user can log in.
    await platformQuery(
      `INSERT INTO directory (email, company_id) VALUES ($1, $2)`,
      [email, req.auth.companyId]
    );

    await pool.query(
      `INSERT INTO audit_log (user_id, action, module, details) VALUES ($1, $2, $3, $4)`,
      [req.auth.userId, 'user.create', 'admin', { createdUserId: rows[0].id, email }]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH /users/:id - edit a user's role/status/name/station (own company only).
router.patch('/:id', requirePermission('admin', 'write'), async (req, res, next) => {
  try {
    const { name, roleId, status, stationId } = req.body;
    const pool = getTenantPool(req.auth.dbName);

    const { rows } = await pool.query(
      `UPDATE users SET
        name = COALESCE($1, name),
        role_id = COALESCE($2, role_id),
        status = COALESCE($3, status),
        station_id = COALESCE($4, station_id)
       WHERE id = $5
       RETURNING id, email, name, role_id, station_id, status`,
      [name, roleId, status, stationId, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    await pool.query(
      `INSERT INTO audit_log (user_id, action, module, details) VALUES ($1, $2, $3, $4)`,
      [req.auth.userId, 'user.update', 'admin', { targetUserId: req.params.id, changes: req.body }]
    );

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /users/me - any logged-in user can fetch their own profile + permissions
router.get('/me', async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName);
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.name, r.id as role_id, r.name as role_name, u.station_id, s.name as station_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN stations s ON s.id = u.station_id
       WHERE u.id = $1`,
      [req.auth.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    const permResult = await pool.query(
      `SELECT module, can_read, can_write, can_approve FROM permissions WHERE role_id = $1`,
      [rows[0].role_id]
    );

    res.json({ ...rows[0], permissions: permResult.rows });
  } catch (err) {
    next(err);
  }
});

export default router;
