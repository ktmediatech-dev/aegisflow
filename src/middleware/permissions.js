import { getTenantPool } from '../db/tenantDb.js';
import { isUsingFallback } from '../db/platformDb.js';

/**
 * Usage: requirePermission('hr', 'write')
 * Looks up the caller's role permissions for the given module, in their
 * own company's database, and blocks the request if they lack the
 * requested access level ('read' | 'write' | 'approve').
 */
export function requirePermission(moduleKey, level = 'read') {
  return async (req, res, next) => {
    try {
      // When running with the in-memory dev fallback, skip granular
      // permissions checks to keep the developer experience fast and
      // predictable. In production with Postgres this branch is not used.
      if (isUsingFallback()) return next();
      const { dbName, roleId } = req.auth;
      if (!dbName || !roleId) {
        return res.status(403).json({ error: 'No role assigned' });
      }

      const pool = getTenantPool(dbName);
      const { rows } = await pool.query(
        `SELECT can_read, can_write, can_approve FROM permissions
         WHERE role_id = $1 AND module = $2`,
        [roleId, moduleKey]
      );

      const perm = rows[0];
      const allowed =
        perm &&
        ((level === 'read' && perm.can_read) ||
          (level === 'write' && perm.can_write) ||
          (level === 'approve' && perm.can_approve));

      if (!allowed) {
        return res.status(403).json({ error: `Not permitted: ${moduleKey}.${level}` });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
