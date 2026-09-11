import { Router } from 'express'
import { authenticator } from 'otplib'
import QRCode from 'qrcode'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { platformQuery } from '../db/platformDb.js'
import { requireAuth, requirePlatformAdmin } from '../middleware/auth.js'
import { signToken, verifyToken } from '../utils/jwt.js'
import { MODULE_KEYS } from '../config/modules.js'

const router = Router()

// Small clock-drift tolerance either side of the current 30s step.
authenticator.options = { window: 1 }

function generateBackupCodes(count = 8) {
  return Array.from({ length: count }, () => crypto.randomBytes(5).toString('hex'))
}

// POST /auth/2fa/setup - start enrollment. Generates and stores a new
// secret (totp_enabled stays false until verify-setup confirms the admin
// actually has it in an authenticator app) and returns everything needed
// to scan/enter it: the raw secret, the otpauth:// URI, and a QR code.
router.post('/setup', requireAuth, requirePlatformAdmin, async (req, res, next) => {
  try {
    const secret = authenticator.generateSecret()
    await platformQuery(`UPDATE platform_admins SET totp_secret = $1, totp_enabled = false WHERE id = $2`, [secret, req.auth.adminId])

    const otpauthUrl = authenticator.keyuri(req.auth.email, 'AegisFlow', secret)
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl)

    res.json({ secret, otpauthUrl, qrDataUrl })
  } catch (err) {
    next(err)
  }
})

// POST /auth/2fa/verify-setup - confirms enrollment with a live code from
// the authenticator app, then turns 2FA on and issues one-time backup
// codes (shown once — only their bcrypt hashes are ever stored).
router.post('/verify-setup', requireAuth, requirePlatformAdmin, async (req, res, next) => {
  try {
    const { code } = req.body
    if (!code) return res.status(400).json({ error: 'code is required' })

    const { rows } = await platformQuery(`SELECT totp_secret FROM platform_admins WHERE id = $1`, [req.auth.adminId])
    const secret = rows[0]?.totp_secret
    if (!secret) return res.status(400).json({ error: 'Call /auth/2fa/setup first' })

    if (!authenticator.check(code, secret)) {
      return res.status(400).json({ error: 'Invalid code' })
    }

    const backupCodes = generateBackupCodes()
    const hashedCodes = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10)))
    await platformQuery(
      `UPDATE platform_admins SET totp_enabled = true, totp_backup_codes = $1 WHERE id = $2`,
      [JSON.stringify(hashedCodes), req.auth.adminId]
    )

    res.json({ ok: true, backupCodes })
  } catch (err) {
    next(err)
  }
})

// POST /auth/2fa/disable - requires a live code (not a backup code —
// disabling is a bigger action than logging in) to turn 2FA back off.
router.post('/disable', requireAuth, requirePlatformAdmin, async (req, res, next) => {
  try {
    const { code } = req.body
    const { rows } = await platformQuery(`SELECT totp_secret, totp_enabled FROM platform_admins WHERE id = $1`, [req.auth.adminId])
    const admin = rows[0]
    if (!admin?.totp_enabled) return res.status(400).json({ error: '2FA is not enabled' })
    if (!code || !authenticator.check(code, admin.totp_secret)) {
      return res.status(400).json({ error: 'Invalid code' })
    }

    await platformQuery(
      `UPDATE platform_admins SET totp_enabled = false, totp_secret = NULL, totp_backup_codes = '[]' WHERE id = $1`,
      [req.auth.adminId]
    )
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// GET /auth/2fa/status
router.get('/status', requireAuth, requirePlatformAdmin, async (req, res, next) => {
  try {
    const { rows } = await platformQuery(`SELECT totp_enabled FROM platform_admins WHERE id = $1`, [req.auth.adminId])
    res.json({ enabled: !!rows[0]?.totp_enabled })
  } catch (err) {
    next(err)
  }
})

// POST /auth/2fa/login-verify - the second step of login when 2FA is
// enabled. Takes the short-lived pendingToken from /auth/login (not a
// real session) plus a live code OR one of the one-time backup codes,
// and only then issues a real platform_admin token.
router.post('/login-verify', async (req, res, next) => {
  try {
    const { pendingToken, code } = req.body
    if (!pendingToken || !code) {
      return res.status(400).json({ error: 'pendingToken and code are required' })
    }

    let decoded
    try {
      decoded = verifyToken(pendingToken)
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired login session — please sign in again' })
    }
    if (decoded.type !== 'platform_admin_pending_2fa') {
      return res.status(401).json({ error: 'Invalid login session' })
    }

    const { rows } = await platformQuery(`SELECT * FROM platform_admins WHERE id = $1`, [decoded.adminId])
    const admin = rows[0]
    if (!admin || !admin.totp_enabled) return res.status(401).json({ error: 'Invalid login session' })

    let validated = authenticator.check(code, admin.totp_secret)

    // Not a live code — check one-time backup codes, consuming the match.
    if (!validated) {
      const backupCodes = admin.totp_backup_codes || []
      for (let i = 0; i < backupCodes.length; i++) {
        if (await bcrypt.compare(code, backupCodes[i])) {
          validated = true
          const remaining = [...backupCodes.slice(0, i), ...backupCodes.slice(i + 1)]
          await platformQuery(`UPDATE platform_admins SET totp_backup_codes = $1 WHERE id = $2`, [JSON.stringify(remaining), admin.id]);
          break
        }
      }
    }

    if (!validated) return res.status(401).json({ error: 'Invalid code' })

    const permissions = MODULE_KEYS.map((module) => ({ module, can_read: true, can_write: true, can_approve: true }))
    const token = signToken({ type: 'platform_admin', adminId: admin.id, email: admin.email })
    res.json({ token, user: { name: admin.name, email: admin.email, type: 'platform_admin', permissions } })
  } catch (err) {
    next(err)
  }
})

export default router
