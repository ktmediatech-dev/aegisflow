import { verifyToken } from '../utils/jwt.js';

/**
 * Verifies the JWT and attaches the decoded identity to req.auth.
 * For company users, the token's payload already carries companyId
 * and dbName — captured at login time — so every subsequent request
 * is locked to that one company's database with no lookup needed and
 * no way to cross over into another tenant's data.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token' });
  }

  try {
    req.auth = verifyToken(token);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Restricts a route to the platform super admin only (you).
export function requirePlatformAdmin(req, res, next) {
  if (req.auth?.type !== 'platform_admin') {
    return res.status(403).json({ error: 'Platform admin access required' });
  }
  next();
}

// Restricts a route to authenticated company users (any role).
export function requireCompanyUser(req, res, next) {
  if (req.auth?.type !== 'company_user') {
    return res.status(403).json({ error: 'Company user access required' });
  }
  next();
}
