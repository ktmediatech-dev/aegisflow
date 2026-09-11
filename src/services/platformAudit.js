import { platformQuery, isUsingFallback } from '../db/platformDb.js';

// Records a platform-admin action against the platform-wide audit log.
// Never throws into the caller's request handling — an audit-log write
// failing shouldn't block the action it's describing, just get logged
// server-side so it can be noticed.
export async function logPlatformAction(req, action, companyId, details) {
  try {
    if (isUsingFallback()) return; // dev fallback doesn't model this table
    await platformQuery(
      `INSERT INTO platform_audit_log (admin_id, admin_email, action, company_id, details, ip)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.auth?.adminId || null, req.auth?.email || null, action, companyId || null, details ? JSON.stringify(details) : null, req.ip]
    );
  } catch (err) {
    console.error('Failed to write platform audit log entry:', err.message || err);
  }
}

export async function listPlatformAuditLog() {
  const { rows } = await platformQuery(
    `SELECT id, admin_email AS "adminEmail", action, company_id AS "companyId", details, ip, created_at AS "createdAt"
     FROM platform_audit_log ORDER BY created_at DESC LIMIT 200`
  );
  return rows;
}
