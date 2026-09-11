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

// Optional extra gate on top of requirePlatformAdmin: if
// PLATFORM_ADMIN_IP_ALLOWLIST is set (comma-separated IPs — exact match;
// this box's traffic already goes through one reverse proxy, so
// `trust proxy` + req.ip resolves to the real client), only those IPs can
// reach platform-admin routes at all, even with a valid token. Unset by
// default so this doesn't lock anyone out before it's configured — set
// it in production once you know the IP(s) you'll actually administer from.
export function requirePlatformIpAllowlist(req, res, next) {
  const allowlist = (process.env.PLATFORM_ADMIN_IP_ALLOWLIST || '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);

  if (!allowlist.length) return next();

  if (!allowlist.includes(req.ip)) {
    return res.status(403).json({ error: 'This IP is not permitted to access platform admin routes' });
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
