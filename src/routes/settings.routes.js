import { Router } from 'express'
import { getTenantPool } from '../db/tenantDb.js'
import { requireAuth, requireCompanyUser } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permissions.js'

const router = Router()
router.use(requireAuth, requireCompanyUser)

const SINGLETON_ID = '00000000-0000-0000-0000-000000000001'
const THEMES = ['dark', 'light', 'ocean', 'forest', 'sunset', 'slate', 'violet']

const COLUMNS = `company_name AS "companyName", logo_data_uri AS "logoDataUri",
  contact_email AS "contactEmail", theme, updated_at AS "updatedAt"`

// GET /settings - every logged-in company user can read branding (name,
// logo, theme) — it's what the whole app displays, not admin-only info.
router.get('/', async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(`SELECT ${COLUMNS} FROM company_settings WHERE id = $1`, [SINGLETON_ID])
    if (rows.length) return res.json(rows[0])
    res.json({ companyName: null, logoDataUri: null, contactEmail: null, theme: 'dark', updatedAt: null })
  } catch (err) {
    next(err)
  }
})

// PATCH /settings - IT Admin only (gated on the "admin" module, same as
// Users/Roles). Upserts the singleton row.
router.patch('/', requirePermission('admin', 'write'), async (req, res, next) => {
  try {
    const { companyName, logoDataUri, contactEmail, theme } = req.body
    if (theme && !THEMES.includes(theme)) {
      return res.status(400).json({ error: `theme must be one of: ${THEMES.join(', ')}` })
    }
    if (logoDataUri && logoDataUri.length > 500_000) {
      return res.status(400).json({ error: 'Logo is too large — keep it under ~350KB' })
    }

    const pool = getTenantPool(req.auth.dbName)
    const { rows } = await pool.query(
      `INSERT INTO company_settings (id, company_name, logo_data_uri, contact_email, theme, updated_at)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'dark'), now())
       ON CONFLICT (id) DO UPDATE SET
         company_name = COALESCE(EXCLUDED.company_name, company_settings.company_name),
         logo_data_uri = COALESCE(EXCLUDED.logo_data_uri, company_settings.logo_data_uri),
         contact_email = COALESCE(EXCLUDED.contact_email, company_settings.contact_email),
         theme = COALESCE(EXCLUDED.theme, company_settings.theme),
         updated_at = now()
       RETURNING ${COLUMNS}`,
      [SINGLETON_ID, companyName || null, logoDataUri || null, contactEmail || null, theme || null]
    )
    res.json(rows[0])
  } catch (err) {
    next(err)
  }
})

export default router
