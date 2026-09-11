import { Router } from 'express'
import { getTenantPool } from '../db/tenantDb.js'
import { requireAuth, requireCompanyUser } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permissions.js'

const router = Router()
router.use(requireAuth, requireCompanyUser)

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Buckets rows into the last `count` calendar months (oldest first), keyed
// by MONTH_LABELS, summing `amount` for rows whose `dateField` falls in
// that bucket and (optionally) matches `predicate`.
function bucketByMonth(rows, dateField, amountField, count, predicate) {
  const now = new Date()
  const buckets = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, month: MONTH_LABELS[d.getMonth()], total: 0 })
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]))
  for (const row of rows) {
    const raw = row[dateField]
    if (!raw) continue
    if (predicate && !predicate(row)) continue
    const d = new Date(raw)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    const bucket = byKey.get(key)
    if (bucket) bucket.total += Number(row[amountField]) || 0
  }
  return buckets.map(({ month, total }) => ({ month, total }))
}

// Real, derived charts for Analytics/Reports/Fraud Detection — computed
// from the same rows the Stations/Tanks/Fleet/Maintenance pages already
// show, not fabricated series. There is currently no sales-transaction
// ledger (stations only carry a rolled-up monthlySales figure), so a true
// month-by-month revenue-by-fuel-type trend isn't available yet — that
// needs a dedicated sales-history module, flagged separately.
router.get('/overview', requirePermission('analytics', 'read'), async (req, res, next) => {
  try {
    const pool = getTenantPool(req.auth.dbName)

    const [stationsRes, tanksRes, transitRes, maintRes] = await Promise.all([
      pool.query(`SELECT name, monthly_sales AS "monthlySales", sales_target AS "salesTarget" FROM stations`),
      pool.query(`SELECT station_name AS "stationName", variance_pct AS "variancePct" FROM tank_readings`),
      pool.query(`SELECT dep_date AS "depDate", transit_loss AS "transitLoss" FROM transit_logs`),
      pool.query(`SELECT scheduled_date AS "scheduledDate", cost, priority FROM maintenance_jobs`),
    ])

    const stationPerformance = stationsRes.rows.map((s) => ({
      name: s.name,
      sales: Number(s.monthlySales) || 0,
      target: s.salesTarget != null ? Number(s.salesTarget) : null,
      efficiency: s.salesTarget ? Math.round((Number(s.monthlySales) / Number(s.salesTarget)) * 100) : null,
    }))

    // One bar per station: worst (highest-magnitude) variance among its tanks.
    const varianceByStation = new Map()
    for (const t of tanksRes.rows) {
      const current = varianceByStation.get(t.stationName) || 0
      if (Math.abs(Number(t.variancePct)) > Math.abs(current)) varianceByStation.set(t.stationName, Number(t.variancePct))
    }
    const tankVariance = [...varianceByStation.entries()].map(([station, variance]) => ({ station, variance, limit: 0.5 }))

    const transitLossHistory = bucketByMonth(transitRes.rows, 'depDate', 'transitLoss', 6).map((b) => ({
      month: b.month, loss: b.total, threshold: 500,
    }))

    // No explicit "planned" flag on a job — critical/high priority work is
    // reactive (unplanned) by nature, medium/low is scheduled (planned).
    const isUnplanned = (row) => row.priority === 'critical' || row.priority === 'high'
    const plannedByMonth = bucketByMonth(maintRes.rows, 'scheduledDate', 'cost', 6, (r) => !isUnplanned(r))
    const unplannedByMonth = bucketByMonth(maintRes.rows, 'scheduledDate', 'cost', 6, isUnplanned)
    const maintenanceCosts = plannedByMonth.map((b, i) => ({
      month: b.month, planned: b.total, unplanned: unplannedByMonth[i].total,
    }))

    res.json({ stationPerformance, tankVariance, transitLossHistory, maintenanceCosts })
  } catch (err) {
    next(err)
  }
})

export default router
