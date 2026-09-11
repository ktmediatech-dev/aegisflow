import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { platformQuery } from '../db/platformDb.js';
import { getTenantPool } from '../db/tenantDb.js';
import { signToken } from '../utils/jwt.js';
import { MODULE_KEYS } from '../config/modules.js';

const router = Router();

// POST /auth/login
// Single shared login endpoint for everyone. We first check if the email
// is the platform admin, then fall back to the directory to find which
// company database to authenticate against.
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // 1. Platform admin check
    const adminResult = await platformQuery(
      `SELECT * FROM platform_admins WHERE email = $1`,
      [email]
    );
    if (adminResult.rows.length) {
      const admin = adminResult.rows[0];
      const ok = await bcrypt.compare(password, admin.password_hash);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

      const permissions = MODULE_KEYS.map((module) => ({ module, can_read: true, can_write: true, can_approve: true }));
      const token = signToken({ type: 'platform_admin', adminId: admin.id, email });
      return res.json({ token, user: { name: admin.name, email, type: 'platform_admin', permissions } });
    }

    // 2. Look up which company this email belongs to
    // Aliased to db_name to keep the rest of this file (and the JWT's
    // "dbName" field, read by every route via req.auth.dbName) unchanged —
    // it now holds a Postgres schema name, not a database name. See
    // tenantDb.js for why.
    const dirResult = await platformQuery(
      `SELECT d.company_id, c.schema_name AS db_name, c.status, c.name as company_name
       FROM directory d JOIN companies c ON c.id = d.company_id
       WHERE d.email = $1`,
      [email]
    );
    if (!dirResult.rows.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { company_id, db_name, status, company_name } = dirResult.rows[0];
    if (status !== 'active') {
      return res.status(403).json({ error: 'This company account is not active. Contact your administrator.' });
    }

    // 3. Authenticate against that company's own database
    const tenantPool = getTenantPool(db_name);
    const userResult = await tenantPool.query(
      `SELECT u.*, r.name as role_name, s.name as station_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN stations s ON s.id = u.station_id
       WHERE u.email = $1`,
      [email]
    );
    if (!userResult.rows.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Your account has been disabled. Contact your IT Admin.' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    // Ensure we always include a role id (dev fallback may omit it);
    const roleId = user.role_id || user.roleId || 1;
    const roleName = user.role_name || user.roleName || 'IT Admin';

    const permResult = await tenantPool.query(
      `SELECT module, can_read, can_write, can_approve FROM permissions WHERE role_id = $1`,
      [roleId]
    );

    // A user with a station assigned is scoped to that station's data in
    // station-scoped modules (fleet, tanks, maintenance, stations); null
    // means company-wide, the existing default.
    const token = signToken({
      type: 'company_user',
      userId: user.id,
      companyId: company_id,
      dbName: db_name,
      roleId,
      roleName,
      email: user.email,
      stationId: user.station_id || null,
      stationName: user.station_name || null,
    });

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role_name,
        company: company_name,
        type: 'company_user',
        permissions: permResult.rows,
        stationId: user.station_id || null,
        stationName: user.station_name || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
