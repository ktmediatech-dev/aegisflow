import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { platformQuery } from '../db/platformDb.js';
import { getTenantPool } from '../db/tenantDb.js';
import { requireAuth, requirePlatformAdmin, requirePlatformIpAllowlist } from '../middleware/auth.js';
import { provisionCompany } from '../services/provisioning.js';
import { logPlatformAction, listPlatformAuditLog } from '../services/platformAudit.js';

const router = Router();

// Tighter than the general API — this whole router can create/suspend
// companies and reset any company user's password, so it gets its own,
// stricter budget regardless of what else is happening on the account.
const platformLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60 });

router.use(requireAuth, requirePlatformAdmin, requirePlatformIpAllowlist, platformLimiter);

// GET /companies - list all subscribed companies
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await platformQuery(
      `SELECT id, name, slug, plan, status, subscription_renews_at, created_at
       FROM companies ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /companies/platform-audit-log - every platform-admin action across
// every company, newest first. The record of who did what, from here.
router.get('/platform-audit-log', async (req, res, next) => {
  try {
    res.json(await listPlatformAuditLog());
  } catch (err) {
    next(err);
  }
});

// POST /companies - create a new company (provisions its own database)
// and immediately create its first IT Admin user.
router.post('/', async (req, res, next) => {
  try {
    const { name, plan, itAdminEmail, itAdminName, itAdminPassword } = req.body;
    if (!name || !itAdminEmail || !itAdminPassword) {
      return res.status(400).json({
        error: 'name, itAdminEmail and itAdminPassword are required',
      });
    }

    const company = await provisionCompany({ name, plan });

    // Create the company's first user: the IT Admin
    const tenantPool = getTenantPool(company.schema_name);
    const { rows: roleRows } = await tenantPool.query(
      `SELECT id FROM roles WHERE name = 'IT Admin' AND is_system = true`
    );
    const itAdminRoleId = roleRows[0]?.id;

    const passwordHash = await bcrypt.hash(itAdminPassword, 10);
    await tenantPool.query(
      `INSERT INTO users (email, password_hash, name, role_id, status)
       VALUES ($1, $2, $3, $4, 'active')`,
      [itAdminEmail, passwordHash, itAdminName || 'IT Admin', itAdminRoleId]
    );

    // Register this user in the platform directory so login can find
    // which company database to check.
    await platformQuery(
      `INSERT INTO directory (email, company_id) VALUES ($1, $2)`,
      [itAdminEmail, company.id]
    );

    await logPlatformAction(req, 'company.create', company.id, { name, plan, itAdminEmail });

    res.status(201).json({ company, itAdminEmail });
  } catch (err) {
    next(err);
  }
});

// GET /companies/:id/roles - list the role templates for a company
router.get('/:id/roles', async (req, res, next) => {
  try {
    const companyId = req.params.id;
    const { rows: companyRows } = await platformQuery(
      `SELECT schema_name FROM companies WHERE id = $1`,
      [companyId]
    );
    if (!companyRows.length) return res.status(404).json({ error: 'Company not found' });

    const tenantPool = getTenantPool(companyRows[0].schema_name);
    const { rows } = await tenantPool.query(`SELECT id, name, description, is_system FROM roles ORDER BY created_at DESC`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /companies/:id/users - create a new user inside a company.
router.post('/:id/users', async (req, res, next) => {
  try {
    const companyId = req.params.id;
    const { email, name, password, roleId } = req.body;
    if (!email || !name || !password || !roleId) {
      return res.status(400).json({ error: 'email, name, password and roleId are required' });
    }

    const { rows: companyRows } = await platformQuery(
      `SELECT schema_name FROM companies WHERE id = $1`,
      [companyId]
    );
    if (!companyRows.length) return res.status(404).json({ error: 'Company not found' });

    const tenantPool = getTenantPool(companyRows[0].schema_name);
    const { rows: roleRows } = await tenantPool.query(`SELECT id FROM roles WHERE id = $1`, [roleId]);
    if (!roleRows.length) return res.status(400).json({ error: 'Invalid roleId' });

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await tenantPool.query(
      `INSERT INTO users (email, password_hash, name, role_id, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id, email, name, role_id, status, created_at`,
      [email, passwordHash, name, roleId]
    );

    await platformQuery(
      `INSERT INTO directory (email, company_id) VALUES ($1, $2)`,
      [email, companyId]
    );

    await logPlatformAction(req, 'company.user.create', companyId, { email });

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH /companies/:id/status - suspend/reactivate a company (e.g. on
// non-payment) without deleting its data.
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body; // 'active' | 'suspended' | 'cancelled'
    if (!['active', 'suspended', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const { rows } = await platformQuery(
      `UPDATE companies SET status = $1 WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Company not found' });

    await logPlatformAction(req, 'company.status', req.params.id, { status });

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH /companies/:id/plan - change a company's subscription plan.
router.patch('/:id/plan', async (req, res, next) => {
  try {
    const { plan } = req.body;
    if (!plan) return res.status(400).json({ error: 'plan is required' });
    const { rows } = await platformQuery(
      `UPDATE companies SET plan = $1 WHERE id = $2 RETURNING *`,
      [plan, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Company not found' });

    await logPlatformAction(req, 'company.plan', req.params.id, { plan });

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /companies/:id/users - list a company's users, so the platform
// admin can pick one to reset a password for without needing to log into
// that company themselves.
router.get('/:id/users', async (req, res, next) => {
  try {
    const { rows: companyRows } = await platformQuery(
      `SELECT schema_name FROM companies WHERE id = $1`,
      [req.params.id]
    );
    if (!companyRows.length) return res.status(404).json({ error: 'Company not found' });

    const tenantPool = getTenantPool(companyRows[0].schema_name);
    const { rows } = await tenantPool.query(
      `SELECT u.id, u.email, u.name, u.status, r.name as role_name
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
       ORDER BY u.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /companies/:id/users/:userId/reset-password - platform admin
// support action: reset a locked-out company user's password without
// needing their old one. Does not require knowing the company's own
// admin credentials, since this bypasses tenant-side auth entirely.
router.post('/:id/users/:userId/reset-password', async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'newPassword is required and must be at least 8 characters' });
    }

    const { rows: companyRows } = await platformQuery(
      `SELECT schema_name FROM companies WHERE id = $1`,
      [req.params.id]
    );
    if (!companyRows.length) return res.status(404).json({ error: 'Company not found' });

    const tenantPool = getTenantPool(companyRows[0].schema_name);
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const { rows } = await tenantPool.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, email, name`,
      [passwordHash, req.params.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    await logPlatformAction(req, 'company.user.reset_password', req.params.id, { userId: req.params.userId, email: rows[0].email });

    res.json({ ok: true, user: rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /companies/:id/audit-log - cross-tenant visibility for support/
// compliance purposes: who did what, inside one company, without the
// platform admin ever touching that company's operational data.
router.get('/:id/audit-log', async (req, res, next) => {
  try {
    const { rows: companyRows } = await platformQuery(
      `SELECT schema_name FROM companies WHERE id = $1`,
      [req.params.id]
    );
    if (!companyRows.length) return res.status(404).json({ error: 'Company not found' });

    const tenantPool = getTenantPool(companyRows[0].schema_name);
    const { rows } = await tenantPool.query(
      `SELECT a.id, a.action, a.module, a.details, a.created_at, u.email as user_email
       FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.created_at DESC LIMIT 200`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
